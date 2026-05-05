/**
 * 통합 일정·지도 툴팁 등 표시용. DB name/title은 자동완성 전체 줄일 수 있음 (저장 값 불변).
 * - 한글이 앞 구간에 있으면 첫 쉼표 앞을 장소명으로 봄.
 * - 구간 3개 이상·앞이 라틴일 때:
 *   - 마지막 구간이 국가명으로 보이면 → 첫 구간(영문 POI, 도시, 국가 순).
 *   - 첫 구간만 국가명으로 보이면 → 마지막 구간(국가, 도시, 상호 순 등).
 *   - 그 외 → 마지막 구간(랜드마크·상호가 끝에 있는 형태 보존).
 * - 구간 2개이고 뒤에만 한글이 있으면 뒤 구간 사용.
 */

/** 영문 국가/지역 꼬리 토큰 (자동완성 한 줄에서 구간 매칭용, 과도하게 넓히지 않음) */
const LIKELY_COUNTRY_SEGMENT = new Set(
  [
    'south korea',
    'north korea',
    'korea',
    'republic of korea',
    'japan',
    'china',
    'taiwan',
    'hong kong',
    'macau',
    'vietnam',
    'thailand',
    'philippines',
    'indonesia',
    'malaysia',
    'singapore',
    'united states',
    'usa',
    'u.s.a.',
    'united kingdom',
    'uk',
    'france',
    'germany',
    'italy',
    'spain',
    'australia',
    'new zealand',
    'canada',
    'mexico',
    'brazil',
    'india',
    'netherlands',
    'belgium',
    'switzerland',
    'austria',
    'sweden',
    'norway',
    'denmark',
    'finland',
    'poland',
    'turkey',
    'uae',
    'united arab emirates',
  ].map((s) => s.toLowerCase()),
);

function isLikelyCountrySegment(segment: string): boolean {
  const s = segment
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');
  if (!s || s.length > 48) return false;
  return LIKELY_COUNTRY_SEGMENT.has(s);
}

/** 교통 출발/도착에 저장된 formatted_address 등 — 표시만 첫 쉼표 앞(공항·역·도시 라벨)으로 줄임 */
export function shortTransportLegLabel(raw: string | null | undefined): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  const comma = s.indexOf(',');
  if (comma === -1) return s;
  const head = s.slice(0, comma).trim();
  return head || s;
}

/** 일정·PDF용 교통 한 줄 제목(저장 값과 별도 표시 전용) */
export function buildTransportItineraryTitle(
  departure: string | null | undefined,
  arrival: string | null | undefined,
): string {
  const d = shortTransportLegLabel(departure);
  const a = shortTransportLegLabel(arrival);
  if (d && a) return `${d} → ${a}`;
  return d || a || '';
}

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
  if (parts.length >= 3 && latinishHead) {
    if (isLikelyCountrySegment(last)) return first;
    if (isLikelyCountrySegment(first)) return last;
    return last;
  }
  if (parts.length === 2 && hasHangul(last) && !hasHangul(first)) return last;
  return first;
}
