import type { Session, SupabaseClient } from '@supabase/supabase-js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 짧은 TTL — 동시/연속 REST 호출이 각각 getSession 폴링을 반복하지 않도록 */
const SESSION_CACHE_TTL_MS = 2500;

let cachedSession: Session | null = null;
let cachedUntil = 0;
let inFlightWait: Promise<Session | null> | null = null;
let inFlightClient: SupabaseClient | null = null;

function readCachedSession(): Session | null {
  if (cachedSession?.access_token && Date.now() < cachedUntil) {
    return cachedSession;
  }
  return null;
}

function storeCachedSession(session: Session | null): Session | null {
  if (session?.access_token) {
    cachedSession = session;
    cachedUntil = Date.now() + SESSION_CACHE_TTL_MS;
    return session;
  }
  return null;
}

/** 로그아웃 등 세션 무효화 시 호출(선택). TTL 만료만으로도 대부분 충분하다. */
export function invalidateSupabaseSessionCache(): void {
  cachedSession = null;
  cachedUntil = 0;
}

/**
 * PostgREST(RLS) 조회 전에 access_token이 붙은 세션이 준비됐는지 확인한다.
 * 동시에 여러 훅/로더가 호출해도 in-flight 1회 + 짧은 캐시로 폴링 중복을 줄인다.
 */
export async function waitForSupabaseSession(
  client: SupabaseClient,
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<Session | null> {
  const hit = readCachedSession();
  if (hit) return hit;

  const maxWaitMs = options?.maxWaitMs ?? 8000;
  const pollMs = options?.pollMs ?? 120;

  if (inFlightWait && inFlightClient === client) {
    return inFlightWait;
  }

  inFlightClient = client;
  inFlightWait = (async () => {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session?.access_token) {
        return storeCachedSession(session);
      }
      await sleep(pollMs);
    }

    return null;
  })();

  try {
    return await inFlightWait;
  } finally {
    inFlightWait = null;
    inFlightClient = null;
  }
}
