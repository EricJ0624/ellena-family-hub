import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/validation';

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
 * `flakyRetry`: 쿼리 오류이거나 그룹이 없을 때 짧은 백오프로 재조회(로그인 직후 JWT 반영 지연 대비).
 * `isSystemAdmin`은 호환용으로 유지되며, 재시도 정책에는 더 이상 사용하지 않는다.
 */
export async function resolveUserHasGroups(
  supabase: SupabaseClient,
  userId: string,
  options?: { flakyRetry?: boolean; isSystemAdmin?: boolean }
): Promise<ResolveUserHasGroupsResult> {
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

  // 로그인 직후 JWT가 PostgREST에 반영되기 전에 빈 결과가 나오는 경우가 있어,
  // 시스템 관리자 여부와 관계없이 "그룹 없음"·쿼리 오류일 때는 짧은 백오프로 여러 번 재시도한다.
  if (flakyRetry) {
    // 최초 1회 + 추가 2회: 무그룹 신규 가입자 체감 지연을 최소화하면서도 일시적 빈 결과를 흡수
    const maxExtraAttempts = 2;
    for (let attempt = 0; attempt < maxExtraAttempts; attempt++) {
      const needRetry =
        Boolean(membershipsError || ownedGroupsError) || !hasGroups;
      if (!needRetry) break;
      if (membershipsError || ownedGroupsError) {
        console.warn('그룹 확인 쿼리 오류(재확인 시도):', {
          attempt,
          membershipsError,
          ownedGroupsError,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 280 + attempt * 220));
      const next = await fetchPair();
      hasGroups = next.hasGroups;
      membershipsError = next.membershipsError;
      ownedGroupsError = next.ownedGroupsError;
    }
  }

  // 온보딩에서 선택 직후 /dashboard 로 넘어올 때, 전역 limit(1) 조회가 잠깐 비는 레이스가 있어도
  // localStorage의 currentGroupId가 실제 멤버십·소유와 일치하면 그룹 있음으로 본다.
  if (!hasGroups && typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('currentGroupId')?.trim().toLowerCase() ?? '';
    if (saved && isValidUUID(saved)) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const [mRow, oRow] = await Promise.all([
        supabase.from('memberships').select('group_id').eq('user_id', userId).eq('group_id', saved).maybeSingle(),
        supabase.from('groups').select('id').eq('id', saved).eq('owner_id', userId).maybeSingle(),
      ]);
      if (!mRow.error && mRow.data) {
        return { hasGroups: true };
      }
      if (!oRow.error && oRow.data) {
        return { hasGroups: true };
      }
    }
  }

  return { hasGroups };
}
