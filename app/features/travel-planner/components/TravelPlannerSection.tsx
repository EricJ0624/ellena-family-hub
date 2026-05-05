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
      <div className="section-header flex-wrap gap-x-3 gap-y-2">
        <h3 className="section-title m-0 min-w-0 flex-1">
          {t.section_title}
        </h3>
        <div className={`w-full sm:w-auto ${currentGroupId ? '' : 'min-w-0'}`}>
          {currentGroupId ? (
            <button
              type="button"
              onClick={onAddClick}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-[#9333ea] px-3 py-2 font-bold text-white transition-colors hover:bg-[#7e22ce] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              {t.add_trip}
            </button>
          ) : null}
        </div>
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div className="text-[13px] text-[#64748b]">
            {t.select_group}
          </div>
        ) : loading ? (
          <div className="text-[13px] text-[#64748b]">
            {t.trips_loading}
          </div>
        ) : trips.length === 0 ? (
          <div className="text-[13px] leading-[1.6] text-[#475569] [word-break:keep-all]">
            {t.empty_state}
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {trips.map((trip) => (
              <li
                key={trip.id}
                onClick={() => onTripClick(trip.id)}
                className="glass-panel-soft mb-1.5 cursor-pointer rounded-lg px-3 py-2.5 text-[13px] text-[#1e293b] transition-colors hover:border-[#cbd5e1] hover:bg-white/50"
              >
                <div className="font-semibold">{trip.title}</div>
                <div className="mt-0.5 text-xs text-[#64748b]">
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
