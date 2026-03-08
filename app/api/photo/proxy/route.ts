import { NextRequest, NextResponse } from 'next/server';
import { generatePublicAssetUrl } from '@/lib/api-helpers';

/**
 * 일반(normal) 업로드 이미지 표시용 프록시.
 * - CLOUDFRONT_IMAGE_DOMAIN 있음: 302 → CloudFront /api/photo/serve?key=... (캐시 미스 시 CF가 /api/photo/serve 호출).
 * - 없음: 302 → Cloudinary fetch URL (기존 동작, 하위 호환).
 */
export async function GET(request: NextRequest) {
  let key = request.nextUrl.searchParams.get('key');
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  // 이중 인코딩 보정: %2F 등이 남아 있으면 디코딩해서 실제 s3Key로 만든 뒤, 리다이렉트 시 한 번만 인코딩
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
        hint: 'Set AWS_CLOUDFRONT_DOMAIN or NEXT_PUBLIC_CLOUDFRONT_DOMAIN on Vercel (e.g. d1bjjw198g1fxc.cloudfront.net). Without it, the proxy uses direct S3 URL and Cloudinary gets 401.',
      },
      { status: 503 }
    );
  }

  const imageDomain =
    process.env.CLOUDFRONT_IMAGE_DOMAIN ||
    process.env.AWS_CLOUDFRONT_IMAGE_DOMAIN;
  if (imageDomain) {
    const normalized = imageDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const cloudFrontUrl = `https://${normalized}/api/photo/serve?key=${encodeURIComponent(key)}`;
    return NextResponse.redirect(cloudFrontUrl, 302);
  }

  const sourceUrl = generatePublicAssetUrl(key);
  const fetchUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/w_2560,f_auto,q_auto/${encodeURIComponent(sourceUrl)}`;
  return NextResponse.redirect(fetchUrl, 302);
}
