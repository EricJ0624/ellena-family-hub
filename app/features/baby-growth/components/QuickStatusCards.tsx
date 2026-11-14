'use client';

import React from 'react';
import { formatTimeAgo } from '../utils/age-calculator';
import { describeLastSleep } from '../utils/sleep-schedule';
import type { BabyDailyLog, BabyProfile, BabyRecentStatus, LogType } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { Sticker } from './BabyWidgetBackdrop';

interface QuickStatusCardsProps {
  status: BabyRecentStatus;
  profile: BabyProfile | null;
  logs: BabyDailyLog[];
  t: BabyGrowthTranslations;
  onCardClick: (logType: LogType) => void;
  onBed?: () => void;
  onWake?: () => void;
  /** 위젯 1페이지: 남은 높이에 2×2 카드 맞춤 */
  fillHeight?: boolean;
}

interface CardConfig {
  key: LogType;
  label: string;
  emoji: string;
  getValue: (status: BabyRecentStatus) => string | null;
}

/** 카드별 장식. 카드 면(z-5) 위·글자(z-20) 아래. */
function CardStickers({ cardKey }: { cardKey: LogType }) {
  if (cardKey === 'feeding') {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible" aria-hidden>
        <Sticker
          src="/baby-widget/hands.png?v=7"
          className="absolute right-2 -top-1 w-[36%]"
        />
      </div>
    );
  }
  if (cardKey === 'sleep') {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
        <Sticker
          src="/baby-widget/sun-cloud.png?v=6"
          className="absolute -right-1 top-0 w-[40%]"
        />
      </div>
    );
  }
  if (cardKey === 'temperature') {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible" aria-hidden>
        <Sticker
          src="/baby-widget/heart.png?v=5"
          className="absolute bottom-0 right-0 w-[48%]"
        />
      </div>
    );
  }
  return null;
}

export function QuickStatusCards({
  status,
  profile,
  logs,
  t,
  onCardClick,
  onBed,
  onWake,
  fillHeight = false,
}: QuickStatusCardsProps) {
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

  const showSleepActions = Boolean(onBed || onWake);

  return (
    <div className={`relative w-full overflow-visible ${fillHeight ? 'h-full min-h-0' : ''}`}>
      {/* 방울·블록: 카드 뒤. 카드 면이 반투명이라 겹치는 구간만 비침 */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-visible" aria-hidden>
        <Sticker
          src="/baby-widget/rattle.png?v=5"
          className="absolute -left-2 top-[34%] w-[22%] origin-center -rotate-[18deg]"
        />
        <Sticker
          src="/baby-widget/blocks.png?v=5"
          className="absolute -right-1 top-[44%] w-[13%]"
        />
      </div>

      <div
        className={
          fillHeight
            ? 'relative z-[1] grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-1.5'
            : 'relative z-[1] grid grid-cols-2 gap-2'
        }
      >
        {cards.map((card) => {
          const value = card.getValue(status);
          return (
            <div
              key={card.key}
              role="button"
              tabIndex={0}
              onClick={() => onCardClick(card.key)}
              onKeyDown={(e) => { if (e.key === 'Enter') onCardClick(card.key); }}
              className={
                fillHeight
                  ? 'group relative min-h-0 cursor-pointer overflow-visible text-left'
                  : 'group relative min-h-[6.5rem] cursor-pointer overflow-visible text-left'
              }
            >
              <div
                className={`pointer-events-none absolute inset-0 z-[5] rounded-2xl border shadow-sm group-hover:bg-pink-50/80 ${
                  value ? 'border-white/90 bg-white/70' : 'border-white/70 bg-white/60'
                }`}
              />
              <CardStickers cardKey={card.key} />
              <div
                className={
                  fillHeight
                    ? 'relative z-20 flex h-full min-h-0 flex-col items-start gap-0.5 overflow-hidden p-2'
                    : 'relative z-20 flex h-full min-h-[6.5rem] flex-col items-start gap-1 p-2.5'
                }
              >
                <div className="flex w-fit max-w-full shrink-0 items-center gap-1.5">
                  <span className="text-base leading-none">{card.emoji}</span>
                  <span className="truncate text-xs font-medium text-gray-500">
                    {card.label}
                  </span>
                </div>
                {/* shrink-0 + leading-normal: fillHeight flex 압축·line-clamp가 한글 하단을 자르지 않게 */}
                <span
                  className={`line-clamp-2 w-full shrink-0 text-xs font-semibold leading-normal ${
                    value ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {value ?? t.no_record}
                </span>
                <span className="w-fit shrink-0 text-[10px] font-medium leading-normal text-pink-400">
                  {t.record_now} +
                </span>
                {card.key === 'sleep' && showSleepActions ? (
                  <span className="mt-auto flex w-full shrink-0 gap-1">
                    {onBed && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onBed(); }}
                        className="flex-1 rounded-md bg-indigo-500 py-1 text-center text-[10px] font-semibold text-white"
                      >
                        {t.sleep_bed_btn}
                      </button>
                    )}
                    {onWake && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onWake(); }}
                        className="flex-1 rounded-md bg-amber-500 py-1 text-center text-[10px] font-semibold text-white"
                      >
                        {t.sleep_wake_btn}
                      </button>
                    )}
                  </span>
                ) : (
                  <span className={`mt-auto w-full shrink-0 ${showSleepActions ? 'h-[26px]' : ''}`} aria-hidden />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
