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
 * Supabase RPC가 UUID를 문자열 또는 단일 요소 배열 등으로 반환할 수 있어 API/상태에 넣기 전 정규화합니다.
 */
export function normalizeGroupIdFromRpc(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    return UUID_REGEX.test(t) ? t : null;
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    const t = raw[0].trim().toLowerCase();
    return UUID_REGEX.test(t) ? t : null;
  }
  return null;
}
