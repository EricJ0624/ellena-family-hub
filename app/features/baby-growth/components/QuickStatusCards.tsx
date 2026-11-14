'use client';

import React from 'react';
import { formatTimeAgo } from '../utils/age-calculator';
import { describeLastSleep } from '../utils/sleep-schedule';
import type { BabyDailyLog, BabyProfile, BabyRecentStatus, LogType } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface QuickStatusCardsProps {
  status: BabyRecentStatus;
  profile: BabyProfile | null;
  logs: BabyDailyLog[];
  t: BabyGrowthTranslations;
  onCardClick: (logType: LogType) => void;
  onBed?: () => void;
  onWake?: () => void;
}

interface CardConfig {
  key: LogType;
  label: string;
  emoji: string;
  getValue: (status: BabyRecentStatus) => string | null;
}

export function QuickStatusCards({ status, profile, logs, t, onCardClick, onBed, onWake }: QuickStatusCardsProps) {
  const cards: CardConfig[] = [
    {
      key: 'feeding',
      label: t.last_feeding,
      emoji: '🍼',
      getValue: (s) =>
        s.lastFeeding
          ? formatTimeAgo(s.lastFeeding.logged_at, t) +
            (s.lastFeeding.feeding_amount_ml ? ` · ${s.lastFeeding.feeding_amount_ml}ml` : '')
          : null,
    },
    {
      key: 'sleep',
      label: t.last_sleep,
      emoji: '😴',
      getValue: () => {
        const text = describeLastSleep(profile, logs, t);
        return text === t.no_record ? null : text;
      },
    },
    {
      key: 'diaper',
      label: t.last_diaper,
      emoji: '🧷',
      getValue: (s) => {
        if (!s.lastDiaper) return null;
        const typeMap: Record<string, string> = {
          wet: t.diaper_wet,
          dirty: t.diaper_dirty,
          mixed: t.diaper_mixed,
          dry: t.diaper_dry,
        };
        const typeName = s.lastDiaper.diaper_type ? (typeMap[s.lastDiaper.diaper_type] ?? '') : '';
        return formatTimeAgo(s.lastDiaper.logged_at, t) + (typeName ? ` · ${typeName}` : '');
      },
    },
    {
      key: 'temperature',
      label: t.last_temperature,
      emoji: '🌡️',
      getValue: (s) =>
        s.lastTemperature
          ? (s.lastTemperature.temperature_celsius != null
              ? `${s.lastTemperature.temperature_celsius}°C · `
              : '') + formatTimeAgo(s.lastTemperature.logged_at, t)
          : null,
    },
  ];

  return (
    <div className="relative w-full">
      {cards.map((card, index) => {
        const value = card.getValue(status);
        return (
          <div
            key={card.key}
            role="button"
            tabIndex={0}
            onClick={() => onCardClick(card.key)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCardClick(card.key); }}
            className={`group relative inline-block w-[calc(50%-0.25rem)] cursor-pointer align-top text-left ${
              index % 2 === 0 ? 'mr-2' : ''
            } ${index < cards.length - 2 ? 'mb-2' : ''}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 z-0 rounded-2xl border shadow-sm group-hover:bg-pink-50 ${
                value ? 'border-white bg-white' : 'border-white/80 bg-white/90'
              }`}
            />
            <div className="relative z-20 flex min-h-[68px] flex-col items-start gap-1 p-2.5">
            <div className="flex w-fit items-center gap-1.5 rounded bg-white group-hover:bg-pink-50">
              <span className="text-base">{card.emoji}</span>
              <span className="text-xs font-medium text-gray-500">
                {card.label}
              </span>
            </div>
            <span
              className={`w-fit rounded bg-white text-xs font-semibold leading-snug group-hover:bg-pink-50 ${
                value ? 'text-gray-800' : 'text-gray-400'
              }`}
            >
              {value ?? t.no_record}
            </span>
            <span className="mt-auto w-fit rounded bg-white text-[10px] font-medium text-pink-400 group-hover:bg-pink-50">
              {t.record_now} +
            </span>
            {card.key === 'sleep' && (onBed || onWake) && (
              <span className="flex gap-1 w-full mt-1">
                {onBed && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onBed(); }}
                    className="flex-1 text-center text-[10px] font-semibold rounded-md bg-indigo-500 text-white py-1"
                  >
                    {t.sleep_bed_btn}
                  </button>
                )}
                {onWake && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onWake(); }}
                    className="flex-1 text-center text-[10px] font-semibold rounded-md bg-amber-500 text-white py-1"
                  >
                    {t.sleep_wake_btn}
                  </button>
                )}
              </span>
            )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
