/**
 * Google Roads / Routes — server-side road path builder.
 * Prefer GOOGLE_MAPS_SERVER_API_KEY (no HTTP-referrer restriction).
 * With browser keys, pass `referer` from the incoming request.
 */

import type { FieldTrackLatLng } from '@/lib/modules/travel-planner/field-track-path';
import { normalizeTrackPath } from '@/lib/modules/travel-planner/field-track-path';
import { computeWalkingRoutePath } from '@/lib/modules/travel-planner/routes-compute';

const SNAP_CHUNK = 100;

export type RoadPathResult = {
  path: FieldTrackLatLng[];
  /** true when Roads or Routes API produced geometry (not raw GPS) */
  fromRoads: boolean;
};

export type BuildRoadPathOptions = {
  referer?: string | null;
};

function mapsKey(): string {
  return (
    (process.env.GOOGLE_MAPS_SERVER_API_KEY || '').trim() ||
    (process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || '').trim()
  );
}

function parseSnapped(raw: unknown): FieldTrackLatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldTrackLatLng[] = [];
  for (const row of raw) {
    const loc = (row as { location?: { latitude?: unknown; longitude?: unknown } })?.location;
    if (!loc) continue;
    const lat = typeof loc.latitude === 'number' ? loc.latitude : Number(loc.latitude);
    const lng = typeof loc.longitude === 'number' ? loc.longitude : Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ lat, lng });
  }
  return out;
}

async function snapChunk(
  points: FieldTrackLatLng[],
  key: string,
  referer?: string | null,
): Promise<FieldTrackLatLng[]> {
  if (points.length < 2) return points;
  const path = points.map((p) => `${p.lat},${p.lng}`).join('|');
  const url =
    `https://roads.googleapis.com/v1/snapToRoads` +
    `?interpolate=true&key=${encodeURIComponent(key)}&path=${encodeURIComponent(path)}`;
  const headers: Record<string, string> = {};
  if (referer?.trim()) headers.Referer = referer.trim();
  const res = await fetch(url, { method: 'GET', cache: 'no-store', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('snapToRoads failed:', res.status, text.slice(0, 240));
    return [];
  }
  const json = (await res.json().catch(() => ({}))) as { snappedPoints?: unknown };
  return parseSnapped(json.snappedPoints);
}

/**
 * Build a road-following path. Returns fromRoads=false when only raw GPS remains
 * (caller must NOT persist that as snapped_path).
 */
export async function buildRoadSnappedPath(
  rawPoints: FieldTrackLatLng[],
  opts?: BuildRoadPathOptions,
): Promise<RoadPathResult> {
  const normalized = normalizeTrackPath(rawPoints, 3);
  if (normalized.length === 0) return { path: [], fromRoads: false };
  if (normalized.length === 1) return { path: normalized, fromRoads: false };

  const key = mapsKey();
  if (!key) return { path: normalized, fromRoads: false };

  const referer = opts?.referer;
  const merged: FieldTrackLatLng[] = [];
  for (let i = 0; i < normalized.length; ) {
    const chunk = normalized.slice(i, i + SNAP_CHUNK);
    if (chunk.length < 2) break;
    const snapped = await snapChunk(chunk, key, referer);
    if (snapped.length === 0) {
      merged.length = 0;
      break;
    }
    if (merged.length > 0) {
      const first = snapped[0]!;
      const last = merged[merged.length - 1]!;
      const same =
        Math.abs(first.lat - last.lat) < 1e-6 && Math.abs(first.lng - last.lng) < 1e-6;
      merged.push(...(same ? snapped.slice(1) : snapped));
    } else {
      merged.push(...snapped);
    }
    i += Math.max(1, SNAP_CHUNK - 1);
  }

  if (merged.length >= 2) {
    return { path: normalizeTrackPath(merged, 1), fromRoads: true };
  }

  const viaRoutes = await computeWalkingRoutePath(normalized, key, { referer });
  if (viaRoutes.length >= 2) {
    return { path: viaRoutes, fromRoads: true };
  }

  return { path: normalized, fromRoads: false };
}

export function parseStoredSnappedPath(raw: unknown): FieldTrackLatLng[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: FieldTrackLatLng[] = [];
  for (const p of raw) {
    const lat =
      typeof (p as { lat?: unknown })?.lat === 'number'
        ? (p as { lat: number }).lat
        : Number(
            (p as { lat?: unknown; latitude?: unknown })?.lat ??
              (p as { latitude?: unknown })?.latitude,
          );
    const lng =
      typeof (p as { lng?: unknown })?.lng === 'number'
        ? (p as { lng: number }).lng
        : Number(
            (p as { lng?: unknown; longitude?: unknown })?.lng ??
              (p as { longitude?: unknown })?.longitude,
          );
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ lat, lng });
  }
  return out.length > 0 ? out : null;
}

/** Heuristic: sparse polyline is almost certainly raw GPS, not road-interpolated. */
export function looksLikeRawGpsPath(path: FieldTrackLatLng[]): boolean {
  if (path.length < 2) return true;
  if (path.length <= 6) return true;
  return false;
}
