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
