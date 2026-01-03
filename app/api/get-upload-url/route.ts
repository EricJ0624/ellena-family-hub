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

    // AWS 자격 증명 검증
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION;
    
    if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
      const missing = [];
      if (!awsAccessKeyId) missing.push('AWS_ACCESS_KEY_ID');
      if (!awsSecretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');
      if (!awsRegion) missing.push('AWS_REGION');
      
      console.error('AWS 자격 증명 누락:', missing);
      return NextResponse.json(
        { 
          error: 'AWS 자격 증명이 설정되지 않았습니다.',
          missing: missing,
          details: '환경 변수를 확인해주세요.'
        },
        { status: 500 }
      );
    }

    // AWS Access Key ID 형식 검증 (일반적으로 20자)
    if (awsAccessKeyId.length < 16 || awsAccessKeyId.length > 128) {
      console.error('AWS_ACCESS_KEY_ID 형식이 올바르지 않습니다:', awsAccessKeyId.length, '자');
      return NextResponse.json(
        { 
          error: 'AWS_ACCESS_KEY_ID 형식이 올바르지 않습니다.',
          details: 'Access Key ID는 일반적으로 20자입니다.'
        },
        { status: 500 }
      );
    }

    // Presigned URL 생성 (15분 유효)
    let presignedUrl: string;
    try {
      const s3Client = getS3ClientInstance();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ContentType: mimeType,
        ACL: 'private', // 보안: private로 설정
      });

      presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 900, // 15분
      });
    } catch (s3Error: any) {
      console.error('Presigned URL 생성 중 S3 오류:', {
        error: s3Error.message,
        code: s3Error.code,
        name: s3Error.name,
        stack: s3Error.stack?.substring(0, 200),
      });
      
      // AWS SDK 에러 코드별 메시지
      if (s3Error.code === 'CredentialsError' || s3Error.name === 'CredentialsError') {
        return NextResponse.json(
          { 
            error: 'AWS 자격 증명 오류',
            details: 'AWS_ACCESS_KEY_ID와 AWS_SECRET_ACCESS_KEY를 확인해주세요.'
          },
          { status: 500 }
        );
      }
      
      if (s3Error.code === 'InvalidRegion' || s3Error.message?.includes('region')) {
        return NextResponse.json(
          { 
            error: 'AWS 리전 오류',
            details: `AWS_REGION이 올바른지 확인해주세요. (현재: ${awsRegion})`
          },
          { status: 500 }
        );
      }
      
      throw s3Error;
    }

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
    // 상세한 에러 정보 로깅
    console.error('Presigned URL 생성 오류:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack?.substring(0, 300),
    });
    
    // 에러 타입별 상세 메시지
    let errorMessage = error.message || 'Presigned URL 생성 중 오류가 발생했습니다.';
    let errorDetails: any = {};
    
    // AWS SDK 에러 처리
    if (error.name === 'CredentialsError' || error.code === 'CredentialsError') {
      errorMessage = 'AWS 자격 증명 오류: 환경 변수를 확인해주세요.';
      errorDetails = {
        missing: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
        hint: '환경 변수가 올바르게 설정되었는지 확인하세요.'
      };
    } else if (error.name === 'InvalidRegion' || error.code === 'InvalidRegion') {
      errorMessage = `AWS 리전 오류: ${process.env.AWS_REGION || '설정되지 않음'}`;
      errorDetails = {
        currentRegion: process.env.AWS_REGION,
        hint: 'AWS_REGION이 올바른 형식인지 확인하세요. (예: ap-southeast-2)'
      };
    } else if (error.message?.includes('AWS')) {
      errorMessage = `AWS 설정 오류: ${error.message}`;
      errorDetails = {
        originalError: error.message
      };
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

