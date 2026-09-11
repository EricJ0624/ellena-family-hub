import { NextRequest, NextResponse } from 'next/server';
import { generatePublicAssetUrl } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';

/**
 * 일반(normal) 업로드 이미지 표시용 (레거시 호환).
 * Cloudinary 제거: CloudFront → S3 직달 URL로 302만 수행.
 * <img src>는 Authorization 헤더를 못 보내므로 멤버십 Bearer 강제 불가.
 * 키 path traversal만 차단하고, debug 모드는 인증 필수.
 */
function sanitizeS3Key(raw: string): string | null {
  let key = raw;
  try {
    while (key.includes('%')) {
      const decoded = decodeURIComponent(key);
      if (decoded === key) break;
      key = decoded;
    }
  } catch {
    // 디코딩 실패 시 원본 유지
  }

  if (!key || key.includes('..') || key.includes('\0') || key.startsWith('/') || key.includes('\\')) {
    return null;
  }
  return key;
}

export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get('debug') === '1';
  if (debug) {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
  }

  const rawKey = request.nextUrl.searchParams.get('key');
  if (!rawKey || typeof rawKey !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  const key = sanitizeS3Key(rawKey);
  if (!key) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 });
  }

  const redirectUrl = generatePublicAssetUrl(key);

  if (debug) {
    return NextResponse.json({
      key,
      redirectUrl,
      hint: '브라우저에서 redirectUrl을 열어 200/403/404 등 상태와 응답을 확인하세요.',
    });
  }

  return NextResponse.redirect(redirectUrl, 302);
}
