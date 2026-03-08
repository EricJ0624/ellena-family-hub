import { NextRequest, NextResponse } from 'next/server';
import { generatePublicAssetUrl } from '@/lib/api-helpers';

/**
 * 일반(normal) 업로드 이미지 표시용 프록시.
 * Cloudinary fetch URL로 302 리다이렉트 → CloudFront가 응답을 캐시(1년).
 * Cloudinary는 변환만 담당, 캐시 TTL 1달.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
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

  const sourceUrl = generatePublicAssetUrl(key);
  // Cloudinary fetch: w_2560,f_auto 등 변환 후 전달
  const fetchUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/w_2560,f_auto,q_auto/${encodeURIComponent(sourceUrl)}`;

  return NextResponse.redirect(fetchUrl, 302);
}
