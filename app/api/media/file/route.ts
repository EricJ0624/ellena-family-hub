import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3ClientInstance } from '@/lib/api-helpers';
import { verifyMediaFileToken } from '@/lib/media-access-token';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('k');
  const exp = request.nextUrl.searchParams.get('e');
  const sig = request.nextUrl.searchParams.get('s');
  if (!key || !exp || !sig) {
    return NextResponse.json({ error: '열 수 없는 파일입니다.' }, { status: 403 });
  }

  const s3Key = verifyMediaFileToken(key, exp, sig);
  if (!s3Key) {
    return NextResponse.json({ error: '열 수 없는 파일입니다.' }, { status: 403 });
  }

  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    return NextResponse.json({ error: '파일 저장소가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const response = await getS3ClientInstance().send(
      new GetObjectCommand({ Bucket: bucketName, Key: s3Key }),
    );
    if (!response.Body) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }
    const bytes = await response.Body.transformToByteArray();
    const remaining = Math.max(0, Number(exp) - Math.floor(Date.now() / 1000));
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Cache-Control': `private, max-age=${Math.min(remaining, 300)}`,
      },
    });
  } catch (error) {
    console.error('미디어 파일 조회 오류:', error);
    return NextResponse.json({ error: '파일을 불러오지 못했습니다.' }, { status: 404 });
  }
}
