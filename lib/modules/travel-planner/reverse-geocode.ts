/**
 * Server-side reverse geocode via Google Geocoding API.
 * Uses NEXT_PUBLIC_GOOGLE_MAP_API_KEY; returns null on any failure.
 */

export async function reverseGeocodeLatLng(
  latitude: number,
  longitude: number,
): Promise<string | null> {
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
      results?: Array<{ formatted_address?: string }>;
    } | null;
    if (!json || json.status !== 'OK' || !Array.isArray(json.results) || json.results.length === 0) {
      return null;
    }
    const addr = json.results[0]?.formatted_address;
    return typeof addr === 'string' && addr.trim() ? addr.trim() : null;
  } catch {
    return null;
  }
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
