/** middleware(PR-2)용 로그인 힌트 쿠키. 실제 세션 검증은 클라이언트 가드(PR-3)에서 수행. */
export const AUTH_PRESENCE_COOKIE = 'sfh-auth';

const MAX_AGE_SEC = 60 * 60 * 24 * 400;

export function setAuthPresenceCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_PRESENCE_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SEC}`;
}

export function clearAuthPresenceCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_PRESENCE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}
