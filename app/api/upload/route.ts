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
// Vercel에서는 최대 4.5MB 제한이 있으므로, 
// 프로덕션에서는 chunked 업로드나 presigned URL 방식을 고려해야 할 수 있습니다.
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

    // Body 크기 체크 (Base64 인코딩 고려하여 약 20MB 제한)
    const MAX_BODY_SIZE = 20 * 1024 * 1024; // 20MB
    
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
    const estimatedSize = (originalData.length * 3) / 4;
    if (estimatedSize > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다. (최대 ${MAX_BODY_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    // 1. Cloudinary에 리사이징된 이미지 업로드 (표시용)
    // resizedData가 있으면 리사이징된 이미지 사용, 없으면 원본 사용
    const cloudinaryData = resizedData || originalData;
    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';
    
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
      // Cloudinary 업로드 실패해도 S3 업로드는 계속 진행
    }

    // 2. AWS S3에 원본 파일 업로드
    const originalBlob = base64ToBlob(originalData, mimeType);
    const s3Result = await uploadToS3(
      originalBlob,
      fileName,
      mimeType,
      user.id
    );

    // 3. Supabase memory_vault 테이블에 저장
    const fileType = mimeType.startsWith('image/') ? 'photo' : 'video';
    
    const { data: memoryData, error: dbError } = await supabase
      .from('memory_vault')
      .insert({
        uploader_id: user.id,
        cloudinary_url: cloudinaryUrl || null,
        s3_original_url: s3Result.url,
        file_type: fileType,
        original_file_size: originalSize || originalBlob.size,
        cloudinary_public_id: cloudinaryPublicId || null,
        s3_key: s3Result.key,
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
        s3Url: s3Result.url,
        s3Key: s3Result.key,
        cloudinaryPublicId,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      cloudinaryUrl,
      s3Url: s3Result.url,
      s3Key: s3Result.key,
      cloudinaryPublicId,
      fileType,
    });

  } catch (error: any) {
    console.error('업로드 오류:', error);
    return NextResponse.json(
      { error: error.message || '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

