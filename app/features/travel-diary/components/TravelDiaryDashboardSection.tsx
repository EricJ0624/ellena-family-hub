'use client';

import React from 'react';
import type { TravelTrip } from '@/app/features/travel-planner/types';
import { canUserOptInDiaryForTrip } from '@/lib/modules/travel-planner/diary-eligibility';

type Props = {
  trips: TravelTrip[];
  loading: boolean;
  currentGroupId: string | null;
  onOpenTrip: (tripId: string) => void;
  onStartTrip: (tripId: string) => Promise<void>;
  translations: {
    section_title: string;
    select_group: string;
    loading: string;
    empty_pick_trip: string;
    open_diary: string;
    start_trip_diary: string;
  };
};

export function TravelDiaryDashboardSection({
  trips,
  loading,
  currentGroupId,
  onOpenTrip,
  onStartTrip,
  translations: t,
}: Props) {
  const diaryTrips = trips.filter((x) => x.diary_enabled === true);
  const list = diaryTrips.length > 0 ? diaryTrips : trips;

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
      <div className="section-body relative z-[2]">
        {!currentGroupId ? (
          <p className="m-0 text-sm text-slate-600">{t.select_group}</p>
        ) : loading ? (
          <p className="m-0 text-sm text-slate-600">{t.loading}</p>
        ) : list.length === 0 ? (
          <p className="m-0 text-sm text-slate-700">{t.empty_pick_trip}</p>
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
        )}
      </div>
    </section>
  );
}
