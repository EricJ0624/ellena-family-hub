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

/** 지도 아래 표시용 — 위도, 경도. 없거나 무효면 null. */
export function formatPlaceCoords(
  item: Pick<GoogleMapsPlaceRef, 'latitude' | 'longitude'>,
  digits = 6,
): string | null {
  const lat = toNum(item.latitude);
  const lng = toNum(item.longitude);
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

/** 구글 지도 웹(소비자용) 링크 — Maps Platform 과금 없음. */
export function buildGoogleMapsViewUrl(item: GoogleMapsPlaceRef): string | null {
  const pid = typeof item.place_id === 'string' ? item.place_id.trim() : '';
  const label = typeof item.title === 'string' ? item.title.trim() : '';
  const addr = typeof item.address === 'string' ? item.address.trim() : '';
  const textQuery = [label, addr].filter(Boolean).join(' ').trim();
  const lat = toNum(item.latitude);
  const lng = toNum(item.longitude);

  // Field check-in / GPS: always pin exact saved coordinates (never "current location" or address search drift)
  if (lat != null && lng != null) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (pid) {
    const query = textQuery || pid;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(pid)}`;
  }
  if (textQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textQuery)}`;
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
  _sourceKind?: string | null,
): boolean {
  const addr = typeof item.address === 'string' ? item.address.trim() : '';
  return Boolean(buildGoogleMapsViewUrl(item) || addr);
}

/**
 * Maps Embed API iframe src. 키 없거나 위치 정보 없으면 null.
 * 좌표가 있으면 view+center로 저장 좌표에 고정(검색/현재위치 재해석 방지).
 * 없으면 이름·주소·place_id 검색. 무제한 무료 SKU.
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
  const zoom = Math.min(Math.max(opts?.zoom ?? 15, 3), 21);

  const params = new URLSearchParams();
  params.set('key', apiKey);
  params.set('zoom', String(zoom));
  params.set('maptype', 'roadmap');
  const language = opts?.language?.trim();
  if (language) params.set('language', language);

  // Exact GPS pin: view mode centers on saved coords (no place-search / device location)
  if (lat != null && lng != null) {
    params.set('center', `${lat},${lng}`);
    return `https://www.google.com/maps/embed/v1/view?${params.toString()}`;
  }

  let q = '';
  if (pid) {
    q = `place_id:${pid}`;
  } else if (addr) {
    q = addr;
  } else if (label) {
    q = label;
  }
  if (!q) return null;

  params.set('q', q);
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}
