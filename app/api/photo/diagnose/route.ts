import { NextRequest, NextResponse } from 'next/server';
import {
  checkS3ObjectExists,
  generatePublicAssetUrl,
} from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';

/**
 * 일반 업로드 이미지 깨짐 진단: 업로드(S3) vs 표시(CloudFront) 구분
 * GET /api/photo/diagnose?key=<s3Key>
 * Authorization 필수 (비로그인 키 존재 여부 스캔 방지)
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;

  const key = request.nextUrl.searchParams.get('key');
  if (!key || typeof key !== 'string') {
    return NextResponse.json(
      { error: 'key is required', usage: '/api/photo/diagnose?key=<s3_key>' },
      { status: 400 }
    );
  }

  if (key.includes('..') || key.includes('\0') || key.startsWith('/')) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 });
  }

  try {
    const [s3Exists, cloudfrontStatus] = await Promise.all([
      checkS3ObjectExists(key),
      (async () => {
        const url = generatePublicAssetUrl(key);
        try {
          const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
          return res.status;
        } catch {
          return -1;
        }
      })(),
    ]);

    const summary =
      !s3Exists
        ? '업로드 실패 또는 잘못된 키: S3에 파일이 없습니다.'
        : cloudfrontStatus === 200
          ? '업로드·표시 모두 정상. CloudFront에서 200 응답.'
          : cloudfrontStatus === 401 || cloudfrontStatus === 403
            ? '업로드는 됐으나 표시 실패: CloudFront/S3가 401/403 반환. S3 버킷 정책(OAC) 확인 필요.'
            : `CloudFront 응답: ${cloudfrontStatus} (네트워크 오류 시 -1)`;

    return NextResponse.json({
      key,
      s3Exists,
      cloudfrontStatus,
      cloudfrontUrl: generatePublicAssetUrl(key),
      summary,
    });
  } catch (e) {
    console.error('photo/diagnose error', e);
    return NextResponse.json(
      { error: '진단 중 오류', details: String(e) },
      { status: 500 }
    );
  }
}
