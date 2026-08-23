/**
 * 공통 검증 유틸리티
 */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * UUID 형식 검증
 *
 * @param value - 검증할 문자열
 * @returns boolean - 유효한 UUID 여부
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * 앱 전역 그룹 ID 정규 형태: lowercase UUID.
 * 비교·localStorage·?openGroup=·상태에는 이 형태만 쓴다.
 */
export function normalizeGroupId(id: string | null | undefined): string | null {
  const trimmed = id?.trim().toLowerCase() ?? '';
  if (!trimmed || !UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

/**
 * Supabase RPC가 UUID를 문자열 또는 단일 요소 배열 등으로 반환할 수 있어 API/상태에 넣기 전 정규화합니다.
 */
export function normalizeGroupIdFromRpc(raw: unknown): string | null {
  if (typeof raw === 'string') {
    return normalizeGroupId(raw);
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    return normalizeGroupId(raw[0]);
  }
  return null;
}
