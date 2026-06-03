'use client';

import React from 'react';
import type { TravelTrip } from '@/app/features/travel-planner/types';

type Props = {
  open: boolean;
  trip: TravelTrip | null;
  title: string;
  body: string;
  yesLabel: string;
  laterLabel: string;
  acting: boolean;
  onAccept: () => void;
  onDismiss: () => void;
};

export function DiaryCompletionInviteModal({
  open,
  trip,
  title,
  body,
  yesLabel,
  laterLabel,
  acting,
  onAccept,
  onDismiss,
}: Props) {
  if (!open || !trip) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="glass-panel max-w-md w-full rounded-2xl p-6 shadow-xl"
      >
        <h2 className="m-0 text-lg font-bold text-slate-800">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <p className="mt-3 text-sm font-semibold text-violet-800">{trip.title}</p>
        <p className="m-0 mt-1 text-xs text-slate-500">
          {trip.start_date} ~ {trip.end_date}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={acting}
            onClick={onDismiss}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {laterLabel}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={onAccept}
            className="cursor-pointer rounded-lg border-0 bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
