/**
 * Diary / compact map: draw a recorded field track as a Google Maps polyline.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchFieldTrackPath } from '@/lib/modules/travel-planner/field-track-path';

type Props = {
  groupId: string;
  trackId: string;
  className?: string;
};

function getMaps(): typeof google.maps | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { google?: { maps?: typeof google.maps } }).google?.maps;
}

export function FieldTrackRouteMap({ groupId, trackId, className }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polyRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    const clearOverlays = () => {
      polyRef.current?.setMap(null);
      polyRef.current = null;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };

    const draw = async () => {
      const g = getMaps();
      const el = elRef.current;
      if (!g?.Map || !g.Polyline || !el) return;

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setError('auth');
          return;
        }
        const path = await fetchFieldTrackPath(
          trackId,
          groupId,
          { Authorization: `Bearer ${token}` },
          ac.signal,
        );
        if (cancelled || path.length === 0) {
          if (!cancelled && path.length === 0) setError('empty');
          return;
        }
        setError(null);

        if (!mapRef.current) {
          mapRef.current = new g.Map(el, {
            center: path[0],
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
          });
        }
        const map = mapRef.current;
        clearOverlays();

        const bounds = new g.LatLngBounds();
        path.forEach((p) => bounds.extend(p));

        if (path.length >= 2) {
          polyRef.current = new g.Polyline({
            path,
            geodesic: true,
            strokeColor: '#2563eb',
            strokeOpacity: 0.9,
            strokeWeight: 4,
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
            label: { text: '🟢', color: '#333', fontSize: '14px' },
          }),
        );
        if (path.length > 1) {
          markersRef.current.push(
            new g.Marker({
              map,
              position: end,
              title: '종료',
              label: { text: '🏁', color: '#333', fontSize: '14px' },
            }),
          );
        }
        map.fitBounds(bounds, 24);
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') setError('fail');
      }
    };

    const tryDraw = () => {
      if (getMaps()?.Map) {
        void draw();
        return null;
      }
      const t = window.setInterval(() => {
        if (getMaps()?.Map) {
          window.clearInterval(t);
          void draw();
        }
      }, 150);
      return t;
    };

    const intervalId = tryDraw();
    return () => {
      cancelled = true;
      ac.abort();
      if (intervalId != null) window.clearInterval(intervalId);
      clearOverlays();
    };
  }, [groupId, trackId]);

  return (
    <div className={className ?? 'relative min-h-24 flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100'}>
      <div ref={elRef} className="absolute inset-0 h-full w-full" />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 text-[11px] text-slate-500">
          경로 지도를 불러오지 못했습니다
        </div>
      ) : null}
    </div>
  );
}
