'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ensureGoogleMapsLoaded } from '@/lib/modules/travel-planner/ensure-google-maps';
import type { FamilyLogRoutePoint } from '../types';

type Props = {
  points: FamilyLogRoutePoint[];
  className?: string;
};

type LatLng = { lat: number; lng: number };

function getMaps(): typeof google.maps | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { google?: { maps?: typeof google.maps } }).google?.maps;
}

function samplePath(points: FamilyLogRoutePoint[], max = 400): LatLng[] {
  const path = points.map((point) => ({ lat: point.latitude, lng: point.longitude }));
  if (path.length <= max) return path;
  const sampled: LatLng[] = [];
  const step = (path.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) sampled.push(path[Math.round(i * step)]!);
  return sampled;
}

/** Polyline for a family-log route card. Does not read travel field tracks. */
export function FamilyLogRouteMap({ points, className }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const path = useMemo(() => samplePath(points), [points]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || path.length === 0) return;
    let cancelled = false;
    let map: google.maps.Map | null = null;
    let line: google.maps.Polyline | null = null;
    const markers: google.maps.Marker[] = [];

    const fit = () => {
      if (!map) return;
      const g = getMaps();
      if (!g) return;
      g.event?.trigger(map, 'resize');
      if (path.length < 2) {
        map.setCenter(path[0]!);
        map.setZoom(15);
        return;
      }
      const bounds = new g.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 24);
    };

    const draw = async () => {
      const ok = await ensureGoogleMapsLoaded();
      if (cancelled || !ok || !elRef.current) return;
      const g = getMaps();
      if (!g?.Map || !g.Polyline || !g.Marker) return;
      map = new g.Map(elRef.current, {
        center: path[0],
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        gestureHandling: 'none',
        clickableIcons: false,
        keyboardShortcuts: false,
        disableDefaultUI: true,
      });
      if (path.length >= 2) {
        line = new g.Polyline({
          path,
          geodesic: false,
          strokeColor: '#2563eb',
          strokeOpacity: 0.95,
          strokeWeight: 4,
          clickable: false,
          map,
        });
      }
      markers.push(
        new g.Marker({
          map,
          position: path[0],
          clickable: false,
          label: { text: '🟢', color: '#333', fontSize: '14px' },
        }),
      );
      if (path.length > 1) {
        markers.push(
          new g.Marker({
            map,
            position: path[path.length - 1],
            clickable: false,
            label: { text: '🏁', color: '#333', fontSize: '14px' },
          }),
        );
      }
      fit();
    };

    void draw();
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      line?.setMap(null);
      markers.forEach((marker) => marker.setMap(null));
      map = null;
    };
  }, [path]);

  if (path.length === 0) return null;

  return (
    <div className={className ?? 'relative h-28 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100'}>
      <div ref={elRef} className="absolute inset-0" />
    </div>
  );
}
