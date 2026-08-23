import { normalizeGroupId } from '@/lib/validation';

export { normalizeGroupId } from '@/lib/validation';

export const CURRENT_GROUP_STORAGE_KEY = 'currentGroupId';

/** localStorage에서 정규화된 현재 그룹 ID */
export function readStoredGroupId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeGroupId(window.localStorage.getItem(CURRENT_GROUP_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** localStorage에 소문자 UUID만 저장. null이면 제거. */
export function writeStoredGroupId(groupId: string | null | undefined): string | null {
  if (typeof window === 'undefined') return normalizeGroupId(groupId);
  const normalized = normalizeGroupId(groupId);
  try {
    if (normalized) {
      window.localStorage.setItem(CURRENT_GROUP_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(CURRENT_GROUP_STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
  return normalized;
}

/** URL ?openGroup= 정규화 */
export function parseOpenGroupParam(
  search?: string | URLSearchParams | null,
): string | null {
  if (typeof window === 'undefined' && search == null) return null;
  try {
    const params =
      search instanceof URLSearchParams
        ? search
        : new URLSearchParams(
            search ?? (typeof window !== 'undefined' ? window.location.search : ''),
          );
    return normalizeGroupId(params.get('openGroup'));
  } catch {
    return null;
  }
}

/** 온보딩 → 대시보드: 선택 그룹을 URL에 실어 레이스 완화 */
export function dashboardHrefWithOpenGroup(groupId: string | null | undefined): string {
  const g = normalizeGroupId(groupId);
  if (!g) return '/dashboard';
  return `/dashboard?openGroup=${encodeURIComponent(g)}`;
}

/** 온보딩 ?openGroup= 우선, 없으면 localStorage */
export function getPinnedGroupId(): string | null {
  if (typeof window === 'undefined') return null;
  return parseOpenGroupParam() ?? readStoredGroupId();
}

export function findGroupById<T extends { id: string }>(
  groups: T[] | null | undefined,
  groupId: string | null | undefined,
): T | undefined {
  const normalized = normalizeGroupId(groupId);
  if (!normalized || !groups?.length) return undefined;
  return groups.find((g) => normalizeGroupId(g.id) === normalized);
}

/** 선택·URL·스토리지 그룹 우선, 없으면 목록 첫 항목 (반환도 소문자) */
export function resolvePreferredGroupId<T extends { id: string }>(
  groups: T[],
  hints?: { currentGroupId?: string | null; pinnedGroupId?: string | null },
): string | null {
  if (!groups.length) return null;
  const pinned =
    normalizeGroupId(hints?.pinnedGroupId) ??
    getPinnedGroupId() ??
    normalizeGroupId(hints?.currentGroupId);
  const matched = findGroupById(groups, pinned);
  if (matched) return normalizeGroupId(matched.id);
  return normalizeGroupId(groups[0]?.id);
}

export function sameGroupId(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeGroupId(a);
  const nb = normalizeGroupId(b);
  return Boolean(na && nb && na === nb);
}
