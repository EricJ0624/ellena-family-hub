/**
 * Server-side reverse geocode via Google Geocoding API.
 * Uses NEXT_PUBLIC_GOOGLE_MAP_API_KEY; returns null on any failure.
 */

type GeocodeResult = {
  formatted_address?: string;
  address_components?: Array<{ short_name?: string; types?: string[] }>;
};

async function fetchGeocodeResults(
  latitude: number,
  longitude: number,
): Promise<GeocodeResult[] | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = (process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || '').trim();
  if (!key) return null;

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', key);
    url.searchParams.set('language', 'ko');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      status?: string;
      results?: GeocodeResult[];
    } | null;
    if (!json || json.status !== 'OK' || !Array.isArray(json.results) || json.results.length === 0) {
      return null;
    }
    return json.results;
  } catch {
    return null;
  }
}

export async function reverseGeocodeLatLng(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const results = await fetchGeocodeResults(latitude, longitude);
  const addr = results?.[0]?.formatted_address;
  return typeof addr === 'string' && addr.trim() ? addr.trim() : null;
}

/** ISO 3166-1 alpha-2 from the same geocode result, or null when unknown. */
export async function reverseGeocodeCountryCode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const results = await fetchGeocodeResults(latitude, longitude);
  if (!results) return null;
  for (const result of results) {
    for (const component of result.address_components ?? []) {
      if (!component.types?.includes('country')) continue;
      const code = String(component.short_name ?? '').trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) return code;
    }
  }
  return null;
}

/** Build default field-record title with local time. */
export function buildFieldRecordTitle(
  kind: 'checkin' | 'route',
  startHm: string,
  endHm?: string | null,
): string {
  const start = String(startHm || '').trim().substring(0, 5);
  const end = endHm ? String(endHm).trim().substring(0, 5) : '';
  if (kind === 'route') {
    if (start && end && end !== start) return `경로 기록 ${start}–${end}`;
    if (start) return `경로 기록 ${start}`;
    return '경로 기록';
  }
  return start ? `위치 기록 ${start}` : '위치 기록';
}
