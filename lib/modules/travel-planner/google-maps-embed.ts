/**
 * 구글 지도 웹 링크 + Maps Embed(iframe).
 * 링크·Embed는 Maps Platform 과금 없음. Static Maps / JS Maps 는 쓰지 않는다.
 */

export type GoogleMapsPlaceRef = {
  title?: string | null;
  address?: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 구글 지도 웹(소비자용) 링크 — Maps Platform 과금 없음. */
export function buildGoogleMapsViewUrl(item: GoogleMapsPlaceRef): string | null {
  const pid = typeof item.place_id === 'string' ? item.place_id.trim() : '';
  const label = typeof item.title === 'string' ? item.title.trim() : '';
  const addr = typeof item.address === 'string' ? item.address.trim() : '';
  const textQuery = [label, addr].filter(Boolean).join(' ').trim();
  const lat = toNum(item.latitude);
  const lng = toNum(item.longitude);
  const coordQuery = lat != null && lng != null ? `${lat},${lng}` : '';

  if (pid) {
    const query = textQuery || coordQuery || pid;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(pid)}`;
  }
  if (textQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textQuery)}`;
  }
  if (lat != null && lng != null) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return null;
}

function mapsApiKey(): string {
  return (
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY : undefined) || ''
  ).trim();
}

export function canShowDiaryPlaceMap(
  item: GoogleMapsPlaceRef,
  sourceKind?: string | null,
): boolean {
  if (sourceKind === 'transport') return false;
  const addr = typeof item.address === 'string' ? item.address.trim() : '';
  return Boolean(buildGoogleMapsViewUrl(item) || addr);
}

/**
 * Maps Embed API iframe src. 키 없거나 위치 정보 없으면 null.
 * 좌표가 있으면 그 지점, 없으면 이름·주소 검색. 무제한 무료 SKU.
 */
export function buildMapsEmbedUrl(
  item: GoogleMapsPlaceRef,
  opts?: { language?: string; zoom?: number },
): string | null {
  const apiKey = mapsApiKey();
  if (!apiKey) return null;

  const lat = toNum(item.latitude);
  const lng = toNum(item.longitude);
  const addr = typeof item.address === 'string' ? item.address.trim() : '';
  const pid = typeof item.place_id === 'string' ? item.place_id.trim() : '';
  const label = typeof item.title === 'string' ? item.title.trim() : '';
  const zoom = Math.min(Math.max(opts?.zoom ?? 13, 3), 21);

  let q = '';
  if (lat != null && lng != null) {
    q = `${lat},${lng}`;
  } else if (pid) {
    q = `place_id:${pid}`;
  } else if (addr) {
    q = addr;
  } else if (label) {
    q = label;
  }
  if (!q) return null;

  const params = new URLSearchParams();
  params.set('key', apiKey);
  params.set('q', q);
  params.set('zoom', String(zoom));
  params.set('maptype', 'roadmap');
  const language = opts?.language?.trim();
  if (language) params.set('language', language);

  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}
