import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 시스템 관리자 세션이 아직 TOTP(AAL2)를 통과하지 않았는지.
 * 조회가 실패하면 false를 반환해 기존 로그인 이동을 유지한다.
 * 비관리자는 인증 수준을 조회하지 않는다.
 */
export async function systemAdminSessionNeedsMfa(
  client: SupabaseClient,
  isSystemAdmin: boolean,
): Promise<boolean> {
  if (!isSystemAdmin) return false;
  try {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data?.currentLevel) return false;
    return data.currentLevel === 'aal1';
  } catch {
    return false;
  }
}
