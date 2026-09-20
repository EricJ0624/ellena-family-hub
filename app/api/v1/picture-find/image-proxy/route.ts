import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3ClientInstance } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  const cf =
    process.env.AWS_CLOUDFRONT_DOMAIN || process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || '';
  if (cf) {
    hosts.add(cf.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase());
  }
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = (process.env.AWS_REGION || 'ap-northeast-2').replace(/[^a-z0-9-]/gi, '');
  if (bucket) {
    hosts.add(`${bucket}.s3.${region}.amazonaws.com`.toLowerCase());
    hosts.add(`${bucket}.s3.amazonaws.com`.toLowerCase());
  }
  return hosts;
}

/**
 * Canvas tint 방지: CloudFront/S3 이미지를 same-origin으로 스트리밍.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const rawUrl = request.nextUrl.searchParams.get('url');
    if (!rawUrl) {
      return NextResponse.json({ error: 'url은 필수입니다.' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: '잘못된 URL입니다.' }, { status: 400 });
    }

    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'https URL만 허용됩니다.' }, { status: 400 });
    }

    const host = parsed.hostname.toLowerCase();
    if (!allowedHosts().has(host)) {
      return NextResponse.json({ error: '허용되지 않은 이미지 호스트입니다.' }, { status: 403 });
    }

    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!key || key.includes('..') || key.includes('\\')) {
      return NextResponse.json({ error: '잘못된 키입니다.' }, { status: 400 });
    }

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json({ error: 'AWS_S3_BUCKET_NAME이 필요합니다.' }, { status: 500 });
    }

    const s3 = getS3ClientInstance();
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    if (!result.Body) {
      return NextResponse.json({ error: '이미지를 가져올 수 없습니다.' }, { status: 404 });
    }

    const bytes = await result.Body.transformToByteArray();
    const contentType = result.ContentType || 'image/jpeg';

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[picture-find/image-proxy]', error);
    return NextResponse.json({ error: '이미지 프록시 실패' }, { status: 500 });
  }
}
