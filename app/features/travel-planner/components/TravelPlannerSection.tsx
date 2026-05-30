/**
 * 가족 여행 플래너(Travel Planner) 섹션 컴포넌트
 * Dashboard용 여행 목록 카드 뷰
 */

'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import type { TravelTrip } from '../types';

interface TravelPlannerSectionProps {
  trips: TravelTrip[];
  loading: boolean;
  currentGroupId: string | null;
  onTripClick: (tripId: string) => void;
  onAddClick: () => void;
  translations: {
    section_title: string;
    add_trip: string;
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
  translations: t,
}: TravelPlannerSectionProps) {
  return (
    <section className="content-section">
      <div className="section-header flex-wrap" style={{ gap: '1.5cqmin 2.5cqmin' }}>
        <h3 className="section-title m-0 min-w-0 flex-1">
          {t.section_title}
        </h3>
        <div className={`w-full sm:w-auto ${currentGroupId ? '' : 'min-w-0'}`}>
          {currentGroupId ? (
            <button
              type="button"
              onClick={onAddClick}
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border-none bg-[#9333ea] font-bold text-white transition-colors hover:bg-[#7e22ce] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 sm:w-auto"
              style={{ gap: '1.5cqmin', padding: '2cqmin 3cqmin', fontSize: '5cqmin' }}
            >
              <Plus style={{ width: '5cqmin', height: '5cqmin' }} />
              {t.add_trip}
            </button>
          ) : null}
        </div>
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
        ) : trips.length === 0 ? (
          <div style={{ fontSize: '5cqmin', lineHeight: 1.6 }} className="text-[#475569] [word-break:keep-all]">
            {t.empty_state}
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {trips.map((trip) => (
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
