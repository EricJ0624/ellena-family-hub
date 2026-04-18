import type { SupabaseClient } from '@supabase/supabase-js';

/** sessionStorage 키: 초대 코드 (로그인·콜백·온보딩 공통) */
export const INVITE_CODE_SESSION_STORAGE_KEY = 'SFH_INVITE_CODE';

const INVITE_CODE_FORMAT = /^[0-9A-Za-z]{1,20}$/;

export function isValidInviteCodeFormat(value: string): boolean {
  return INVITE_CODE_FORMAT.test(value.trim());
}

export function getSessionStoredInviteCode(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(INVITE_CODE_SESSION_STORAGE_KEY)?.trim() ?? '';
  if (!raw || !isValidInviteCodeFormat(raw)) return null;
  return raw;
}

export function setSessionStoredInviteCode(code: string): void {
  if (typeof window === 'undefined') return;
  const t = code.trim();
  if (!isValidInviteCodeFormat(t)) return;
  try {
    window.sessionStorage.setItem(INVITE_CODE_SESSION_STORAGE_KEY, t);
  } catch {
    // ignore
  }
}

export function clearSessionStoredInviteCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(INVITE_CODE_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** `?invite=` / `?invite_code=` 중 유효한 값만 */
export function getInviteCodeFromSearchParams(params: URLSearchParams): string | null {
  const raw = params.get('invite')?.trim() || params.get('invite_code')?.trim() || '';
  if (!raw || !isValidInviteCodeFormat(raw)) return null;
  return raw;
}

/**
 * URL 쿼리 우선, 없으면 sessionStorage.
 * (클라이언트에서만 동작; `params`가 없으면 storage만)
 */
export function resolveInviteFromUrlOrSession(
  params: URLSearchParams | null | undefined
): string | null {
  const fromParams = params ? getInviteCodeFromSearchParams(params) : null;
  if (fromParams) return fromParams;
  return getSessionStoredInviteCode();
}

/** 온보딩 라우트 (초대는 `invite` 쿼리로 통일) */
export function buildOnboardingPath(invite: string | null | undefined): string {
  const v = invite?.trim();
  if (v && isValidInviteCodeFormat(v)) {
    return `/onboarding?invite=${encodeURIComponent(v)}`;
  }
  return '/onboarding';
}

export type ResolveUserHasGroupsResult = {
  hasGroups: boolean;
};

/**
 * 멤버십 또는 소유 그룹 존재 여부.
 * `flakyRetry`: 쿼리 오류이거나 비시스템관리자인데 그룹이 없으면 짧게 대기 후 1회 재조회.
 */
export async function resolveUserHasGroups(
  supabase: SupabaseClient,
  userId: string,
  options?: { flakyRetry?: boolean; isSystemAdmin?: boolean }
): Promise<ResolveUserHasGroupsResult> {
  const isSystemAdmin = options?.isSystemAdmin ?? false;
  const flakyRetry = options?.flakyRetry ?? false;

  const fetchPair = async () => {
    const [mRes, oRes] = await Promise.all([
      supabase.from('memberships').select('group_id').eq('user_id', userId).limit(1),
      supabase.from('groups').select('id').eq('owner_id', userId).limit(1),
    ]);
    const hasGroups =
      Boolean(mRes.data && mRes.data.length > 0) || Boolean(oRes.data && oRes.data.length > 0);
    return { hasGroups, membershipsError: mRes.error, ownedGroupsError: oRes.error };
  };

  let { hasGroups, membershipsError, ownedGroupsError } = await fetchPair();

  if (flakyRetry && (membershipsError || ownedGroupsError || (!isSystemAdmin && !hasGroups))) {
    if (membershipsError || ownedGroupsError) {
      console.warn('그룹 확인 쿼리 오류(재확인 시도):', {
        membershipsError,
        ownedGroupsError,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    const second = await fetchPair();
    hasGroups = second.hasGroups;
  }

  return { hasGroups };
}
