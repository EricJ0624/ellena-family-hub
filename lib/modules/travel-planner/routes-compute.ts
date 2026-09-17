/**
 * Google Routes API (v2) with OSRM fallback for road-following polylines.
 * Google often fails when the browser API key does not allow Routes/Roads
 * (project APIs enabled ≠ key API restrictions).
 */

import type { FieldTrackLatLng } from '@/lib/modules/travel-planner/field-track-path';

function decodeGooglePolyline(encoded: string): FieldTrackLatLng[] {
  const coordinates: FieldTrackLatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coordinates;
}

function toLatLngLiteral(p: FieldTrackLatLng) {
  return { latitude: p.lat, longitude: p.lng };
}

export type ComputeRouteOptions = {
  /** Forward browser Referer so HTTP-referrer API key restrictions pass */
  referer?: string | null;
  travelMode?: 'WALK' | 'DRIVE';
};

/** OpenStreetMap OSRM — no Google key needed */
async function computeOsrmPath(
  points: FieldTrackLatLng[],
  profile: 'foot' | 'driving' = 'foot',
): Promise<FieldTrackLatLng[]> {
  if (points.length < 2) return [];
  // OSRM public demo: keep request small
  const limited =
    points.length <= 25
      ? points
      : [
          points[0]!,
          ...points
            .slice(1, -1)
            .filter((_, i) => i % Math.ceil((points.length - 2) / 23) === 0)
            .slice(0, 23),
          points[points.length - 1]!,
        ];
  const coords = limited.map((p) => `${p.lng},${p.lat}`).join(';');
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/${coords}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as {
    code?: string;
    routes?: Array<{ geometry?: { coordinates?: number[][] } }>;
  };
  if (json.code !== 'Ok') return [];
  const ring = json.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(ring) || ring.length < 2) return [];
  const out: FieldTrackLatLng[] = [];
  for (const pair of ring) {
    const lng = Number(pair?.[0]);
    const lat = Number(pair?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ lat, lng });
  }
  return out.length >= 2 ? out : [];
}

async function computeGoogleRoutesPath(
  points: FieldTrackLatLng[],
  apiKey: string,
  opts?: ComputeRouteOptions,
): Promise<FieldTrackLatLng[]> {
  if (!apiKey || points.length < 2) return [];

  const origin = points[0]!;
  const destination = points[points.length - 1]!;
  const mids = points.slice(1, -1);
  const maxWp = 23;
  const step = mids.length <= maxWp ? 1 : Math.ceil(mids.length / maxWp);
  const intermediates = mids
    .filter((_, i) => i % step === 0)
    .slice(0, maxWp)
    .map((p) => ({ location: { latLng: toLatLngLiteral(p) } }));

  const travelMode = opts?.travelMode ?? 'WALK';
  const body: Record<string, unknown> = {
    origin: { location: { latLng: toLatLngLiteral(origin) } },
    destination: { location: { latLng: toLatLngLiteral(destination) } },
    travelMode,
    polylineQuality: 'HIGH_QUALITY',
    languageCode: 'ko',
  };
  if (intermediates.length > 0) {
    body.intermediates = intermediates;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
  };
  const referer = (opts?.referer || '').trim();
  if (referer) headers.Referer = referer;

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('Routes computeRoutes failed:', res.status, text.slice(0, 180));
    if (travelMode === 'WALK') {
      return computeGoogleRoutesPath(points, apiKey, { ...opts, travelMode: 'DRIVE' });
    }
    return [];
  }

  const json = (await res.json().catch(() => ({}))) as {
    routes?: Array<{ polyline?: { encodedPolyline?: string } }>;
  };
  const encoded = json.routes?.[0]?.polyline?.encodedPolyline;
  if (!encoded) {
    if (travelMode === 'WALK') {
      return computeGoogleRoutesPath(points, apiKey, { ...opts, travelMode: 'DRIVE' });
    }
    return [];
  }
  const decoded = decodeGooglePolyline(encoded);
  return decoded.length >= 2 ? decoded : [];
}

/**
 * Prefer Google Routes; if key blocks Routes/Roads, fall back to OSRM (roads).
 */
export async function computeWalkingRoutePath(
  points: FieldTrackLatLng[],
  apiKey: string,
  opts?: ComputeRouteOptions,
): Promise<FieldTrackLatLng[]> {
  if (points.length < 2) return [];

  if (apiKey) {
    const googlePath = await computeGoogleRoutesPath(points, apiKey, opts);
    if (googlePath.length >= 2) return googlePath;
  }

  const foot = await computeOsrmPath(points, 'foot');
  if (foot.length >= 2) return foot;
  return computeOsrmPath(points, 'driving');
}
