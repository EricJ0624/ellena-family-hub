import { NextRequest, NextResponse } from 'next/server';
import { generatePublicAssetUrl } from '@/lib/api-helpers';

/**
 * 일반(normal) 업로드 이미지 스트리밍.
 * Cloudinary fetch → 200 + 바디 반환. CloudFront Origin으로 쓰여 캐시 미스 시 1회만 호출됨.
 * GET /api/photo/serve?key=<s3_key>
 */
export async function GET(request: NextRequest) {
  let key = request.nextUrl.searchParams.get('key');
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  // 이중 인코딩 보정: CloudFront 경유 시 key가 %2F 등으로 남을 수 있음 → 실제 s3Key로 정규화
  try {
    while (key.includes('%')) {
      const decoded = decodeURIComponent(key);
      if (decoded === key) break;
      key = decoded;
    }
  } catch {
    // 디코딩 실패 시 원본 유지
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return NextResponse.json(
      { error: 'Cloudinary not configured' },
      { status: 503 }
    );
  }

  const cfDomain =
    process.env.AWS_CLOUDFRONT_DOMAIN ||
    process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;
  if (!cfDomain) {
    return NextResponse.json(
      {
        error: 'CloudFront domain not configured',
        hint: 'Set AWS_CLOUDFRONT_DOMAIN or NEXT_PUBLIC_CLOUDFRONT_DOMAIN.',
      },
      { status: 503 }
    );
  }

  const sourceUrl = generatePublicAssetUrl(key);
  const fetchUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/w_2560,f_auto,q_auto/${encodeURIComponent(sourceUrl)}`;

  const imageResponse = await fetch(fetchUrl);
  if (!imageResponse.ok) {
    console.error('Cloudinary fetch failed:', imageResponse.status, key);
    return NextResponse.json(
      { error: 'Image fetch failed', status: imageResponse.status },
      { status: imageResponse.status >= 400 ? 502 : 502 }
    );
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new NextResponse(imageResponse.body, {
    status: 200,
    headers,
  });
}
