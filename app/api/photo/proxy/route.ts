import { NextRequest, NextResponse } from 'next/server';
import { generatePublicAssetUrl } from '@/lib/api-helpers';

/**
 * 일반(normal) 업로드 이미지 표시용 (레거시 호환).
 * Cloudinary 제거: CloudFront → S3 직달 URL로 302만 수행.
 * 기존 DB에 /api/photo/proxy?key=... 로 저장된 행은 이 경로로 접근 시 CloudFront 직링크로 리다이렉트.
 */
export async function GET(request: NextRequest) {
  let key = request.nextUrl.searchParams.get('key');
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  const debug = request.nextUrl.searchParams.get('debug') === '1';

  try {
    while (key.includes('%')) {
      const decoded = decodeURIComponent(key);
      if (decoded === key) break;
      key = decoded;
    }
  } catch {
    // 디코딩 실패 시 원본 유지
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
