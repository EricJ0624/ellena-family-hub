import type { AuthError, Session, SupabaseClient, User } from '@supabase/supabase-js';

/** WebKit·모바일에서 Supabase GoTrue 요청이 끊길 때 흔히 나오는 메시지 */
export function isTransientAuthNetworkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  if (!msg) return false;
  if (msg.includes('invalid jwt')) return false;
  if (msg.includes('jwt expired')) return false;
  if (msg.includes('refresh token')) return false;
  if (msg.includes('session not found')) return false;
  if (msg.includes('invalid refresh token')) return false;
  if (msg.includes('load failed')) return true;
  if (msg.includes('failed to fetch')) return true;
  if (msg.includes('networkerror')) return true;
  if (msg.includes('network request failed')) return true;
  if (msg.includes('econnreset')) return true;
  if (msg.includes('etimedout')) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * getUser()는 네트워크 일시 실패 시에도 에러를 줄 수 있다(iOS Safari `TypeError: Load failed`).
 * 짧게 재시도한 뒤에도 동일하면, 로컬 getSession()에 사용자가 있을 때만 session.user로 한 번 완화한다.
 * (삭제된 계정은 이후 RLS/API에서 막히는 편이며, 무한 로그인 루프를 막는 것이 목적)
 */
export async function getValidatedUserWithSessionFallback(
  supabase: SupabaseClient,
  session: Session | null
): Promise<{ user: User | null; error: AuthError | null }> {
  let lastError: AuthError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user && !error) {
      return { user, error: null };
    }
    lastError = error;
    if (error && !isTransientAuthNetworkError(error)) {
      return { user: null, error };
    }
    if (attempt < 2) {
      if (attempt === 1) {
        await supabase.auth.refreshSession().catch(() => undefined);
      }
      await sleep(350 * (attempt + 1));
    }
  }
  if (session?.user && lastError && isTransientAuthNetworkError(lastError)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[auth] getUser failed after retries (transient); using session.user');
    }
    return { user: session.user, error: null };
  }
  return { user: null, error: lastError };
}
