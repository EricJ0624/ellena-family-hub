'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { PrenatalLog } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { usePrenatalLogs } from '../hooks/usePrenatalLogs';
import { formatClockTime, groupByLocalDate } from '../utils/local-day-groups';

interface PrenatalTimelineViewProps {
  babyId: string;
  currentGroupId: string | null;
  userId: string;
  t: BabyGrowthTranslations;
}

function typeLabel(log: PrenatalLog, t: BabyGrowthTranslations): string {
  switch (log.log_type) {
    case 'maternal_weight': return t.prenatal_card_maternal;
    case 'blood_pressure': return t.prenatal_card_maternal;
    case 'fetal_size': return t.prenatal_card_fetal_size;
    case 'checkup_note': return t.prenatal_card_checkup;
    case 'fetal_movement': return t.prenatal_card_kicks;
    case 'lab_result': return t.prenatal_card_lab;
    case 'medication': return t.prenatal_medication_name;
    case 'symptom': return t.prenatal_log_symptom;
    default: return t.prenatal_card_diary;
  }
}

function bodyText(log: PrenatalLog, t: BabyGrowthTranslations): string {
  const bits: string[] = [];
  if (log.weight_kg != null) bits.push(`${log.weight_kg}kg`);
  if (log.systolic != null) bits.push(`${log.systolic}/${log.diastolic ?? '-'}`);
  if (log.fetal_size_label) bits.push(log.fetal_size_label);
  if (log.checkup_at) bits.push(log.checkup_at);
  if (log.hospital_name) bits.push(log.hospital_name);
  if (log.next_checkup_at) bits.push(`${t.prenatal_next_checkup} ${log.next_checkup_at}`);
  if (log.fundal_height_cm != null) bits.push(`${log.fundal_height_cm}cm`);
  if (log.fetal_weight_est_g != null) bits.push(`${log.fetal_weight_est_g}g`);
  if (log.kick_count != null) bits.push(`${log.kick_count}`);
  if (log.kick_duration_min != null) bits.push(`${log.kick_duration_min}min`);
  if (log.lab_name) bits.push(log.lab_name);
  if (log.lab_result_text) bits.push(log.lab_result_text);
  if (log.medication_name) bits.push(log.medication_name);
  if (log.symptom_tags) bits.push(log.symptom_tags);
  if (log.notes) bits.push(log.notes);
  return bits.join(' · ') || '—';
}

export function PrenatalTimelineView({
  babyId, currentGroupId, userId, t,
}: PrenatalTimelineViewProps) {
  const { fetchLogs } = usePrenatalLogs({ babyId, currentGroupId, userId });
  const [logs, setLogs] = useState<PrenatalLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const rows = await fetchLogs(200);
      if (!cancelled) {
        setLogs(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchLogs]);

  const dayGroups = useMemo(
    () => groupByLocalDate(logs, (log) => new Date(log.logged_at).getTime()),
    [logs],
  );

  if (loading) {
    return <p className="p-4 text-sm text-gray-400">{t.loading}</p>;
  }

  if (logs.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-base font-bold">{t.prenatal_timeline_title}</h2>
        <p className="mt-2 text-sm text-gray-400">{t.prenatal_timeline_empty}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <h2 className="text-base font-bold">{t.prenatal_timeline_title}</h2>
      <p className="text-xs text-gray-500">{t.prenatal_timeline_hint}</p>
      <div className="flex flex-col gap-4">
        {dayGroups.map((g) => (
          <section key={g.dateKey} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {g.dateLabel}
            </h3>
            <ul className="space-y-2">
              {g.items.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-pink-100 bg-pink-50/50 px-3 py-2 dark:border-pink-900/40 dark:bg-pink-950/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-pink-600">
                      {typeLabel(log, t)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatClockTime(log.logged_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">
                    {bodyText(log, t)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
