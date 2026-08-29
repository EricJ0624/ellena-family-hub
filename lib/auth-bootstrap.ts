import type { AuthBootstrapPayload } from '@/lib/auth-bootstrap-server';
import { resolveSuspendRedirect } from '@/lib/account-suspend-access';
import { normalizeGroupId } from '@/lib/validation';
import { sameGroupId } from '@/lib/group-id-resolve';

export type { AuthBootstrapPayload };
export type { BootstrapGroupSummary, BootstrapMembershipRole } from '@/lib/auth-bootstrap-server';

export type AuthLoginSuccess = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: {
    id: string;
    email: string | null;
    email_confirmed_at: string | null;
  };
  bootstrap: AuthBootstrapPayload;
};

const CACHE_KEY_PREFIX = 'SFH_AUTH_BOOTSTRAP_';
/** 탭 내 짧은 캐시 */
const CACHE_TTL_MS = 60_000;
/** 로그인 유지 재진입용(localStorage) — 권한 변경은 백그라운드 갱신으로 맞춤 */
const RESTORE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedBootstrap = {
  savedAt: number;
  payload: AuthBootstrapPayload;
};

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

function readBootstrapFromStorage(
  storage: Storage,
  userId: string,
  maxAgeMs: number,
): AuthBootstrapPayload | null {
  try {
    const raw = storage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBootstrap;
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      storage.removeItem(cacheKey(userId));
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export function getCachedAuthBootstrap(userId: string): AuthBootstrapPayload | null {
  if (typeof window === 'undefined') return null;
  return (
    readBootstrapFromStorage(sessionStorage, userId, CACHE_TTL_MS) ||
    readBootstrapFromStorage(localStorage, userId, RESTORE_CACHE_TTL_MS)
  );
}

export function setCachedAuthBootstrap(userId: string, payload: AuthBootstrapPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CachedBootstrap = { savedAt: Date.now(), payload };
    const raw = JSON.stringify(entry);
    sessionStorage.setItem(cacheKey(userId), raw);
    localStorage.setItem(cacheKey(userId), raw);
  } catch {
    // ignore quota / private mode
  }
}

/** 그룹 생성·가입 등 멤버십 변경 후 stale bootstrap 제거 */
export function invalidateCachedAuthBootstrap(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(cacheKey(userId));
    localStorage.removeItem(cacheKey(userId));
  } catch {
    // ignore
  }
}

/** 캐시 무효화 후 API에서 최신 bootstrap을 받아 저장 */
export async function refreshAuthBootstrapCache(
  accessToken: string,
  userId: string,
): Promise<AuthBootstrapPayload | null> {
  invalidateCachedAuthBootstrap(userId);
  const fresh = await fetchAuthBootstrap(accessToken);
  if (fresh) setCachedAuthBootstrap(userId, fresh);
  return fresh;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** 로그인 critical path — Next API 1회 (PostgREST 큐 밖). */
export async function fetchAuthBootstrap(accessToken: string): Promise<AuthBootstrapPayload | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('/api/auth/bootstrap', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (response.ok) {
        return (await response.json()) as AuthBootstrapPayload;
      }
      if (response.status === 401) return null;
    } catch {
      // 네트워크 일시 오류 — 1회 재시도
    }
    if (attempt === 0) await sleep(280);
  }
  return null;
}

export async function fetchAuthBootstrapWithCache(
  accessToken: string,
  userId: string,
): Promise<AuthBootstrapPayload | null> {
  const cached = getCachedAuthBootstrap(userId);
  if (cached) return cached;
  const fresh = await fetchAuthBootstrap(accessToken);
  if (fresh) setCachedAuthBootstrap(userId, fresh);
  return fresh;
}

/**
 * 같은 출처로 password grant + bootstrap을 한 번에 받는다.
 * 모바일→Supabase Auth cross-origin 끊김·이중 round-trip을 제거한다.
 */
export async function loginViaServerApi(
  email: string,
  password: string,
): Promise<
  | { ok: true; data: AuthLoginSuccess }
  | { ok: false; status: number; code?: string; message: string }
> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    const json = (await response.json().catch(() => null)) as
      | (AuthLoginSuccess & { error?: string; code?: string; message?: string })
      | null;

    if (!response.ok || !json?.access_token || !json?.refresh_token || !json?.bootstrap) {
      return {
        ok: false,
        status: response.status,
        code: json?.code || json?.error,
        message: String(json?.message || json?.error || 'login_failed'),
      };
    }

    setCachedAuthBootstrap(json.user.id, json.bootstrap);
    return { ok: true, data: json };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'login_failed',
    };
  }
}

/** bootstrap → 정지 리다이렉트. lookupFailed면 null(진입 차단 안 함). */
export function resolveAuthBootstrapSuspendRedirect(
  bootstrap: AuthBootstrapPayload,
  options?: { openGroup?: string | null; savedGroupId?: string | null },
): string | null {
  if (bootstrap.lookupFailed) return null;
  return resolveSuspendRedirect(
    {
      groupIds: bootstrap.groupIds,
      accessibleGroupIds: bootstrap.accessibleGroupIds,
      suspendedGroupIds: bootstrap.suspendedGroupIds,
      lookupFailed: false,
    },
    options,
  );
}

/** bootstrap에 openGroup이 포함돼 있으면 멤버십 REST 없이 hasGroups 확정 */
export function bootstrapConfirmsOpenGroup(
  bootstrap: AuthBootstrapPayload,
  openGroup: string,
): boolean {
  const normalized = normalizeGroupId(openGroup);
  if (!normalized) return false;
  return bootstrap.groupIds.some((id) => sameGroupId(id, normalized));
}
