/**
 * 통합 일정·지도 툴팁 등 표시용. DB name/title은 자동완성 전체 줄일 수 있음 (저장 값 불변).
 * - 한글이 앞 구간에 있으면 첫 쉼표 앞을 장소명으로 봄.
 * - 국가·도시가 앞(라틴)이고 구간이 3개 이상이면 마지막 구간(예: 에펠타워)을 표시.
 * - 구간 2개이고 뒤에만 한글이 있으면 뒤 구간 사용.
 */
export function shortItineraryTitle(
  type: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other',
  title: string,
  address?: string | null,
): string {
  const t = (title || '').trim();
  if (!t) return t;
  if (type === 'transport' || type === 'other') return t;
  const addr = typeof address === 'string' ? address.trim() : '';
  if (!addr) return t;
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return t;

  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const hasHangul = (s: string) => /[\uAC00-\uD7A3\u3131-\u3163]/.test(s);
  const latinishHead = /^[A-Za-zÀ-ÿ0-9\s.'’-]+$/u.test(first);

  if (hasHangul(first)) return first;
  if (parts.length >= 3 && latinishHead && last) return last;
  if (parts.length === 2 && hasHangul(last) && !hasHangul(first)) return last;
  return first;
}
