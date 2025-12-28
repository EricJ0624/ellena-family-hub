import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { 
  authenticateUser, 
  getS3ClientInstance, 
  generateS3Key, 
  generateS3Url 
} from '@/lib/api-helpers';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { fileName, mimeType, fileSize } = body;

    if (!fileName || !mimeType) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // RAW 파일 확장자 목록
    const rawExtensions = ['raw', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'dng', 'raf', 'srw', '3fr', 'ari', 'bay', 'crw', 'cap', 'data', 'dcs', 'dcr', 'drf', 'eip', 'erf', 'fff', 'iiq', 'k25', 'kdc', 'mef', 'mos', 'mrw', 'nrw', 'obm', 'pef', 'ptx', 'pxn', 'r3d', 'rwl', 'rwz', 'sr2', 'srf', 'tif', 'x3f'];
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    const isRawFile = rawExtensions.includes(fileExtension);

    // 파일 크기 제한 체크
    // RAW 파일은 리사이징 불가능하므로 크기 제한을 더 크게 설정
    const MAX_FILE_SIZE = isRawFile 
      ? 100 * 1024 * 1024  // RAW 파일: 100MB (리사이징 불가능하므로 여유있게)
      : 50 * 1024 * 1024;  // 일반 파일: 50MB
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다. (${isRawFile ? 'RAW 파일' : '일반 파일'} 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    // S3 Key 생성
    const s3Key = generateS3Key(fileName, mimeType, user.id);

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Presigned URL 생성 (15분 유효)
    const s3Client = getS3ClientInstance();
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
    const s3Url = generateS3Url(s3Key);

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

