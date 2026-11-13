'use client';

import React, { useMemo } from 'react';
import type { BabyDailyLog } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface DailyLogStatsProps {
  logs: BabyDailyLog[];
  t: BabyGrowthTranslations;
}

interface DayGroup {
  date: string;
  feedingCount: number;
  feedingTotalMl: number;
  sleepCount: number;
  sleepTotalMin: number;
  diaperCount: number;
  maxTemp: number | null;
}

export function DailyLogStats({ logs, t }: DailyLogStatsProps) {
  const days = useMemo(() => {
    const map = new Map<string, DayGroup>();

    for (const log of logs) {
      const date = log.logged_at.split('T')[0];
      if (!map.has(date)) {
        map.set(date, {
          date,
          feedingCount: 0,
          feedingTotalMl: 0,
          sleepCount: 0,
          sleepTotalMin: 0,
          diaperCount: 0,
          maxTemp: null,
        });
      }
      const group = map.get(date)!;

      if (log.log_type === 'feeding') {
        group.feedingCount++;
        group.feedingTotalMl += log.feeding_amount_ml ?? 0;
      } else if (log.log_type === 'sleep') {
        group.sleepCount++;
        if (log.sleep_end_at) {
          const start = new Date(log.logged_at).getTime();
          const end = new Date(log.sleep_end_at).getTime();
          group.sleepTotalMin += Math.round((end - start) / 60000);
        }
      } else if (log.log_type === 'diaper') {
        group.diaperCount++;
      } else if (log.log_type === 'temperature' && log.temperature_celsius != null) {
        group.maxTemp =
          group.maxTemp == null
            ? log.temperature_celsius
            : Math.max(group.maxTemp, log.temperature_celsius);
      }
    }

    return [...map.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  }, [logs]);

  if (days.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center text-xs text-gray-400">
        {t.no_record}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <h2 className="text-base font-bold">📊 최근 7일 통계</h2>

      {days.map((day) => (
        <div key={day.date} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-2">
          <p className="text-xs font-semibold text-gray-500">{day.date}</p>
          <div className="grid grid-cols-2 gap-2">
            <StatItem
              emoji="🍼"
              label={t.log_feeding}
              value={
                day.feedingCount > 0
                  ? `${day.feedingCount}회${day.feedingTotalMl > 0 ? ` · ${day.feedingTotalMl}ml` : ''}`
                  : '-'
              }
            />
            <StatItem
              emoji="😴"
              label={t.log_sleep}
              value={
                day.sleepCount > 0
                  ? `${day.sleepCount}회${day.sleepTotalMin > 0 ? ` · ${Math.round(day.sleepTotalMin / 60)}h` : ''}`
                  : '-'
              }
            />
            <StatItem
              emoji="🧷"
              label={t.log_diaper}
              value={day.diaperCount > 0 ? `${day.diaperCount}회` : '-'}
            />
            <StatItem
              emoji="🌡️"
              label={t.log_temperature}
              value={day.maxTemp != null ? `${day.maxTemp}°C` : '-'}
              highlight={day.maxTemp != null && day.maxTemp >= 38}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatItem({
  emoji, label, value, highlight = false,
}: { emoji: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{emoji}</span>
      <div>
        <p className="text-[10px] text-gray-500">{label}</p>
        <p className={`text-sm font-semibold ${highlight ? 'text-orange-500' : 'text-gray-700 dark:text-gray-200'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
