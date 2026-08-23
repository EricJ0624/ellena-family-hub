import { isValidUUID } from '@/lib/validation';

/** 그룹 ID 비교·스토리지 조회용 (대소문자 통일) */
export function normalizeGroupId(id: string | null | undefined): string | null {
  const trimmed = id?.trim().toLowerCase() ?? '';
  if (!trimmed || !isValidUUID(trimmed)) return null;
  return trimmed;
}

/** 온보딩 ?openGroup= 우선, 없으면 localStorage */
export function getPinnedGroupId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromUrl = normalizeGroupId(new URLSearchParams(window.location.search).get('openGroup'));
    if (fromUrl) return fromUrl;
    return normalizeGroupId(window.localStorage.getItem('currentGroupId'));
  } catch {
    return normalizeGroupId(window.localStorage.getItem('currentGroupId'));
  }
}

export function findGroupById<T extends { id: string }>(
  groups: T[] | null | undefined,
  groupId: string | null | undefined,
): T | undefined {
  const normalized = normalizeGroupId(groupId);
  if (!normalized || !groups?.length) return undefined;
  return groups.find((g) => g.id.toLowerCase() === normalized);
}

/** 선택·URL·스토리지 그룹 우선, 없으면 목록 첫 항목 */
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
  if (matched) return matched.id;
  return groups[0]?.id ?? null;
}
