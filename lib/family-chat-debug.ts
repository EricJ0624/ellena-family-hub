/**
 * 채팅 디버그 로그 — 콘솔이 지나치게 지저분해지지 않도록 기본 OFF.
 *
 * 사용법:
 * 1) 프로젝트 루트 `.env.local` 에 다음 추가 후 dev 서버 재시작
 *    NEXT_PUBLIC_DEBUG_FAMILY_CHAT=1
 * 2) Chrome DevTools → Console → 상단 필터에 `[FamilyChat]` 입력
 * 3) (권장) 같은 화면에서 "Preserve log" 체크 → 새로고침/이동 시 로그 유지
 */
export const isFamilyChatDebug =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_FAMILY_CHAT === '1';

export function familyChatDebug(...args: unknown[]): void {
  if (isFamilyChatDebug) {
    console.info('[FamilyChat]', ...args);
  }
}
