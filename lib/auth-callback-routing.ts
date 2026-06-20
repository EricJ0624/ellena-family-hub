/** auth callback URL에서 recovery(비밀번호 재설정) 진입 여부 */
export function isRecoveryAuthCallback(
  hashParams: URLSearchParams,
  searchParams: URLSearchParams
): boolean {
  const type = (hashParams.get('type') || searchParams.get('type') || '').trim();
  return type === 'recovery';
}
