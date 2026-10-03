/**
 * Client-side road path via /api/v1/travel/road-path (Routes API + OSRM fallback).
 */

import type { FieldTrackLatLng } from '@/lib/modules/travel-planner/field-track-path';
import { supabase } from '@/lib/supabase';

export type RoadPathClientResult = {
  path: FieldTrackLatLng[];
  /** Road distance in metres from the routing API (null when unavailable). */
  distanceM: number | null;
};

/** Follow roads between GPS crumbs. Returns path + distanceM on success. */
export async function resolveRoadPath(
  points: FieldTrackLatLng[],
  groupId: string,
): Promise<RoadPathClientResult> {
  if (points.length < 2 || !groupId) return { path: [], distanceM: null };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { path: [], distanceM: null };

    const res = await fetch('/api/v1/travel/road-path', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupId, points }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { path: [], distanceM: null };
    const path = Array.isArray(json?.data?.path) ? json.data.path : [];
    const out: FieldTrackLatLng[] = [];
    for (const p of path) {
      const lat = Number(p?.lat);
      const lng = Number(p?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({ lat, lng });
    }
    const rawDist = json?.data?.distanceM;
    const distanceM =
      typeof rawDist === 'number' && Number.isFinite(rawDist) ? rawDist : null;
    return out.length >= 2 ? { path: out, distanceM } : { path: [], distanceM: null };
  } catch {
    return { path: [], distanceM: null };
  }
}
