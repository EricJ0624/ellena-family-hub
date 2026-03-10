import { NextRequest, NextResponse } from 'next/server';

/**
 * 일반(normal) 업로드 이미지 표시용.
 * 이미지를 직접 반환하지 않고, CloudFront URL로 302 Redirect만 수행.
 * 구조: S3 → Cloudinary(변환) → CloudFront(캐시·배포).
 */
export async function GET(request: NextRequest) {
  let key = request.nextUrl.searchParams.get('key');
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  // 이중 인코딩 보정: %2F 등이 남아 있으면 디코딩 후 리다이렉트 시 한 번만 인코딩
  try {
    while (key.includes('%')) {
      const decoded = decodeURIComponent(key);
      if (decoded === key) break;
      key = decoded;
    }
  } catch {
    // 디코딩 실패 시 원본 유지
  }

  const cfDomain =
    process.env.AWS_CLOUDFRONT_DOMAIN ||
    process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;
  if (!cfDomain) {
    return NextResponse.json(
      {
        error: 'CloudFront domain not configured',
        hint: 'Set AWS_CLOUDFRONT_DOMAIN or NEXT_PUBLIC_CLOUDFRONT_DOMAIN on Vercel.',
      },
      { status: 503 }
    );
  }

  const normalized = cfDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const encodedKey = encodeURIComponent(key);
  const cloudFrontUrl = `https://${normalized}/image/upload/f_auto,q_auto,w_2560/${encodedKey}`;
  return NextResponse.redirect(cloudFrontUrl, 302);
}
