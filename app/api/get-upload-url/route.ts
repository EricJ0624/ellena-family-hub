import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '@/lib/supabase';

// AWS S3 클라이언트 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

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
    const { fileName, mimeType, fileSize } = body;

    if (!fileName || !mimeType) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 체크 (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다. (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    // S3 Key 생성
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const fileType = mimeType.startsWith('image/') ? 'photos' : 'videos';
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const s3Key = `originals/${fileType}/${year}/${month}/${user.id}/${uniqueId}.${fileExtension}`;

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Presigned URL 생성 (15분 유효)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: mimeType,
      ACL: 'private', // 보안: private로 설정
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900, // 15분
    });

    // S3 URL 생성 (업로드 후 접근용)
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      success: true,
      presignedUrl,
      s3Key,
      s3Url,
      expiresIn: 900, // 15분
    });

  } catch (error: any) {
    console.error('Presigned URL 생성 오류:', error);
    return NextResponse.json(
      { error: error.message || 'Presigned URL 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

