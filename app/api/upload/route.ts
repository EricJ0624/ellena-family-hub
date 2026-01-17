import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  base64ToBlob,
  checkCloudinaryConfig,
  checkS3Config,
  downloadFromUrl,
  generateAppS3KeyFromMasterKey,
  getImageMetadata,
  getMimeTypeFromFormat,
  getSupabaseServerClient,
  replaceFileExtension,
  resizeImageBuffer,
  uploadToCloudinaryWithGroup,
  uploadToS3WithGroup,
  uploadToS3WithGroupAndKey,
} from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

// Next.js App Router: 큰 파일 업로드를 위한 설정
// ⚠️ 중요: Vercel에서는 최대 4.5MB 제한이 있습니다.
// Base64 인코딩 시 원본의 약 1.33배 크기 증가하므로,
// 실제로는 약 3MB 파일도 Base64로 변환하면 4.5MB를 초과할 수 있습니다.
// 따라서 서버 경유 방식은 3MB 이하 파일만 허용하는 것이 안전합니다.
export const maxDuration = 60; // 60초 타임아웃

// S3에 파일 업로드 (레거시 함수 - 호환성 유지)
// ⚠️ Multi-tenant 아키텍처에서는 uploadToS3WithGroup 사용 권장
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Body 크기 체크 (Base64 인코딩 고려)
    // ⚠️ Vercel 제한: 4.5MB
    // Base64 인코딩 시 원본의 약 1.33배 크기 증가
    // 안전하게 3MB로 제한 (Base64 변환 후 약 4MB)
    const MAX_BODY_SIZE = 3 * 1024 * 1024; // 3MB (Vercel 제한 고려)
    
    let body;
    try {
      body = await request.json();
    } catch (error: any) {
      // JSON 파싱 오류는 보통 body size limit 초과일 수 있음
      return NextResponse.json(
        { error: '요청 데이터가 너무 큽니다. 파일 크기를 줄이거나 네트워크 연결을 확인해주세요.' },
        { status: 413 }
      );
    }

    const { 
      originalData, // 원본 Base64
      fileName,
      mimeType,
      originalSize,
      forceCloudinary,
      groupId, // 그룹 ID (선택적, 있으면 권한 검증)
    } = body;

    if (!originalData || !fileName || !mimeType) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // Multi-tenant 아키텍처: groupId 필수 검증
    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId는 필수입니다. Multi-tenant 아키텍처에서는 모든 데이터에 groupId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 그룹 권한 검증 (필수)
      const permissionResult = await checkPermission(
        user.id,
        groupId,
        null, // MEMBER 이상 권한 필요
        user.id
      );

      if (!permissionResult.success) {
        return NextResponse.json(
          { error: '그룹 접근 권한이 없습니다.' },
          { status: 403 }
        );
    }

    // Base64 데이터 크기 체크
    // Base64 문자열 길이를 바이트로 변환: (length * 3) / 4
    const estimatedSize = (originalData.length * 3) / 4;
    
    if (estimatedSize > MAX_BODY_SIZE) {
      return NextResponse.json(
        { 
          error: `파일이 너무 큽니다. (최대 ${MAX_BODY_SIZE / 1024 / 1024}MB)`,
          details: `현재 파일 크기: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB. 3MB 이상 파일은 Presigned URL 방식을 사용해주세요.`,
          estimatedSize: estimatedSize,
          maxSize: MAX_BODY_SIZE
        },
        { status: 413 }
      );
    }

    // 1. Build master and app images
    const isImage = mimeType.startsWith('image/');
    const MASTER_MAX_DIMENSION = 2560;
    const APP_MAX_DIMENSION = 1920;
    const APP_QUALITY = 85;
    const MASTER_QUALITY = 90;

    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';
    let cloudinaryError: string | null = null;

    let masterBuffer: Buffer = Buffer.from(await base64ToBlob(originalData, mimeType).arrayBuffer());
    let masterMimeType = mimeType;
    let masterFileName = fileName;
    let masterFormat = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'jpg');

    if (isImage) {
      try {
        const metadata = await getImageMetadata(masterBuffer);
        const maxDimension = Math.max(metadata.width || 0, metadata.height || 0);

        if (forceCloudinary || maxDimension > MASTER_MAX_DIMENSION) {
          const cloudinaryConfig = checkCloudinaryConfig();
          if (cloudinaryConfig.available) {
            try {
              const cloudinaryBlob = new Blob([new Uint8Array(masterBuffer)], { type: mimeType });
              const cloudinaryResult = await uploadToCloudinaryWithGroup(
                cloudinaryBlob,
                fileName,
                mimeType,
                user.id,
                groupId,
                { maxDimension: MASTER_MAX_DIMENSION, quality: 'auto', fetchFormat: masterFormat }
              );
              cloudinaryUrl = cloudinaryResult.url;
              cloudinaryPublicId = cloudinaryResult.publicId;
              const downloaded = await downloadFromUrl(cloudinaryResult.url);
              masterBuffer = Buffer.from(downloaded);
              masterFormat = cloudinaryResult.format || masterFormat;
              masterMimeType = getMimeTypeFromFormat(masterFormat, mimeType);
              masterFileName = replaceFileExtension(fileName, masterFormat);
            } catch (cloudinaryUploadError: any) {
              console.error('Cloudinary master transform error:', cloudinaryUploadError);
              cloudinaryError = cloudinaryUploadError?.message || 'Cloudinary transform failed';
            }
          } else {
            cloudinaryError = `Cloudinary config missing: ${cloudinaryConfig.missing.join(', ')}`;
          }

          if (!cloudinaryUrl) {
            masterBuffer = await resizeImageBuffer(masterBuffer, MASTER_MAX_DIMENSION, masterFormat, MASTER_QUALITY);
            masterMimeType = getMimeTypeFromFormat(masterFormat, mimeType);
          }
        }
      } catch (resizeError: any) {
        console.error('Image metadata/resize error:', resizeError);
      }
    }

    const s3Config = checkS3Config();
    if (!s3Config.available) {
      return NextResponse.json(
        { error: `S3 config missing: ${s3Config.missing.join(', ')}` },
        { status: 500 }
      );
    }

    let s3Result: { url: string; key: string } | null = null;
    let s3Error: string | null = null;

    try {
      s3Result = await uploadToS3WithGroup(
        new Blob([new Uint8Array(masterBuffer)], { type: masterMimeType }),
        masterFileName,
        masterMimeType,
        user.id,
        groupId
      );
    } catch (s3UploadError: any) {
      console.warn('S3 master upload failed:', s3UploadError.message);
      s3Error = s3UploadError.message;
    }

    if (!s3Result) {
      return NextResponse.json(
        { error: 'S3 upload failed.', details: s3Error || 'Unknown error' },
        { status: 500 }
      );
    }

    let appUrl: string | null = null;

    if (isImage) {
      try {
        const appBuffer = await resizeImageBuffer(masterBuffer, APP_MAX_DIMENSION, masterFormat, APP_QUALITY);
        const appS3Key = generateAppS3KeyFromMasterKey(s3Result.key);
        const appUpload = await uploadToS3WithGroupAndKey(
          appBuffer,
          appS3Key,
          masterMimeType,
          user.id,
          groupId
        );
        appUrl = appUpload.url;
      } catch (appResizeError: any) {
        console.warn('App image generation failed:', appResizeError.message);
      }
    }

    const fileType = mimeType.startsWith('image/') ? 'photo' : 'video';
    
    // image_url은 필수 컬럼이므로 cloudinary_url 우선, 없으면 s3_original_url 사용
    const imageUrl = appUrl || s3Result?.url;
    
    if (!imageUrl) {
      // 환경 변수 정보 포함한 에러 메시지
      const errorDetails: string[] = [];
      if (cloudinaryError) errorDetails.push(`Cloudinary: ${cloudinaryError}`);
      if (s3Error) errorDetails.push(`S3: ${s3Error}`);
      
      return NextResponse.json(
        { 
          error: 'Cloudinary와 S3 업로드가 모두 실패했습니다.',
          details: errorDetails.join(' / '),
        },
        { status: 500 }
      );
    }
    
    // 서버 사이드용 Supabase 클라이언트 사용 (클라이언트용 supabase 대신)
    const supabaseServer = getSupabaseServerClient();
    
    const { data: memoryData, error: dbError } = await supabaseServer
      .from('memory_vault')
      .insert({
        uploader_id: user.id,
        group_id: groupId, // Multi-tenant: group_id 필수
        image_url: imageUrl, // 필수 컬럼: cloudinary_url 우선, 없으면 s3_original_url
        cloudinary_url: cloudinaryUrl || null,
        s3_original_url: s3Result?.url || null,
        file_type: fileType,
        original_file_size: originalSize || masterBuffer.length,
        cloudinary_public_id: cloudinaryPublicId || null,
        s3_key: s3Result?.key || null,
        mime_type: masterMimeType,
        original_filename: fileName,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase 저장 오류:', dbError);
      // 업로드는 성공했지만 DB 저장 실패 시에도 URL 반환
      return NextResponse.json({
        success: true,
        warning: '파일 업로드는 성공했지만 데이터베이스 저장에 실패했습니다.',
        cloudinaryUrl,
        s3Url: appUrl || s3Result?.url || null,
        s3Key: s3Result?.key || null,
        cloudinaryPublicId,
        s3Error: s3Error || null,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      cloudinaryUrl,
      s3Url: appUrl || s3Result?.url || null,
      s3Key: s3Result?.key || null,
      cloudinaryPublicId,
      fileType,
      s3Error: s3Error || null, // S3 업로드 실패 시 에러 메시지 포함
    });

  } catch (error: any) {
    console.error('업로드 오류:', error);
    return NextResponse.json(
      { error: error.message || '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

