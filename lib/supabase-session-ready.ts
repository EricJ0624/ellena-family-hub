import type { Session, SupabaseClient } from '@supabase/supabase-js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PostgREST(RLS) 조회 전에 access_token이 붙은 세션이 준비됐는지 확인한다.
 * 서버 /api/auth/login → setSession 직후 대시보드 진입 시 REST가 JWT 없이 나가 0건·빈 위젯이 되는 레이스를 줄인다.
 */
export async function waitForSupabaseSession(
  client: SupabaseClient,
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<Session | null> {
  const maxWaitMs = options?.maxWaitMs ?? 8000;
  const pollMs = options?.pollMs ?? 120;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session?.access_token) return session;
    await sleep(pollMs);
  }

  return null;
}
