/**
 * 출생 스냅샷 표시/파싱 헬퍼.
 * PostgREST는 numeric을 문자열로 줄 수 있어 차트·표시 전에 숫자로 정규화한다.
 */

export function formatBirthTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.slice(0, 5);
}

export function asFiniteNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
