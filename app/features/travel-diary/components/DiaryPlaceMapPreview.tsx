'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTravelTranslation } from '@/lib/translations/travel';
import {
  buildGoogleMapsViewUrl,
  buildMapsEmbedUrl,
  canShowDiaryPlaceMap,
  formatPlaceCoords,
  type GoogleMapsPlaceRef,
} from '@/lib/modules/travel-planner/google-maps-embed';
import { ensureGoogleMapsLoaded } from '@/lib/modules/travel-planner/ensure-google-maps';

type Props = {
  place: GoogleMapsPlaceRef;
  sourceKind?: string | null;
};

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function getMaps(): typeof google.maps | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { google?: { maps?: typeof google.maps } }).google?.maps;
}

type FixedPointMapProps = {
  lat: number;
  lng: number;
  title?: string;
  interactive: boolean;
  className?: string;
};

/** Renders a pin at the saved coordinates only — never device geolocation. */
function FixedPointMapCanvas({ lat, lng, title, interactive, className }: FixedPointMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      const ok = await ensureGoogleMapsLoaded();
      if (cancelled || !ok) return;
      const g = getMaps();
      const el = elRef.current;
      if (!g?.Map || !g.Marker || !el) return;

      const position = { lat, lng };

      if (!mapRef.current) {
        mapRef.current = new g.Map(el, {
          center: position,
          zoom: 15,
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
          keyboardShortcuts: interactive,
        });
        mapRef.current.setCenter(position);
      }

      markerRef.current?.setMap(null);
      markerRef.current = new g.Marker({
        map: mapRef.current,
        position,
        title: title || '저장 위치',
        clickable: false,
      });
    };

    void draw();
    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [lat, lng, title, interactive]);

  return (
    <div className={className ?? 'relative h-full w-full'}>
      <div ref={elRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

export function DiaryPlaceMapPreview({ place, sourceKind }: Props) {
  const { lang } = useLanguage();
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const viewOnMap = getTravelTranslation(lang, 'view_on_map');
  const coordsLabel = getTravelTranslation(lang, 'ui_coords_under_map');
  const address = typeof place.address === 'string' ? place.address.trim() : '';
  const coords = formatPlaceCoords(place);
  const lat = toNum(place.latitude);
  const lng = toNum(place.longitude);
  const hasFixedPoint = lat != null && lng != null;

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

  if (!canShowDiaryPlaceMap(place, sourceKind)) return null;

  const viewUrl = buildGoogleMapsViewUrl(place);
  const embedUrl = !hasFixedPoint
    ? buildMapsEmbedUrl(place, { language: lang, zoom: 13 })
    : null;
  const iframeTitle = (typeof place.title === 'string' && place.title.trim()) || viewOnMap;
  const pinTitle = (typeof place.title === 'string' && place.title.trim()) || '저장 위치';

  return (
    <div className="flex min-h-24 min-w-0 flex-1 flex-col">
      {hasFixedPoint ? (
        <>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="relative min-h-24 flex-1 cursor-pointer overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-0 text-left"
            aria-label="위치 지도 크게 보기"
          >
            <FixedPointMapCanvas
              lat={lat}
              lng={lng}
              title={pinTitle}
              interactive={false}
              className="absolute inset-0"
            />
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
              크게 보기
            </span>
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
                  <h2 id={titleId} className="m-0 text-sm font-semibold text-slate-800">
                    위치 지도
                  </h2>
                  <div className="flex items-center gap-2">
                    {viewUrl ? (
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 no-underline hover:bg-slate-50"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {viewOnMap}
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={close}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border-0 bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
                      aria-label="닫기"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1 bg-slate-100">
                  <FixedPointMapCanvas
                    lat={lat}
                    lng={lng}
                    title={pinTitle}
                    interactive
                    className="absolute inset-0"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : embedUrl ? (
        <div className="relative min-h-24 flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          <iframe
            title={iframeTitle}
            src={embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : viewUrl ? (
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center gap-0.5 text-[11px] font-medium leading-tight text-blue-600 no-underline hover:text-blue-700 hover:underline"
        >
          <MapPin className="h-3 w-3 shrink-0" />
          {viewOnMap}
        </a>
      ) : null}

      {(address || coords) ? (
        <div className="mt-0.5 space-y-0.5">
          {address ? (
            <p className="line-clamp-2 text-[11px] leading-snug text-slate-500">{address}</p>
          ) : null}
          {coords ? (
            <p className="font-mono text-[10px] leading-snug text-slate-400">
              {coordsLabel}: {coords}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
