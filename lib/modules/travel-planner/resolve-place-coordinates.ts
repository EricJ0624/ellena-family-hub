/**
 * 장소 좌표 보강: place_cache(place_id → 주소 → 이름) 후 Geocoding.
 * 실패해도 throw 하지 않음 — 호출측은 일정 저장을 유지하고 좌표만 null로 두면 됨.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type ResolvePlaceCoordsInput = {
  placeId?: string | null;
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ResolvePlaceCoordsResult = {
  latitude: number | null;
  longitude: number | null;
  /** 캐시에서 찾은 경우에만 채움. Geocoding만 한 경우 null 유지 가능 */
  place_id: string | null;
  source: 'provided' | 'cache_id' | 'cache_address' | 'cache_name' | 'geocoding' | 'none';
};

type CacheRow = {
  place_id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
};

function toFiniteNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function trimOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function coordsFromRow(row: CacheRow | null | undefined): {
  latitude: number;
  longitude: number;
  place_id: string;
} | null {
  if (!row) return null;
  const lat = toFiniteNumber(row.latitude);
  const lng = toFiniteNumber(row.longitude);
  const pid = trimOrEmpty(row.place_id);
  if (lat == null || lng == null || !pid) return null;
  return { latitude: lat, longitude: lng, place_id: pid };
}

async function lookupCacheByPlaceId(
  supabase: SupabaseClient,
  placeId: string,
): Promise<CacheRow | null> {
  const { data, error } = await supabase
    .from('place_cache')
    .select('place_id, name, latitude, longitude, formatted_address')
    .eq('place_id', placeId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CacheRow;
}

/** 정확 일치 + 좌표 있는 행이 정확히 1건일 때만 채택 (오탐 방지) */
async function lookupCacheExactSingle(
  supabase: SupabaseClient,
  column: 'formatted_address' | 'name',
  value: string,
): Promise<CacheRow | null> {
  const { data, error } = await supabase
    .from('place_cache')
    .select('place_id, name, latitude, longitude, formatted_address')
    .eq(column, value)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(2);
  if (error || !data || data.length !== 1) return null;
  return data[0] as CacheRow;
}

async function geocodeAddress(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const key = (process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || '').trim();
  if (!key) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', key);
    url.searchParams.set('language', 'ko');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    } | null;
    if (!json || json.status !== 'OK' || !Array.isArray(json.results) || json.results.length === 0) {
      return null;
    }
    const loc = json.results[0]?.geometry?.location;
    const lat = toFiniteNumber(loc?.lat);
    const lng = toFiniteNumber(loc?.lng);
    if (lat == null || lng == null) return null;
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}

export async function resolvePlaceCoordinates(
  supabase: SupabaseClient,
  input: ResolvePlaceCoordsInput,
): Promise<ResolvePlaceCoordsResult> {
  const providedLat = toFiniteNumber(input.latitude);
  const providedLng = toFiniteNumber(input.longitude);
  if (providedLat != null && providedLng != null) {
    return {
      latitude: providedLat,
      longitude: providedLng,
      place_id: trimOrEmpty(input.placeId) || null,
      source: 'provided',
    };
  }

  const placeId = trimOrEmpty(input.placeId);
  const address = trimOrEmpty(input.address);
  const name = trimOrEmpty(input.name);

  try {
    if (placeId) {
      const byId = coordsFromRow(await lookupCacheByPlaceId(supabase, placeId));
      if (byId) {
        return {
          latitude: byId.latitude,
          longitude: byId.longitude,
          place_id: byId.place_id,
          source: 'cache_id',
        };
      }
    }

    if (address) {
      const byAddr = coordsFromRow(await lookupCacheExactSingle(supabase, 'formatted_address', address));
      if (byAddr) {
        return {
          latitude: byAddr.latitude,
          longitude: byAddr.longitude,
          place_id: byAddr.place_id,
          source: 'cache_address',
        };
      }
    }

    if (name) {
      const byName = coordsFromRow(await lookupCacheExactSingle(supabase, 'name', name));
      if (byName) {
        return {
          latitude: byName.latitude,
          longitude: byName.longitude,
          place_id: byName.place_id,
          source: 'cache_name',
        };
      }
    }

    if (address) {
      const geo = await geocodeAddress(address);
      if (geo) {
        return {
          latitude: geo.latitude,
          longitude: geo.longitude,
          place_id: placeId || null,
          source: 'geocoding',
        };
      }
    }
  } catch (e) {
    console.warn('resolvePlaceCoordinates:', e);
  }

  return {
    latitude: null,
    longitude: null,
    place_id: placeId || null,
    source: 'none',
  };
}

/**
 * insert/update payload에 lat/lng가 비어 있을 때만 보강.
 * place_id는 비어 있고 캐시에서 찾은 경우에만 채움.
 */
export async function enrichMissingPlaceCoordinates(
  supabase: SupabaseClient,
  fields: {
    place_id?: string | null;
    name?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<{
  latitude?: number;
  longitude?: number;
  place_id?: string;
}> {
  const resolved = await resolvePlaceCoordinates(supabase, {
    placeId: fields.place_id,
    name: fields.name,
    address: fields.address,
    latitude: fields.latitude,
    longitude: fields.longitude,
  });

  const out: { latitude?: number; longitude?: number; place_id?: string } = {};
  if (resolved.latitude != null && resolved.longitude != null) {
    if (toFiniteNumber(fields.latitude) == null) out.latitude = resolved.latitude;
    if (toFiniteNumber(fields.longitude) == null) out.longitude = resolved.longitude;
  }
  const existingPid = trimOrEmpty(fields.place_id);
  if (!existingPid && resolved.place_id && resolved.source.startsWith('cache_')) {
    out.place_id = resolved.place_id;
  }
  return out;
}
