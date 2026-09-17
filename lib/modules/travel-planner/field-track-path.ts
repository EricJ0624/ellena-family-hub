/**
 * Load recorded field-track GPS points for map polylines.
 * Prefers server road-snapped path when present and dense enough.
 */

export type FieldTrackLatLng = { lat: number; lng: number };

export type FieldTrackPathResult = {
  path: FieldTrackLatLng[];
  /** Server stored a real road path (not sparse raw GPS) */
  roadSnapped: boolean;
};

function toLatLng(lat: unknown, lng: unknown): FieldTrackLatLng | null {
  const la = typeof lat === 'number' ? lat : Number(lat);
  const ln = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { lat: la, lng: ln };
}

/** Dedupe consecutive near-identical points (keeps shape, drops GPS jitter duplicates). */
export function normalizeTrackPath(points: FieldTrackLatLng[], minDistM = 2): FieldTrackLatLng[] {
  if (points.length === 0) return [];
  const out: FieldTrackLatLng[] = [points[0]!];
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const dist = 2 * R * Math.asin(Math.sqrt(h));
    if (dist >= minDistM) out.push(b);
  }
  if (out.length === 1 && points.length > 1) out.push(points[points.length - 1]!);
  return out;
}

function parseSnappedMeta(raw: unknown): FieldTrackLatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldTrackLatLng[] = [];
  for (const p of raw) {
    const ll = toLatLng(
      (p as { lat?: unknown; latitude?: unknown })?.lat ??
        (p as { latitude?: unknown })?.latitude,
      (p as { lng?: unknown; longitude?: unknown })?.lng ??
        (p as { longitude?: unknown })?.longitude,
    );
    if (ll) out.push(ll);
  }
  return out;
}

function buildRawFallback(
  rows: unknown[],
  meta:
    | {
        start_lat?: unknown;
        start_lng?: unknown;
        end_lat?: unknown;
        end_lng?: unknown;
      }
    | undefined,
): FieldTrackLatLng[] {
  const fromPoints: FieldTrackLatLng[] = [];
  for (const p of rows) {
    const ll = toLatLng(
      (p as { latitude?: unknown })?.latitude,
      (p as { longitude?: unknown })?.longitude,
    );
    if (ll) fromPoints.push(ll);
  }

  if (fromPoints.length >= 2) return normalizeTrackPath(fromPoints);

  const start = meta ? toLatLng(meta.start_lat, meta.start_lng) : null;
  const end = meta ? toLatLng(meta.end_lat, meta.end_lng) : null;
  if (start && end) {
    const distish = Math.abs(start.lat - end.lat) + Math.abs(start.lng - end.lng);
    if (distish > 1e-7) return [start, end];
  }
  if (
    fromPoints.length === 1 &&
    end &&
    (fromPoints[0]!.lat !== end.lat || fromPoints[0]!.lng !== end.lng)
  ) {
    return [fromPoints[0]!, end];
  }
  if (
    fromPoints.length === 1 &&
    start &&
    (fromPoints[0]!.lat !== start.lat || fromPoints[0]!.lng !== start.lng)
  ) {
    return [start, fromPoints[0]!];
  }
  return fromPoints;
}

export async function fetchFieldTrackPath(
  trackId: string,
  groupId: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<FieldTrackPathResult> {
  const res = await fetch(
    `/api/v1/travel/field-tracks/${trackId}/points?groupId=${encodeURIComponent(groupId)}`,
    { headers, signal },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { path: [], roadSnapped: false };

  const meta = json.meta as
    | {
        start_lat?: unknown;
        start_lng?: unknown;
        end_lat?: unknown;
        end_lng?: unknown;
        snapped_path?: unknown;
        road_snapped?: boolean;
      }
    | undefined;

  const snapped = parseSnappedMeta(meta?.snapped_path);
  const roadSnapped = meta?.road_snapped === true && snapped.length >= 2;
  if (roadSnapped) return { path: snapped, roadSnapped: true };

  const rows = Array.isArray(json.data) ? json.data : [];
  // Prefer dense snapped even if flag missing (legacy), else raw GPS for client road resolve
  if (snapped.length > 6) return { path: snapped, roadSnapped: true };

  return { path: buildRawFallback(rows, meta), roadSnapped: false };
}
