import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { supabase } from '@/lib/supabase';

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

// S3에서 파일 다운로드 (Cloudinary 업로드용)
async function downloadFromS3(s3Key: string): Promise<Blob> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error('S3에서 파일을 가져올 수 없습니다.');
  }

  // Stream을 Blob으로 변환
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return new Blob([buffer]);
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

    const body = await request.json();
    const { 
      s3Key,
      s3Url,
      fileName,
      mimeType,
      originalSize,
      resizedData, // 리사이징된 이미지 (Base64, 선택적)
    } = body;

    if (!s3Key || !s3Url || !fileName || !mimeType) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 1. Cloudinary에 리사이징된 이미지 업로드 (표시용)
    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';
    
    try {
      let cloudinaryBlob: Blob;
      
      if (resizedData) {
        // 리사이징된 이미지가 있으면 사용
        const base64Data = resizedData.split(',')[1] || resizedData;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        cloudinaryBlob = new Blob([byteArray], { type: mimeType });
      } else {
        // 리사이징된 이미지가 없으면 S3에서 원본 다운로드
        cloudinaryBlob = await downloadFromS3(s3Key);
      }

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
      // Cloudinary 업로드 실패해도 Supabase 저장은 계속 진행
    }

    // 2. Supabase memory_vault 테이블에 저장
    const fileType = mimeType.startsWith('image/') ? 'photo' : 'video';
    
    const { data: memoryData, error: dbError } = await supabase
      .from('memory_vault')
      .insert({
        uploader_id: user.id,
        cloudinary_url: cloudinaryUrl || null,
        s3_original_url: s3Url,
        file_type: fileType,
        original_file_size: originalSize || null,
        cloudinary_public_id: cloudinaryPublicId || null,
        s3_key: s3Key,
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
        s3Url,
        s3Key,
        cloudinaryPublicId,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      cloudinaryUrl,
      s3Url,
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

