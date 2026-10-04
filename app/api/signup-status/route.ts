import { NextResponse } from 'next/server';
import { CURRENT_APP_ID } from '@/lib/apps';
import { countQualifiedBetaTesters } from '@/lib/beta-testers';
import { loadSignupAvailability } from '@/lib/signup-settings-query';

export const dynamic = 'force-dynamic';

/**
 * 로그인/가입 화면용. 인증 없이 현재 앱의 가입 가능 여부와 베타 자격 인원을 반환한다.
 * 인원 조회 실패 시 숫자만 빠지고 가입은 열어 둔다 (fail-open). 실제 차단은 enrollment RPC가 담당.
 */
export async function GET() {
  try {
    const availability = await loadSignupAvailability();
    let betaTesterCount: number | null = null;
    try {
      betaTesterCount = await countQualifiedBetaTesters(CURRENT_APP_ID);
    } catch (countError) {
      console.error('베타 테스터 인원 조회 오류:', countError);
    }
    return NextResponse.json(
      {
        allowed: availability.allowed,
        reason: availability.reason,
        // 베타 배너 표시 여부 판정용 (null=무제한, 100 이하=베타 페이즈)
        signupMaxUsers: availability.signupMaxUsers ?? null,
        // 표시 전용. 가입 차단은 enrollment 한도가 그대로 담당한다.
        betaTesterCount,
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
