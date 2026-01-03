import { NextRequest, NextResponse } from 'next/server';
import { Upload } from '@aws-sdk/lib-storage';
import { supabase } from '@/lib/supabase';
import { 
  authenticateUser, 
  base64ToBlob, 
  uploadToCloudinary, 
  getS3ClientInstance, 
  generateS3Key, 
  generateS3Url 
} from '@/lib/api-helpers';

// Next.js App Router: 큰 파일 업로드를 위한 설정
// ⚠️ 중요: Vercel에서는 최대 4.5MB 제한이 있습니다.
// Base64 인코딩 시 원본의 약 1.33배 크기 증가하므로,
// 실제로는 약 3MB 파일도 Base64로 변환하면 4.5MB를 초과할 수 있습니다.
// 따라서 서버 경유 방식은 3MB 이하 파일만 허용하는 것이 안전합니다.
export const maxDuration = 60; // 60초 타임아웃

// S3에 파일 업로드
async function uploadToS3(
  file: Blob,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<{ url: string; key: string }> {
  const s3Key = generateS3Key(fileName, mimeType, userId);
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

  const s3Client = getS3ClientInstance();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: s3Key,
      Body: file,
      ContentType: mimeType,
      ACL: 'private', // 보안: private로 설정
    },
  });

  await upload.done();

  // S3 URL 생성
  const s3Url = generateS3Url(s3Key);

  return { url: s3Url, key: s3Key };
}

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
      resizedData, // 리사이징된 Base64 (Cloudinary용)
      fileName,
      mimeType,
      originalSize,
    } = body;

    if (!originalData || !fileName || !mimeType) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
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

    // 1. Cloudinary에 리사이징된 이미지 업로드 (표시용)
    // resizedData가 있으면 리사이징된 이미지 사용, 없으면 원본 사용
    const cloudinaryData = resizedData || originalData;
    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';
    let cloudinaryError: string | null = null;
    
    // Cloudinary 환경 변수 체크
    const { checkCloudinaryConfig } = await import('@/lib/api-helpers');
    const cloudinaryConfig = checkCloudinaryConfig();
    
    if (cloudinaryConfig.available) {
      try {
        const cloudinaryBlob = base64ToBlob(cloudinaryData, mimeType);
        const cloudinaryResult = await uploadToCloudinary(
          cloudinaryBlob,
          fileName,
          mimeType,
          user.id
        );
        cloudinaryUrl = cloudinaryResult.url;
        cloudinaryPublicId = cloudinaryResult.publicId;
      } catch (cloudinaryError: any) {
        console.error('Cloudinary 업로드 오류:', cloudinaryError);
        cloudinaryError = cloudinaryError?.message || 'Cloudinary 업로드 실패';
        // Cloudinary 업로드 실패해도 S3 업로드는 계속 진행
      }
    } else {
      cloudinaryError = `Cloudinary 환경 변수가 설정되지 않았습니다: ${cloudinaryConfig.missing.join(', ')}`;
      console.warn(cloudinaryError);
    }

    // 2. AWS S3에 원본 파일 업로드 (선택적)
    const originalBlob = base64ToBlob(originalData, mimeType);
    let s3Result: { url: string; key: string } | null = null;
    let s3Error: string | null = null;
    
    // S3 환경 변수 체크
    const { checkS3Config } = await import('@/lib/api-helpers');
    const s3Config = checkS3Config();
    
    if (s3Config.available) {
      try {
        s3Result = await uploadToS3(
          originalBlob,
          fileName,
          mimeType,
          user.id
        );
      } catch (s3UploadError: any) {
        console.warn('S3 업로드 실패 (Cloudinary만 사용):', s3UploadError.message);
        s3Error = s3UploadError.message;
        // S3 업로드 실패해도 Cloudinary가 있으면 계속 진행
      }
    } else {
      s3Error = `S3 환경 변수가 설정되지 않았습니다: ${s3Config.missing.join(', ')}`;
      console.warn(s3Error);
      // S3는 선택적이므로 계속 진행
    }

    // 3. Supabase memory_vault 테이블에 저장
    const fileType = mimeType.startsWith('image/') ? 'photo' : 'video';
    
    // image_url은 필수 컬럼이므로 cloudinary_url 우선, 없으면 s3_original_url 사용
    const imageUrl = cloudinaryUrl || s3Result?.url;
    
    if (!imageUrl) {
      // 환경 변수 정보 포함한 에러 메시지
      const errorDetails: string[] = [];
      if (cloudinaryError) errorDetails.push(`Cloudinary: ${cloudinaryError}`);
      if (s3Error) errorDetails.push(`S3: ${s3Error}`);
      
      return NextResponse.json(
        { 
          error: 'Cloudinary와 S3 업로드가 모두 실패했습니다.',
          details: errorDetails.join(' / '),
          cloudinaryConfig: cloudinaryConfig,
          s3Config: s3Config,
        },
        { status: 500 }
      );
    }
    
    const { data: memoryData, error: dbError } = await supabase
      .from('memory_vault')
      .insert({
        uploader_id: user.id,
        image_url: imageUrl, // 필수 컬럼: cloudinary_url 우선, 없으면 s3_original_url
        cloudinary_url: cloudinaryUrl || null,
        s3_original_url: s3Result?.url || null,
        file_type: fileType,
        original_file_size: originalSize || originalBlob.size,
        cloudinary_public_id: cloudinaryPublicId || null,
        s3_key: s3Result?.key || null,
        mime_type: mimeType,
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
        s3Url: s3Result?.url || null,
        s3Key: s3Result?.key || null,
        cloudinaryPublicId,
        s3Error: s3Error || null,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      cloudinaryUrl,
      s3Url: s3Result?.url || null,
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

