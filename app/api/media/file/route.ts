import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { generatePublicAssetUrl, getS3ClientInstance } from '@/lib/api-helpers';
import { resolveCloudFrontSigner, signCloudFrontUrl } from '@/lib/cloudfront-signed-url';
import { verifyMediaFileToken } from '@/lib/media-access-token';

function privateCacheControl(exp: string): string {
  const remaining = Math.max(0, Number(exp) - Math.floor(Date.now() / 1000));
  return `private, max-age=${remaining}`;
}

async function readFromS3(s3Key: string, exp: string): Promise<NextResponse> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    return NextResponse.json({ error: '파일 저장소가 설정되지 않았습니다.' }, { status: 500 });
  }
  const response = await getS3ClientInstance().send(
    new GetObjectCommand({ Bucket: bucketName, Key: s3Key }),
  );
  if (!response.Body) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }
  const bytes = await response.Body.transformToByteArray();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': response.ContentType || 'application/octet-stream',
      'Cache-Control': privateCacheControl(exp),
    },
  });
}

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

  const cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN || process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;
  if (cloudfrontDomain) {
    const unsignedUrl = generatePublicAssetUrl(s3Key);
    const signer = resolveCloudFrontSigner();
    if (signer === 'incomplete') {
      console.error('CloudFront 서명 설정이 절반만 있습니다. 키 ID와 개인키가 모두 있어야 합니다.');
      return NextResponse.json({ error: '파일을 불러오지 못했습니다.' }, { status: 500 });
    }
    let location = unsignedUrl;
    if (signer) {
      try {
        location = signCloudFrontUrl(unsignedUrl, Number(exp), signer.keyPairId, signer.privateKeyPem);
      } catch (error) {
        console.error('CloudFront 서명 주소 발급 오류:', error);
        return NextResponse.json({ error: '파일을 불러오지 못했습니다.' }, { status: 500 });
      }
    }
    const redirect = NextResponse.redirect(location, 302);
    redirect.headers.set('Cache-Control', privateCacheControl(exp));
    return redirect;
  }

  try {
    return await readFromS3(s3Key, exp);
  } catch (error) {
    console.error('미디어 파일 조회 오류:', error);
    return NextResponse.json({ error: '파일을 불러오지 못했습니다.' }, { status: 404 });
  }
}
