/**
 * 가족 여행 플래너 — 대시보드 위젯
 */

'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { UiTheme } from '@/lib/ui-theme';
import type { TravelTrip } from '../types';
import { isTripVisibleInPlanner } from '@/lib/modules/travel-planner/planner-visibility';

/** 이 개수까지는 위젯 높이 성장, 초과 시 목록만 스크롤 */
const TRAVEL_SCROLL_AFTER = 4;

interface TravelPlannerSectionProps {
  trips: TravelTrip[];
  loading: boolean;
  currentGroupId: string | null;
  onTripClick: (tripId: string) => void;
  onAddClick: () => void;
  onImportClick?: () => void;
  uiTheme?: UiTheme;
  translations: {
    section_title: string;
    add_trip: string;
    import_open_button: string;
    select_group: string;
    trips_loading: string;
    empty_state: string;
  };
}

export function TravelPlannerSection({
  trips,
  loading,
  currentGroupId,
  onTripClick,
  onAddClick,
  onImportClick,
  uiTheme,
  translations: t,
}: TravelPlannerSectionProps) {
  const plannerTrips = trips.filter(isTripVisibleInPlanner);
  const isKidsTheme = uiTheme === 'kids_friendly';

  // 목록 스크롤: TRAVEL_SCROLL_AFTER 개 초과 시 실측 maxHeight 적용
  const tripListRef = useRef<HTMLUListElement>(null);
  const [tripListMaxPx, setTripListMaxPx] = useState<number | null>(null);
  const tripsScrollable = plannerTrips.length > TRAVEL_SCROLL_AFTER;

  const tripListLayoutKey = plannerTrips
    .map((trip) => `${trip.id}:${trip.title}:${trip.start_date}:${trip.end_date}`)
    .join('|');

  const measureAndCap = useCallback(() => {
    const list = tripListRef.current;
    if (!list) return;

    if (plannerTrips.length <= TRAVEL_SCROLL_AFTER) {
      setTripListMaxPx((prev) => (prev === null ? prev : null));
      return;
    }

    const items = Array.from(list.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    if (items.length < TRAVEL_SCROLL_AFTER) return;

    const lastVisible = items[TRAVEL_SCROLL_AFTER - 1];
    const next = Math.ceil(lastVisible.offsetTop + lastVisible.offsetHeight);
    if (next <= 0) return;
    // 2px 미만 변화는 무시 (대시보드 재렌더 가드)
    setTripListMaxPx((prev) => (prev !== null && Math.abs(prev - next) < 2 ? prev : next));
  }, [plannerTrips.length]);

  useLayoutEffect(() => {
    if (plannerTrips.length === 0) {
      setTripListMaxPx((prev) => (prev === null ? prev : null));
      return;
    }

    measureAndCap();
    const list = tripListRef.current;
    if (!list) return;

    const ro = new ResizeObserver(() => {
      measureAndCap();
    });
    ro.observe(list);
    for (const child of Array.from(list.children)) {
      if (child instanceof HTMLElement) ro.observe(child);
    }
    return () => ro.disconnect();
  }, [plannerTrips.length, tripListLayoutKey, measureAndCap]);

  if (isKidsTheme) {
    return (
      <section className="content-section travel-kids-widget">
        <div className="travel-kids-widget-stage">
          <div className="travel-kids-widget-head">
            <h3 className="travel-kids-widget-title">{t.section_title}</h3>
            {currentGroupId ? (
              <div className="travel-kids-widget-actions">
                {onImportClick ? (
                  <button
                    type="button"
                    onClick={onImportClick}
                    className="travel-kids-widget-import"
                  >
                    {t.import_open_button}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onAddClick}
                  className="travel-kids-widget-add"
                >
                  <Plus className="travel-kids-widget-add-icon" aria-hidden />
                  {t.add_trip}
                </button>
              </div>
            ) : null}
            <div className="travel-kids-widget-bottom">
              {!currentGroupId ? (
                <p className="travel-kids-widget-empty">{t.select_group}</p>
              ) : loading ? (
                <p className="travel-kids-widget-empty">{t.trips_loading}</p>
              ) : plannerTrips.length === 0 ? (
                <p className="travel-kids-widget-empty">{t.empty_state}</p>
              ) : (
                <ul
                  ref={tripListRef}
                  className={`travel-kids-widget-trips${tripsScrollable ? ' travel-trip-list--scroll' : ''}`}
                  style={
                    tripsScrollable && tripListMaxPx != null
                      ? { ['--travel-trip-list-max-h' as string]: `${tripListMaxPx}px` }
                      : undefined
                  }
                >
                  {plannerTrips.map((trip) => (
                    <li key={trip.id} className="travel-kids-widget-trip-item">
                      <button
                        type="button"
                        onClick={() => onTripClick(trip.id)}
                        className="travel-kids-widget-trip w-full border-0 text-left"
                      >
                        <div className="travel-kids-widget-trip-title">{trip.title}</div>
                        <div className="travel-kids-widget-trip-dates">
                          {trip.start_date} ~ {trip.end_date}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="content-section">
      <div className="section-header flex-wrap" style={{ gap: '1.5cqmin 2.5cqmin' }}>
        <h3 className="section-title m-0 min-w-0 flex-1">{t.section_title}</h3>
        {currentGroupId ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-[1.5cqmin]">
            {onImportClick ? (
              <button
                type="button"
                onClick={onImportClick}
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-violet-300 bg-white font-bold text-violet-800"
                style={{ gap: '1cqmin', padding: '1.5cqmin 2.5cqmin', fontSize: '4.5cqmin' }}
              >
                {t.import_open_button}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onAddClick}
              className="inline-flex cursor-pointer items-center justify-center rounded-full border-none bg-[#9333ea] font-bold text-white"
              style={{ gap: '1cqmin', padding: '1.5cqmin 2.5cqmin', fontSize: '4.5cqmin' }}
            >
              <Plus style={{ width: '4.5cqmin', height: '4.5cqmin' }} />
              {t.add_trip}
            </button>
          </div>
        ) : null}
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div style={{ fontSize: '5cqmin' }} className="text-[#64748b]">
            {t.select_group}
          </div>
        ) : loading ? (
          <div style={{ fontSize: '5cqmin' }} className="text-[#64748b]">
            {t.trips_loading}
          </div>
        ) : plannerTrips.length === 0 ? (
          <div style={{ fontSize: '5cqmin', lineHeight: 1.6 }} className="text-[#475569] [word-break:keep-all]">
            {t.empty_state}
          </div>
        ) : (
          <ul
            ref={tripListRef}
            className={`travel-trip-list m-0 list-none p-0${tripsScrollable ? ' travel-trip-list--scroll' : ''}`}
            style={
              tripsScrollable && tripListMaxPx != null
                ? { ['--travel-trip-list-max-h' as string]: `${tripListMaxPx}px` }
                : undefined
            }
          >
            {plannerTrips.map((trip) => (
              <li
                key={trip.id}
                onClick={() => onTripClick(trip.id)}
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
        )}
      </div>
    </section>
  );
}
