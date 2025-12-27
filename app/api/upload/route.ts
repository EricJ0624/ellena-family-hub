import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { supabase } from '@/lib/supabase';

// Next.js App Router: 큰 파일 업로드를 위한 설정
// Vercel에서는 최대 4.5MB 제한이 있으므로, 
// 프로덕션에서는 chunked 업로드나 presigned URL 방식을 고려해야 할 수 있습니다.
export const maxDuration = 60; // 60초 타임아웃

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// AWS S3 클라이언트 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Base64를 Blob으로 변환
function base64ToBlob(base64: string, mimeType: string): Blob {
  const base64Data = base64.split(',')[1] || base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// S3에 파일 업로드
async function uploadToS3(
  file: Blob,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<{ url: string; key: string }> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const fileType = mimeType.startsWith('image/') ? 'photos' : 'videos';
  const fileExtension = fileName.split('.').pop() || 'jpg';
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const s3Key = `originals/${fileType}/${year}/${month}/${userId}/${uniqueId}.${fileExtension}`;

  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

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
  const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

  return { url: s3Url, key: s3Key };
}

// Cloudinary에 파일 업로드
async function uploadToCloudinary(
  file: Blob,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<{ url: string; publicId: string }> {
  const fileType = mimeType.startsWith('image/') ? 'image' : 'video';
  const folder = `family-memories/${userId}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: fileType === 'image' ? 'image' : 'video',
        transformation: fileType === 'image' 
          ? [
              { width: 1920, height: 1920, crop: 'limit', quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          : [
              { quality: 'auto', fetch_format: 'auto' }
            ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Cloudinary 업로드 결과가 없습니다.'));
        }
      }
    );

    // Blob을 Buffer로 변환하여 업로드
    file.arrayBuffer()
      .then(buffer => {
        const nodeBuffer = Buffer.from(buffer);
        uploadStream.end(nodeBuffer);
      })
      .catch(reject);
  });
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // Supabase 세션 확인
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증에 실패했습니다.' },
        { status: 401 }
      );
    }

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

