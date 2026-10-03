/**
 * Diary route map: road-following polyline in-app (no external Google Maps).
 * Uses server snapped_path when available; otherwise /api/v1/travel/road-path.
 * Tap preview → fullscreen modal with pan/zoom only.
 */

'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchFieldTrackPath,
  type FieldTrackLatLng,
} from '@/lib/modules/travel-planner/field-track-path';
import { ensureGoogleMapsLoaded } from '@/lib/modules/travel-planner/ensure-google-maps';
import { resolveRoadPath } from '@/lib/modules/travel-planner/resolve-road-path-client';

type Props = {
  groupId: string;
  trackId: string;
  className?: string;
};

function getMaps(): typeof google.maps | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { google?: { maps?: typeof google.maps } }).google?.maps;
}

type MapHostProps = {
  path: FieldTrackLatLng[];
  className?: string;
  interactive: boolean;
};

function RouteMapCanvas({ path, className, interactive }: MapHostProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polyRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const pathRef = useRef(path);
  const interactiveRef = useRef(interactive);
  pathRef.current = path;
  interactiveRef.current = interactive;

  useEffect(() => {
    let cancelled = false;

    const clearOverlays = () => {
      polyRef.current?.setMap(null);
      polyRef.current = null;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };

    const draw = async () => {
      const ok = await ensureGoogleMapsLoaded();
      if (cancelled || !ok) return;
      const g = getMaps();
      const el = elRef.current;
      if (!g?.Map || !g.Polyline || !el || path.length === 0) return;

      clearOverlays();

      if (!mapRef.current) {
        mapRef.current = new g.Map(el, {
          center: path[0],
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: interactive,
          gestureHandling: interactive ? 'greedy' : 'none',
          clickableIcons: false,
          keyboardShortcuts: interactive,
          disableDefaultUI: !interactive,
        });
      } else {
        mapRef.current.setOptions({
          zoomControl: interactive,
          gestureHandling: interactive ? 'greedy' : 'none',
          clickableIcons: false,
          keyboardShortcuts: interactive,
        });
      }

      const map = mapRef.current;
      const bounds = new g.LatLngBounds();
      path.forEach((p) => bounds.extend(p));

      if (path.length >= 2) {
        polyRef.current = new g.Polyline({
          path,
          geodesic: false,
          strokeColor: '#2563eb',
          strokeOpacity: 0.95,
          strokeWeight: interactive ? 5 : 4,
          clickable: false,
          map,
        });
      }

      const start = path[0]!;
      const end = path[path.length - 1]!;
      markersRef.current.push(
        new g.Marker({
          map,
          position: start,
          title: '시작',
          clickable: false,
          label: { text: '🟢', color: '#333', fontSize: '14px' },
        }),
      );
      if (path.length > 1) {
        markersRef.current.push(
          new g.Marker({
            map,
            position: end,
            title: '종료',
            clickable: false,
            label: { text: '🏁', color: '#333', fontSize: '14px' },
          }),
        );
      }
      map.fitBounds(bounds, interactive ? 48 : 24);
    };

    void draw();
    return () => {
      cancelled = true;
      clearOverlays();
      mapRef.current = null;
    };
  }, [path, interactive]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const map = mapRef.current;
        const g = getMaps();
        const pts = pathRef.current;
        if (!map || !g?.event || pts.length === 0) return;
        g.event.trigger(map, 'resize');
        const bounds = new g.LatLngBounds();
        pts.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, interactiveRef.current ? 48 : 24);
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={className ?? 'relative h-full w-full'}>
      <div ref={elRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

async function persistClientRoadPath(
  trackId: string,
  groupId: string,
  path: FieldTrackLatLng[],
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`/api/v1/travel/field-tracks/${trackId}/snapped-path`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupId, path }),
    });
  } catch {
    /* non-fatal */
  }
}

/** Haversine sum of consecutive path points (metres). Used for pre-snapped paths. */
function calcPathDistanceM(pts: FieldTrackLatLng[]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}

/** Format metres → "X.X km" or "X.X mi" */
function formatDistance(metres: number, useKm: boolean): string {
  if (useKm) {
    const km = metres / 1000;
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }
  const mi = metres / 1609.344;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export function FieldTrackRouteMap({ groupId, trackId, className }: Props) {
  const titleId = useId();
  const [path, setPath] = useState<FieldTrackLatLng[]>([]);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [useKm, setUseKm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (!cancelled) setError('auth');
          return;
        }
        const result = await fetchFieldTrackPath(
          trackId,
          groupId,
          { Authorization: `Bearer ${token}` },
          ac.signal,
        );
        if (cancelled) return;
        if (result.path.length === 0) {
          setError('empty');
          setPath([]);
          return;
        }

        let display = result.path;
        let resolvedDistanceM: number | null = null;

        if (!result.roadSnapped && result.path.length >= 2) {
          const road = await resolveRoadPath(result.path, groupId);
          if (cancelled) return;
          if (road.path.length >= 2) {
            display = road.path;
            resolvedDistanceM = road.distanceM;
            void persistClientRoadPath(trackId, groupId, road.path);
          }
        } else if (result.roadSnapped) {
          // Path was already road-snapped in DB — derive distance from the polyline
          resolvedDistanceM = calcPathDistanceM(display);
        }

        setError(null);
        setPath(display);
        setDistanceM(resolvedDistanceM);
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        if (!cancelled) setError('fail');
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [groupId, trackId]);

  const close = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded, close]);

  const distanceLabel = distanceM !== null ? formatDistance(distanceM, useKm) : null;

  const shellClass =
    className ??
    'relative min-h-24 flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (path.length > 0) setExpanded(true);
        }}
        disabled={path.length === 0}
        className={`${shellClass} cursor-pointer border-0 p-0 text-left disabled:cursor-default`}
        aria-label="경로 지도 크게 보기"
      >
        {path.length > 0 ? (
          <RouteMapCanvas path={path} interactive={false} className="absolute inset-0" />
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 text-[11px] text-slate-500">
            경로 지도를 불러오지 못했습니다
          </div>
        ) : null}
        {path.length > 0 && !error ? (
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 flex items-end justify-between gap-1">
            {distanceLabel ? (
              <span
                className="pointer-events-auto rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setUseKm((v) => !v);
                }}
                title="클릭해서 단위 전환 (km / mi)"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setUseKm((v) => !v);
                  }
                }}
              >
                {distanceLabel}
              </span>
            ) : (
              <span />
            )}
            <span className="rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
              크게 보기
            </span>
          </div>
        ) : null}
      </button>

      {expanded ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={close}
        >
          <div
            className="relative flex h-[min(92vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <h2 id={titleId} className="m-0 text-sm font-semibold text-slate-800">
                  경로 지도
                </h2>
                {distanceLabel ? (
                  <button
                    type="button"
                    onClick={() => setUseKm((v) => !v)}
                    title="클릭해서 단위 전환 (km / mi)"
                    className="cursor-pointer rounded-full border-0 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    {distanceLabel}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border-0 bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1 bg-slate-100">
              <RouteMapCanvas path={path} interactive className="absolute inset-0" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
