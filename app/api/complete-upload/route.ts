import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  checkCloudinaryConfig,
  downloadFromS3,
  downloadFromUrl,
  generateAppS3KeyFromMasterKey,
  getImageMetadata,
  getMimeTypeFromFormat,
  getSupabaseServerClient,
  resizeImageBuffer,
  uploadToCloudinaryWithGroup,
  uploadToS3WithGroupAndKey,
} from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { 
      s3Key,
      s3Url,
      fileName,
      mimeType,
      originalSize,
      resizedData, // 리사이징된 이미지 (Base64, 선택적)
      forceCloudinary,
      groupId, // 그룹 ID (선택적, 있으면 권한 검증)
    } = body;

    if (!s3Key || !s3Url || !fileName || !mimeType) {
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

    // 1. Build master and app images
    const isImage = mimeType.startsWith('image/');
    const MASTER_MAX_DIMENSION = 2560;
    const APP_MAX_DIMENSION = 1920;
    const APP_QUALITY = 85;
    const MASTER_QUALITY = 90;

    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';

    let masterBuffer: Buffer | null = null;
    let masterMimeType = mimeType;
    let masterFormat = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'jpg');

    if (isImage) {
      try {
        const originalBlob = await downloadFromS3(s3Key);
        const originalBuffer = Buffer.from(await originalBlob.arrayBuffer());
        masterBuffer = originalBuffer;

        const metadata = await getImageMetadata(originalBuffer);
        const maxDimension = Math.max(metadata.width || 0, metadata.height || 0);

        if (forceCloudinary || maxDimension > MASTER_MAX_DIMENSION) {
          const cloudinaryConfig = checkCloudinaryConfig();
          if (cloudinaryConfig.available) {
            try {
              const cloudinaryBlob = new Blob([new Uint8Array(originalBuffer)], { type: mimeType });
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
            } catch (cloudinaryUploadError: any) {
              console.error('Cloudinary master transform error:', cloudinaryUploadError);
            }
          }

          if (!cloudinaryUrl && masterBuffer) {
            masterBuffer = await resizeImageBuffer(masterBuffer, MASTER_MAX_DIMENSION, masterFormat, MASTER_QUALITY);
            masterMimeType = getMimeTypeFromFormat(masterFormat, mimeType);
          }

          if (masterBuffer) {
            await uploadToS3WithGroupAndKey(masterBuffer, s3Key, masterMimeType, user.id, groupId);
          }
        }
      } catch (imageError: any) {
        console.error('Image processing error:', imageError);
      }
    }

    let appUrl: string | null = null;
    if (isImage && masterBuffer) {
      try {
        const appBuffer = await resizeImageBuffer(masterBuffer, APP_MAX_DIMENSION, masterFormat, APP_QUALITY);
        const appS3Key = generateAppS3KeyFromMasterKey(s3Key);
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
    const imageUrl = appUrl || s3Url;
    
    // 서버 사이드용 Supabase 클라이언트 사용 (RLS 정책 우회)
    const supabaseServer = getSupabaseServerClient();
    
    const { data: memoryData, error: dbError } = await supabaseServer
      .from('memory_vault')
      .insert({
        uploader_id: user.id,
        group_id: groupId, // Multi-tenant: group_id 필수
        image_url: imageUrl, // 필수 컬럼: cloudinary_url 우선, 없으면 s3_original_url
        cloudinary_url: cloudinaryUrl || null,
        s3_original_url: s3Url,
        file_type: fileType,
        original_file_size: originalSize || null,
        cloudinary_public_id: cloudinaryPublicId || null,
        s3_key: s3Key,
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
        s3Url: appUrl || s3Url,
        s3Key,
        cloudinaryPublicId,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      cloudinaryUrl,
      s3Url: appUrl || s3Url,
      s3Key,
      cloudinaryPublicId,
      fileType,
    });

  } catch (error: any) {
    console.error('업로드 완료 처리 오류:', error);
    return NextResponse.json(
      { error: error.message || '업로드 완료 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}



