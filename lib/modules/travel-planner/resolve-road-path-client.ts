/**
 * Client-side road path via /api/v1/travel/road-path (Routes API + OSRM fallback).
 */

import type { FieldTrackLatLng } from '@/lib/modules/travel-planner/field-track-path';
import { supabase } from '@/lib/supabase';

/** Follow roads between GPS crumbs. Returns [] on failure. */
export async function resolveRoadPath(
  points: FieldTrackLatLng[],
  groupId: string,
): Promise<FieldTrackLatLng[]> {
  if (points.length < 2 || !groupId) return [];
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return [];

    const res = await fetch('/api/v1/travel/road-path', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupId, points }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    const path = Array.isArray(json?.data?.path) ? json.data.path : [];
    const out: FieldTrackLatLng[] = [];
    for (const p of path) {
      const lat = Number(p?.lat);
      const lng = Number(p?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({ lat, lng });
    }
    return out.length >= 2 ? out : [];
  } catch {
    return [];
  }
}
