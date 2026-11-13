'use client';

import React from 'react';
import { formatTimeAgo } from '../utils/age-calculator';
import type { BabyRecentStatus, LogType } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface QuickStatusCardsProps {
  status: BabyRecentStatus;
  t: BabyGrowthTranslations;
  onCardClick: (logType: LogType) => void;
}

interface CardConfig {
  key: LogType;
  label: string;
  emoji: string;
  getValue: (status: BabyRecentStatus) => string | null;
}

export function QuickStatusCards({ status, t, onCardClick }: QuickStatusCardsProps) {
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
      getValue: (s) =>
        s.lastSleep ? formatTimeAgo(s.lastSleep.logged_at, t) : null,
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
    <div className="grid grid-cols-2 gap-2 w-full">
      {cards.map((card) => {
        const value = card.getValue(status);
        return (
          <button
            key={card.key}
            onClick={() => onCardClick(card.key)}
            className="flex flex-col items-start gap-1 p-2.5 rounded-xl bg-white/60 dark:bg-white/10 border border-gray-100 dark:border-white/10 hover:bg-pink-50 dark:hover:bg-pink-900/20 active:scale-95 transition-all text-left min-h-[68px]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">{card.emoji}</span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {card.label}
              </span>
            </div>
            <span
              className={`text-xs font-semibold leading-snug ${
                value ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'
              }`}
            >
              {value ?? t.no_record}
            </span>
            <span className="text-[10px] text-pink-400 font-medium mt-auto">
              {t.record_now} +
            </span>
          </button>
        );
      })}
    </div>
  );
}
