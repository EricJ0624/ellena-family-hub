'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { DiaryTimelineSlot } from '@/lib/modules/travel-planner/diary-timeline';

type Props = {
  slots: DiaryTimelineSlot[];
  sectionTitle: string;
  restoreLabel: string;
  restoreFailedLabel: string;
  onRestore: (slot: DiaryTimelineSlot) => Promise<void>;
};

export function DiaryHiddenSlotList({
  slots,
  sectionTitle,
  restoreLabel,
  restoreFailedLabel,
  onRestore,
}: Props) {
  const [actingKey, setActingKey] = useState<string | null>(null);
  if (slots.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="m-0 mb-3 text-sm font-semibold text-slate-600">{sectionTitle}</h2>
      <ul className="m-0 list-none space-y-2 p-0">
        {slots.map((slot) => (
          <li
            key={slot.key}
            className="glass-panel-soft flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{slot.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{slot.day_date}</div>
            </div>
            <button
              type="button"
              disabled={actingKey === slot.key}
              onClick={() => {
                setActingKey(slot.key);
                void onRestore(slot)
                  .catch(() => {
                    alert(restoreFailedLabel);
                  })
                  .finally(() => setActingKey(null));
              }}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {restoreLabel}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
