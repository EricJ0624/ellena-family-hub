'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { TravelTrip } from '@/app/features/travel-planner/types';
import type { UiTheme } from '@/lib/ui-theme';
import { canUserOptInDiaryForTrip } from '@/lib/modules/travel-planner/diary-eligibility';
import {
  TRAVEL_DIARY_BG_SIZE,
  TRAVEL_DIARY_POLAROID_INNER,
  getCoverFittedRect,
  getViewedAlbumPhotoUrls,
  subscribeViewedAlbumPhotoUrls,
} from '@/lib/album-viewed-photo-urls';

type Props = {
  trips: TravelTrip[];
  loading: boolean;
  currentGroupId: string | null;
  onOpenTrip: (tripId: string) => void;
  onStartTrip: (tripId: string) => Promise<void>;
  uiTheme?: UiTheme;
  translations: {
    section_title: string;
    select_group: string;
    loading: string;
    empty_pick_trip: string;
    open_diary: string;
    start_trip_diary: string;
  };
};

type SlotRect = { left: number; top: number; width: number; height: number };

function pickRandomUrl(urls: string[], exclude?: string | null): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  const pool = exclude ? urls.filter((u) => u !== exclude) : urls;
  const list = pool.length > 0 ? pool : urls;
  return list[Math.floor(Math.random() * list.length)] ?? null;
}

function DiaryPolaroidFromViewedAlbum() {
  const hostRef = useRef<HTMLElement | null>(null);
  const [slot, setSlot] = useState<SlotRect | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const syncPick = () => {
      const urls = getViewedAlbumPhotoUrls();
      setPhotoUrl((prev) => {
        if (prev && urls.includes(prev)) return prev;
        return pickRandomUrl(urls, prev);
      });
    };
    syncPick();
    return subscribeViewedAlbumPhotoUrls(syncPick);
  }, []);

  useEffect(() => {
    const host = hostRef.current?.closest('.travel-diary-widget') as HTMLElement | null;
    if (!host) return;

    let rafId = 0;
    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const fitted = getCoverFittedRect(
          host.clientWidth,
          host.clientHeight,
          TRAVEL_DIARY_BG_SIZE.width,
          TRAVEL_DIARY_BG_SIZE.height
        );
        if (fitted.width <= 0 || fitted.height <= 0) return;
        const next: SlotRect = {
          left: fitted.left + TRAVEL_DIARY_POLAROID_INNER.left * fitted.width,
          top: fitted.top + TRAVEL_DIARY_POLAROID_INNER.top * fitted.height,
          width: TRAVEL_DIARY_POLAROID_INNER.width * fitted.width,
          height: TRAVEL_DIARY_POLAROID_INNER.height * fitted.height,
        };
        /* 구멍을 살짝 넘겨 프레임 가장자리 틈 방지 */
        const padX = next.width * 0.02;
        const padY = next.height * 0.02;
        next.left -= padX;
        next.top -= padY;
        next.width += padX * 2;
        next.height += padY * 2;
        setSlot((prev) => {
          if (
            prev &&
            Math.abs(prev.left - next.left) < 2 &&
            Math.abs(prev.top - next.top) < 2 &&
            Math.abs(prev.width - next.width) < 2 &&
            Math.abs(prev.height - next.height) < 2
          ) {
            return prev;
          }
          return {
            left: Math.round(next.left),
            top: Math.round(next.top),
            width: Math.round(next.width),
            height: Math.round(next.height),
          };
        });
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <span ref={hostRef} className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {photoUrl && slot && slot.width > 0 ? (
        <span
          className="travel-diary-polaroid-photo absolute overflow-hidden"
          style={{
            left: slot.left,
            top: slot.top,
            width: slot.width,
            height: slot.height,
            transform: `rotate(${TRAVEL_DIARY_POLAROID_INNER.rotateDeg}deg)`,
          }}
        >
          {/* 앨범에서 이미 onLoad 된 URL — 브라우저 캐시 재사용 목적 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover opacity-40"
          />
        </span>
      ) : null}
    </span>
  );
}

export function TravelDiaryDashboardSection({
  trips,
  loading,
  currentGroupId,
  onOpenTrip,
  onStartTrip,
  uiTheme,
  translations: t,
}: Props) {
  const isKidsTheme = uiTheme === 'kids_friendly';
  const isGlassTheme = uiTheme === 'highend_glass';
  /** 다이어리 켠 여행만 — 없으면 전체 trips로 폴백하지 않음(전체삭제 후 잔상 방지) */
  const list = trips.filter((x) => x.diary_enabled === true);

  const handleTripActivate = (trip: TravelTrip) => {
    if (trip.diary_enabled) {
      onOpenTrip(trip.id);
      return;
    }
    if (canUserOptInDiaryForTrip(trip)) {
      void onStartTrip(trip.id);
    }
  };

  const bodyContent = !currentGroupId ? (
    <p className="m-0 text-[#64748b]" style={{ fontSize: '5cqmin' }}>
      {t.select_group}
    </p>
  ) : loading ? (
    <p className="m-0 text-[#64748b]" style={{ fontSize: '5cqmin' }}>
      {t.loading}
    </p>
  ) : list.length === 0 ? (
    <p className="m-0 text-[#475569] [word-break:keep-all]" style={{ fontSize: '5cqmin', lineHeight: 1.6 }}>
      {t.empty_pick_trip}
    </p>
  ) : isKidsTheme ? (
    <ul className="travel-kids-widget-trips">
      {list.map((trip) => {
        const canActivate =
          trip.diary_enabled === true || canUserOptInDiaryForTrip(trip);
        const actionLabel = trip.diary_enabled ? t.open_diary : t.start_trip_diary;

        return (
          <li key={trip.id} className="travel-kids-widget-trip-item">
            {canActivate ? (
              <button
                type="button"
                onClick={() => handleTripActivate(trip)}
                className="travel-kids-widget-trip w-full border-0 text-left"
                aria-label={`${trip.title} — ${actionLabel}`}
              >
                <div className="travel-kids-widget-trip-title">{trip.title}</div>
                <div className="travel-kids-widget-trip-dates">
                  {trip.start_date} ~ {trip.end_date}
                </div>
              </button>
            ) : (
              <div className="travel-kids-widget-trip" style={{ cursor: 'default' }}>
                <div className="travel-kids-widget-trip-title">{trip.title}</div>
                <div className="travel-kids-widget-trip-dates">
                  {trip.start_date} ~ {trip.end_date}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  ) : isGlassTheme ? (
    <ul className="m-0 list-none p-0">
      {list.map((trip) => (
        <li
          key={trip.id}
          onClick={() => onOpenTrip(trip.id)}
          className="glass-panel-soft glass-panel-interactive cursor-pointer rounded-lg text-[#1e293b] transition-colors hover:bg-white/50"
          style={{ marginBottom: '1.5cqmin', padding: '2.5cqmin 3cqmin', fontSize: '5cqmin' }}
        >
          <div className="font-semibold">{trip.title}</div>
          <div className="text-[#64748b]" style={{ marginTop: '0.5cqmin', fontSize: '4cqmin' }}>
            {trip.start_date} ~ {trip.end_date}
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <ul className="m-0 list-none space-y-2 p-0">
      {list.map((trip) => (
        <li key={trip.id} className="rounded-xl bg-transparent px-0 py-1.5">
          <div className="break-words font-semibold text-slate-800">{trip.title}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <span aria-hidden>📅</span>
            <span>
              {trip.start_date} ~ {trip.end_date}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {trip.diary_enabled ? (
              <button
                type="button"
                onClick={() => onOpenTrip(trip.id)}
                className="cursor-pointer rounded-full border-0 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                {t.open_diary}
              </button>
            ) : canUserOptInDiaryForTrip(trip) ? (
              <button
                type="button"
                onClick={() => void onStartTrip(trip.id)}
                className="cursor-pointer rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
              >
                {t.start_trip_diary}
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );

  if (isKidsTheme) {
    return (
      <section className="content-section travel-diary-widget relative isolate overflow-hidden [backdrop-filter:none] [-webkit-backdrop-filter:none]">
        <DiaryPolaroidFromViewedAlbum />
        <div className="section-header relative z-[2]">
          <h3 className="travel-kids-widget-title m-0 inline-flex items-center gap-1.5 normal-case">
            <span aria-hidden className="text-[0.95em] leading-none">
              📔
            </span>
            {t.section_title}
          </h3>
        </div>
        <div className="section-body relative z-[2]">
          {!currentGroupId || loading || list.length === 0 ? (
            <p className="travel-diary-widget-hint m-0">
              {!currentGroupId ? t.select_group : loading ? t.loading : t.empty_pick_trip}
            </p>
          ) : (
            bodyContent
          )}
        </div>
      </section>
    );
  }

  if (isGlassTheme) {
    return (
      <section className="content-section">
        <div className="section-header">
          <h3 className="section-title m-0 inline-flex min-w-0 items-center gap-1.5">
            <span aria-hidden>📔</span>
            {t.section_title}
          </h3>
        </div>
        <div className="section-body">{bodyContent}</div>
      </section>
    );
  }

  return (
    <section className="content-section travel-diary-widget relative isolate overflow-hidden [backdrop-filter:none] [-webkit-backdrop-filter:none]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-br from-[#d4c8fc] via-[#f3d0fe] to-[#fecdd3]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 right-3 z-[1] select-none text-[2.2rem] leading-none opacity-25"
      >
        🌴
      </span>
      <div className="section-header relative z-[2]">
        <h3 className="section-title m-0 inline-flex items-center gap-1.5">
          <span aria-hidden>📔</span>
          {t.section_title}
        </h3>
      </div>
      <div className="section-body relative z-[2]">{bodyContent}</div>
    </section>
  );
}
