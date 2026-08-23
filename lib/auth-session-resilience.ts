import type { AuthError, Session, SupabaseClient, User } from '@supabase/supabase-js';

/** WebKit·모바일에서 Supabase GoTrue 요청이 끊길 때 흔히 나오는 메시지 */
export function isTransientAuthNetworkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  const name = String((err as { name?: string })?.name ?? '').toLowerCase();
  if (!msg && !name) return false;
  if (msg.includes('invalid jwt')) return false;
  if (msg.includes('jwt expired')) return false;
  if (msg.includes('refresh token')) return false;
  if (msg.includes('session not found')) return false;
  if (msg.includes('invalid refresh token')) return false;
  if (msg.includes('invalid login credentials')) return false;
  if (msg.includes('load failed')) return true;
  if (msg.includes('failed to fetch')) return true;
  if (msg.includes('networkerror')) return true;
  if (msg.includes('network request failed')) return true;
  if (msg.includes('fetch failed')) return true;
  if (msg.includes('the internet connection appears to be offline')) return true;
  if (msg.includes('econnreset')) return true;
  if (msg.includes('etimedout')) return true;
  if (msg.includes('aborted') && !msg.includes('user')) return true;
  if (name === 'typeerror' && (msg.includes('load') || msg.includes('fetch') || msg.includes('network'))) {
    return true;
  }
  return false;
}

/**
 * iOS Chrome/Safari에서 password grant가 OPTIONS만 되고 POST 응답이 끊기는 경우가 있어
 * 일시 네트워크 오류 시 짧게 재시도한다. 비밀번호 오인·rate limit은 재시도하지 않는다.
 */
export async function signInWithPasswordResilient(
  supabase: SupabaseClient,
  credentials: { email: string; password: string },
): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }> {
  let lastError: AuthError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await supabase.auth.signInWithPassword(credentials);
      if (!result.error) {
        return result;
      }
      lastError = result.error;
      if (!isTransientAuthNetworkError(result.error)) {
        return result;
      }
    } catch (err) {
      if (!isTransientAuthNetworkError(err)) {
        throw err;
      }
      lastError = err as AuthError;
    }

    // POST가 서버에서 성공했는데 클라이언트만 실패한 경우 세션이 이미 있을 수 있음
    await sleep(280 + attempt * 220);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      return { data: { user: session.user, session }, error: null };
    }
  }
  return { data: { user: null, session: null }, error: lastError };
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
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user && !error) {
      return { user, error: null };
    }
    lastError = error;
    if (error && !isTransientAuthNetworkError(error)) {
      return { user: null, error };
    }
    if (attempt < 1) {
      await sleep(250);
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
