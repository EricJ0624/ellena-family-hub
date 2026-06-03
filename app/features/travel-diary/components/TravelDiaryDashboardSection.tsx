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
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title m-0">{t.section_title}</h3>
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <p className="m-0 text-sm text-slate-500">{t.select_group}</p>
        ) : loading ? (
          <p className="m-0 text-sm text-slate-500">{t.loading}</p>
        ) : list.length === 0 ? (
          <p className="m-0 text-sm text-slate-600">{t.empty_pick_trip}</p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {list.map((trip) => (
              <li
                key={trip.id}
                className="glass-panel-soft rounded-lg px-3 py-2.5"
              >
                <div className="font-semibold text-slate-800">{trip.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {trip.start_date} ~ {trip.end_date}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {trip.diary_enabled ? (
                    <button
                      type="button"
                      onClick={() => onOpenTrip(trip.id)}
                      className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      {t.open_diary}
                    </button>
                  ) : canUserOptInDiaryForTrip(trip) ? (
                    <button
                      type="button"
                      onClick={() => void onStartTrip(trip.id)}
                      className="cursor-pointer rounded-lg border-0 bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-200"
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
