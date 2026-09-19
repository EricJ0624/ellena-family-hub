'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/** kids 스크랩북: 페이지당 5개 고정 → CSS로 5개 분량에 맞춰 글자·간격 조정 */
const TRIPS_PER_PAGE = 5;
const TRIPS_PER_SPREAD = TRIPS_PER_PAGE * 2;

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

const DIARY_FIT_TITLE_MIN = 8;
const DIARY_FIT_DATE_MIN = 7;
const DIARY_FIT_LH = 1.3;

/** 칸(균등 5분)마다 제목·날짜 글자만 맞춤. 전체 일괄 축소 없음. */
function useDiarySlotFontFit(
  listRef: React.RefObject<HTMLUListElement | null>,
  deps: unknown,
) {
  useLayoutEffect(() => {
    const ul = listRef.current;
    if (!ul) return;

    const fitSlot = (item: HTMLElement) => {
      const titleEl = item.querySelector<HTMLElement>('.travel-kids-widget-trip-title');
      const dateEl = item.querySelector<HTMLElement>('.travel-kids-widget-trip-dates');
      const slotH = item.clientHeight;
      const slotW = item.clientWidth;
      if (slotH < 12 || slotW < 12) return;

      if (dateEl) {
        dateEl.style.removeProperty('font-size');
        dateEl.style.whiteSpace = 'nowrap';
        dateEl.style.overflow = 'hidden';
        dateEl.style.lineHeight = String(DIARY_FIT_LH);
        let ds = parseFloat(getComputedStyle(dateEl).fontSize) || 10;
        let guard = 24;
        while (dateEl.scrollWidth > slotW + 1 && ds > DIARY_FIT_DATE_MIN && guard-- > 0) {
          ds = Math.max(DIARY_FIT_DATE_MIN, ds - 0.5);
          dateEl.style.fontSize = `${ds}px`;
        }
      }

      if (!titleEl) return;
      titleEl.style.removeProperty('font-size');
      titleEl.style.removeProperty('max-height');
      titleEl.style.removeProperty('min-height');
      titleEl.style.display = '-webkit-box';
      titleEl.style.setProperty('-webkit-box-orient', 'vertical');
      titleEl.style.setProperty('-webkit-line-clamp', '2');
      titleEl.style.overflow = 'hidden';
      titleEl.style.whiteSpace = 'normal';
      titleEl.style.lineHeight = String(DIARY_FIT_LH);
      titleEl.style.wordBreak = 'keep-all';
      titleEl.style.overflowWrap = 'break-word';

      const dateH = dateEl ? dateEl.offsetHeight : 0;
      let ts = parseFloat(getComputedStyle(titleEl).fontSize) || 12;
      let guard = 36;
      while (titleEl.offsetHeight + dateH > slotH + 1 && ts > DIARY_FIT_TITLE_MIN && guard-- > 0) {
        ts = Math.max(DIARY_FIT_TITLE_MIN, ts - 0.5);
        titleEl.style.fontSize = `${ts}px`;
      }
    };

    const fitAll = () => {
      ul.querySelectorAll<HTMLElement>('.travel-kids-widget-trip-item').forEach(fitSlot);
    };

    const run = () => {
      requestAnimationFrame(fitAll);
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(ul);
    const page = ul.closest('.diary-book-page');
    if (page) ro.observe(page);
    return () => ro.disconnect();
  }, [listRef, deps]);
}

function DiaryTripListItem({
  trip,
  openLabel,
  startLabel,
  onActivate,
}: {
  trip: TravelTrip;
  openLabel: string;
  startLabel: string;
  onActivate: (trip: TravelTrip) => void;
}) {
  const canActivate = trip.diary_enabled === true || canUserOptInDiaryForTrip(trip);
  const actionLabel = trip.diary_enabled ? openLabel : startLabel;
  const dateText = `${trip.start_date} ~ ${trip.end_date}`;

  const body = (
    <>
      <div className="travel-kids-widget-trip-title">{trip.title}</div>
      <div className="travel-kids-widget-trip-dates">{dateText}</div>
    </>
  );

  if (!canActivate) {
    return (
      <li className="travel-kids-widget-trip-item">
        <div className="travel-kids-widget-trip" style={{ cursor: 'default' }}>
          {body}
        </div>
      </li>
    );
  }

  return (
    <li className="travel-kids-widget-trip-item">
      <button
        type="button"
        onClick={() => onActivate(trip)}
        className="travel-kids-widget-trip w-full border-0 text-left"
        aria-label={`${trip.title} — ${actionLabel}`}
      >
        {body}
      </button>
    </li>
  );
}

function DiaryBookTripsList({
  trips,
  openLabel,
  startLabel,
  onActivate,
}: {
  trips: TravelTrip[];
  openLabel: string;
  startLabel: string;
  onActivate: (trip: TravelTrip) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const sig = trips.map((t) => `${t.id}:${t.title}`).join('|');
  useDiarySlotFontFit(listRef, sig);

  return (
    <ul ref={listRef} className="travel-kids-widget-trips diary-book-trips">
      {trips.map((trip) => (
        <DiaryTripListItem
          key={trip.id}
          trip={trip}
          openLabel={openLabel}
          startLabel={startLabel}
          onActivate={onActivate}
        />
      ))}
    </ul>
  );
}

function DiaryKidsScrapbookSection({
  trips,
  loading,
  currentGroupId,
  onActivate,
  translations: t,
}: {
  trips: TravelTrip[];
  loading: boolean;
  currentGroupId: string | null;
  onActivate: (trip: TravelTrip) => void;
  translations: Props['translations'];
}) {
  const spreadCount = Math.max(1, Math.ceil(trips.length / TRIPS_PER_SPREAD));
  const [page, setPage] = useState(0);
  const [flipDir, setFlipDir] = useState<'next' | 'prev'>('next');

  useEffect(() => {
    setPage((prev) => {
      const max = Math.max(0, spreadCount - 1);
      return prev > max ? max : prev;
    });
  }, [spreadCount]);

  const start = page * TRIPS_PER_SPREAD;
  const spread = trips.slice(start, start + TRIPS_PER_SPREAD);
  const left = spread.slice(0, TRIPS_PER_PAGE);
  const right = spread.slice(TRIPS_PER_PAGE, TRIPS_PER_SPREAD);
  const canPrev = page > 0;
  const canNext = page < spreadCount - 1 && trips.length > 0;

  const hint = !currentGroupId
    ? t.select_group
    : loading
      ? t.loading
      : t.empty_pick_trip;
  const showHint = !currentGroupId || loading || trips.length === 0;

  return (
    <section className="content-section travel-diary-widget travel-diary-widget--book relative isolate overflow-hidden [backdrop-filter:none] [-webkit-backdrop-filter:none]">
      <DiaryPolaroidFromViewedAlbum />

      <button
        type="button"
        className="diary-book-nav diary-book-nav--prev"
        disabled={!canPrev}
        aria-label="이전 페이지"
        onClick={() => {
          if (!canPrev) return;
          setFlipDir('prev');
          setPage((prev) => Math.max(0, prev - 1));
        }}
      >
        ‹
      </button>
      <button
        type="button"
        className="diary-book-nav diary-book-nav--next"
        disabled={!canNext}
        aria-label="다음 페이지"
        onClick={() => {
          if (!canNext) return;
          setFlipDir('next');
          setPage((prev) => Math.min(spreadCount - 1, prev + 1));
        }}
      >
        ›
      </button>

      <div className="diary-book-stage">
        <div className="diary-book-cover">
          <h3 className="diary-book-title travel-kids-widget-title m-0 inline-flex items-center gap-1.5 normal-case">
            <span aria-hidden className="text-[0.95em] leading-none">
              📔
            </span>
            {t.section_title}
          </h3>

          <div key={page} className={`diary-book-spread diary-book-spread--${flipDir}`}>
            <div className="diary-book-page diary-book-page--left">
              {showHint ? (
                <p className="travel-diary-widget-hint diary-book-empty m-0">{hint}</p>
              ) : (
                <DiaryBookTripsList
                  trips={left}
                  openLabel={t.open_diary}
                  startLabel={t.start_trip_diary}
                  onActivate={onActivate}
                />
              )}
            </div>
            <div className="diary-book-page diary-book-page--right">
              {!showHint && right.length > 0 ? (
                <DiaryBookTripsList
                  trips={right}
                  openLabel={t.open_diary}
                  startLabel={t.start_trip_diary}
                  onActivate={onActivate}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {trips.length > 0 ? (
        <div className="diary-book-footer">
          <span className="diary-book-pager">
            {page + 1} / {spreadCount}
          </span>
        </div>
      ) : null}
    </section>
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

  if (isKidsTheme) {
    return (
      <DiaryKidsScrapbookSection
        trips={list}
        loading={loading}
        currentGroupId={currentGroupId}
        onActivate={handleTripActivate}
        translations={t}
      />
    );
  }

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
  ) : isGlassTheme ? (
    <ul className="m-0 list-none p-0">
      {list.map((trip) => (
        <li
          key={trip.id}
          onClick={() => onOpenTrip(trip.id)}
          className="glass-panel-soft glass-panel-interactive cursor-pointer rounded-lg text-foreground transition-colors hover:bg-white/50"
          style={{ marginBottom: '1.5cqmin', padding: '2.5cqmin 3cqmin', fontSize: '5cqmin' }}
        >
          <div className="font-semibold">{trip.title}</div>
          <div className="text-muted-foreground" style={{ marginTop: '0.5cqmin', fontSize: '4cqmin' }}>
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
