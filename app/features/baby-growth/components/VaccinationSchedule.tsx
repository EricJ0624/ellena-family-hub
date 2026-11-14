'use client';

import React, { useEffect, useState } from 'react';
import { useBabyGrowthRecords } from '../hooks/useBabyGrowthRecords';
import { buildVaccineDDayViews } from '../utils/vaccination-schedule';
import type { BabyProfile, BabyVaccination, VaccineDDayView } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface VaccinationScheduleProps {
  profile: BabyProfile;
  currentGroupId: string | null;
  userId: string;
  t: BabyGrowthTranslations;
}

export function VaccinationSchedule({
  profile, currentGroupId, userId, t,
}: VaccinationScheduleProps) {
  const [views, setViews] = useState<VaccineDDayView[]>([]);
  const [loading, setLoading] = useState(true);

  const { fetchVaccinations, upsertVaccination } = useBabyGrowthRecords({
    babyId: profile.id,
    currentGroupId,
    userId,
  });

  useEffect(() => {
    void (async () => {
      const vaxRecords = await fetchVaccinations();
      const administered = new Set(
        vaxRecords.filter((v) => v.administered_at).map((v) => v.vaccine_key)
      );
      const scheduled = new Map(
        vaxRecords.filter((v) => v.scheduled_at).map((v) => [v.vaccine_key, v.scheduled_at!])
      );
      const result = buildVaccineDDayViews(
        profile.country_code,
        profile.birth_date,
        administered,
        scheduled
      );
      setViews(result);
      setLoading(false);
    })();
  }, [fetchVaccinations, profile]);

  const handleToggleDone = async (view: VaccineDDayView) => {
    const newDone = !view.isDone;
    await upsertVaccination({
      baby_id: profile.id,
      group_id: currentGroupId ?? '',
      vaccine_key: view.vaccineKey,
      scheduled_at: view.scheduledAt,
      administered_at: newDone ? new Date().toISOString().split('T')[0] : null,
    });
    setViews((prev) =>
      prev.map((v) =>
        v.vaccineKey === view.vaccineKey
          ? { ...v, isDone: newDone, administeredAt: newDone ? view.scheduledAt : null }
          : v
      )
    );
  };

  if (loading) {
    return <div className="p-4 text-xs text-gray-400">{t.loading}</div>;
  }

  // 그룹: 완료, 예정 가까운 순, 나머지
  const upcoming = views.filter((v) => !v.isDone && v.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil);
  const overdue = views.filter((v) => !v.isDone && v.daysUntil < 0).sort((a, b) => a.daysUntil - b.daysUntil);
  const done = views.filter((v) => v.isDone);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-base font-bold">{t.vaccine_title}</h2>

      {/* 지난 접종 */}
      {overdue.length > 0 && (
        <Section title="⚠️ 지연" color="red">
          {overdue.map((v) => <VaccineRow key={v.vaccineKey} view={v} t={t} onToggle={handleToggleDone} />)}
        </Section>
      )}

      {/* 예정 접종 */}
      {upcoming.length > 0 && (
        <Section title="📅 예정" color="blue">
          {upcoming.map((v) => <VaccineRow key={v.vaccineKey} view={v} t={t} onToggle={handleToggleDone} />)}
        </Section>
      )}

      {/* 완료 */}
      {done.length > 0 && (
        <Section title="✅ 완료" color="green">
          {done.map((v) => <VaccineRow key={v.vaccineKey} view={v} t={t} onToggle={handleToggleDone} />)}
        </Section>
      )}
    </div>
  );
}

function Section({
  title, color, children,
}: { title: string; color: 'red' | 'blue' | 'green'; children: React.ReactNode }) {
  const colorMap = {
    red: 'text-red-500',
    blue: 'text-blue-500',
    green: 'text-green-500',
  };
  return (
    <section>
      <h3 className={`text-sm font-semibold mb-2 ${colorMap[color]}`}>{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function VaccineRow({
  view, t, onToggle,
}: { view: VaccineDDayView; t: BabyGrowthTranslations; onToggle: (v: VaccineDDayView) => void }) {
  const ddayLabel =
    view.daysUntil === 0
      ? t.vaccine_dday_today
      : view.daysUntil < 0
      ? t.vaccine_dday_past.replace('{n}', String(Math.abs(view.daysUntil)))
      : `D-${view.daysUntil}`;

  return (
    <button
      onClick={() => onToggle(view)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
        view.isDone
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : view.daysUntil < 0
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900'
      }`}
    >
      <span className="text-base">{view.isDone ? '✅' : '💉'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{view.label}</p>
        <p className="text-xs text-gray-400 truncate">{view.disease}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{ddayLabel}</p>
        <p className="text-[10px] text-gray-400">{view.scheduledAt}</p>
      </div>
    </button>
  );
}
