'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { DiaryTimelineSlot } from '@/lib/modules/travel-planner/diary-timeline';
import { useGroup } from '@/app/contexts/GroupContext';
import {
  diaryCardShellClass,
  diaryDateClass,
  diaryTitleClass,
} from '@/lib/modules/travel-planner/diary-entry-theme';

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
  const { uiTheme } = useGroup();
  const isFamilyTheme = uiTheme === 'kids_friendly';
  const isNightShell = uiTheme === 'highend_glass';
  const isDarkPage = isFamilyTheme || isNightShell;
  const themeOpts = { isFamilyTheme, isNightShell };
  const [actingKey, setActingKey] = useState<string | null>(null);
  if (slots.length === 0) return null;

  return (
    <div className="mt-10">
      <h2
        className={[
          'm-0 mb-3 text-sm font-semibold',
          isDarkPage ? 'text-slate-200' : 'text-slate-600',
        ].join(' ')}
      >
        {sectionTitle}
      </h2>
      <ul className="m-0 list-none space-y-2 p-0">
        {slots.map((slot) => (
          <li
            key={slot.key}
            className={[
              'flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5',
              diaryCardShellClass(themeOpts),
            ].join(' ')}
          >
            <div className="min-w-0">
              <div
                className={[
                  'truncate text-sm font-semibold',
                  diaryTitleClass(themeOpts),
                ].join(' ')}
              >
                {slot.title}
              </div>
              <div
                className={[
                  'mt-0.5 text-xs font-semibold tabular-nums tracking-wide',
                  diaryDateClass(themeOpts),
                ].join(' ')}
              >
                {slot.day_date}
              </div>
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
              className={[
                'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60',
                isNightShell
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                  : 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100',
              ].join(' ')}
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
