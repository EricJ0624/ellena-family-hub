import type { AuthBootstrapPayload } from '@/lib/auth-bootstrap-server';
import { resolveSuspendRedirect } from '@/lib/account-suspend-access';

export type { AuthBootstrapPayload };
export type { BootstrapGroupSummary, BootstrapMembershipRole } from '@/lib/auth-bootstrap-server';

const CACHE_KEY_PREFIX = 'SFH_AUTH_BOOTSTRAP_';
const CACHE_TTL_MS = 8000;

type CachedBootstrap = {
  savedAt: number;
  payload: AuthBootstrapPayload;
};

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

export function getCachedAuthBootstrap(userId: string): AuthBootstrapPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBootstrap;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(userId));
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export function setCachedAuthBootstrap(userId: string, payload: AuthBootstrapPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CachedBootstrap = { savedAt: Date.now(), payload };
    sessionStorage.setItem(cacheKey(userId), JSON.stringify(entry));
  } catch {
    // ignore quota / private mode
  }
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
  const normalized = openGroup.trim().toLowerCase();
  if (!normalized) return false;
  return bootstrap.groupIds.some((id) => id.toLowerCase() === normalized);
}
