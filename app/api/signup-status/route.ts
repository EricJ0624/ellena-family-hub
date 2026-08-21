import { NextResponse } from 'next/server';
import { loadSignupAvailability } from '@/lib/signup-settings-query';

export const dynamic = 'force-dynamic';

/**
 * 로그인/가입 화면용. 인증 없이 allowed 여부만 반환 (인원 수 비공개).
 * 조회 실패 시 가입을 열어 둔다 (fail-open). 실제 차단은 DB 트리거가 담당.
 */
export async function GET() {
  try {
    const availability = await loadSignupAvailability();
    return NextResponse.json(
      {
        allowed: availability.allowed,
        reason: availability.reason,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('가입 상태 조회 오류:', error);
    return NextResponse.json(
      {
        allowed: true,
        reason: 'ok',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
