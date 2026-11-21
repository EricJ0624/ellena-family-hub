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
  getAvg: (status: BabyRecentStatus) => string | null;
}

function feedingAvgLine(status: BabyRecentStatus, t: BabyGrowthTranslations): string | null {
  const a = status.averages;
  if (a.feedingBreast7d <= 0 && a.feedingBottle7d <= 0 && a.feedingSolid7d <= 0) return null;
  return t.avg_feeding_count
    .replace('{breastToday}', String(a.feedingBreastToday))
    .replace('{bottleToday}', String(a.feedingBottleToday))
    .replace('{solidToday}', String(a.feedingSolidToday))
    .replace('{breast7d}', String(a.feedingBreast7d))
    .replace('{bottle7d}', String(a.feedingBottle7d))
    .replace('{solid7d}', String(a.feedingSolid7d));
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
      getValue: (s) => {
        if (!s.lastFeeding) return null;
        const ago = formatTimeAgo(s.lastFeeding.logged_at, t);
        const ml = s.lastFeeding.feeding_amount_ml;
        const breast =
          (s.lastFeeding.breast_left_min ?? 0) + (s.lastFeeding.breast_right_min ?? 0);
        if (ml) return `${ago} · ${ml}ml`;
        if (breast > 0) return `${ago} · ${breast}분`;
        return ago;
      },
      getAvg: (s) => feedingAvgLine(s, t),
    },
    {
      key: 'sleep',
      label: t.last_sleep,
      emoji: '😴',
      getValue: () => {
        const text = describeLastSleep(profile, logs, t);
        return text === t.no_record ? null : text;
      },
      getAvg: (s) =>
        s.averages.sleepAvgMin7d != null
          ? t.avg_sleep_min.replace('{n}', String(s.averages.sleepAvgMin7d))
          : null,
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
        const consistencyKey = s.lastDiaper.diaper_consistency
          ? (`diaper_consistency_${s.lastDiaper.diaper_consistency}` as keyof BabyGrowthTranslations)
          : null;
        const consistencyLabel =
          consistencyKey && typeof t[consistencyKey] === 'string'
            ? (t[consistencyKey] as string)
            : '';
        const bits = [
          formatTimeAgo(s.lastDiaper.logged_at, t),
          typeName,
          consistencyLabel,
        ].filter(Boolean);
        return bits.join(' · ');
      },
      getAvg: (s) => {
        const { diaperWetToday, diaperDirtyToday, diaperWet7d, diaperDirty7d } = s.averages;
        if (diaperWet7d <= 0 && diaperDirty7d <= 0) return null;
        return t.avg_diaper_count
          .replace('{wetToday}', String(diaperWetToday))
          .replace('{dirtyToday}', String(diaperDirtyToday))
          .replace('{wet7d}', String(diaperWet7d))
          .replace('{dirty7d}', String(diaperDirty7d));
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
      getAvg: (s) =>
        s.averages.tempAvgC7d != null
          ? t.avg_temp_c.replace('{n}', String(s.averages.tempAvgC7d))
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
          const avg = card.getAvg(status);
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
                    ? 'relative z-20 flex h-full min-h-0 flex-col items-start gap-0.5 overflow-visible p-1.5'
                    : 'relative z-20 flex h-full min-h-[6.5rem] flex-col items-start gap-1 p-2.5'
                }
              >
                <div className="flex w-fit max-w-full shrink-0 items-center gap-1.5">
                  <span className="text-base leading-none">{card.emoji}</span>
                  <span className="truncate text-xs font-medium text-gray-500">
                    {card.label}
                  </span>
                </div>
                {/* overflow 없음 + 집계 줄 분리 — AI 배너로 높이가 줄어도 2줄 잘림 방지 */}
                <div className="flex w-full min-h-0 flex-1 flex-col items-start justify-start gap-0.5">
                  <span
                    className={`w-full shrink-0 text-xs font-semibold leading-normal ${
                      fillHeight ? 'truncate' : 'line-clamp-2'
                    } ${value ? 'text-gray-800' : 'text-gray-400'}`}
                  >
                    {value ?? t.no_record}
                  </span>
                  {avg
                    ? avg.split('\n').map((line, i) => (
                        <span
                          key={`avg-${i}`}
                          className="w-full shrink-0 truncate text-[10px] font-medium leading-normal text-gray-500"
                        >
                          {line}
                        </span>
                      ))
                    : null}
                  {!(card.key === 'sleep' && showSleepActions) ? (
                    <span className="inline-block shrink-0 text-[10px] font-medium leading-normal text-pink-400">
                      {t.record_now} +
                    </span>
                  ) : null}
                </div>
                {card.key === 'sleep' && showSleepActions ? (
                  <span className="mt-0.5 flex w-full shrink-0 gap-1">
                    {onBed && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onBed(); }}
                        className="flex-1 rounded-md bg-indigo-500 py-0.5 text-center text-[10px] font-semibold text-white"
                      >
                        {t.sleep_bed_btn}
                      </button>
                    )}
                    {onWake && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onWake(); }}
                        className="flex-1 rounded-md bg-amber-500 py-0.5 text-center text-[10px] font-semibold text-white"
                      >
                        {t.sleep_wake_btn}
                      </button>
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
