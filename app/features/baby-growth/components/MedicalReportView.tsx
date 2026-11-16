'use client';

import React, { useMemo, useState } from 'react';
import type { BabyCheckup, BabyDailyLog, BabyDailyLogDraft } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { BABY_SYMPTOM_CHIPS, BABY_SYMPTOM_EMOJI } from '../utils/symptom-chips';

type TimelineItem = {
  id: string;
  at: number;
  label: string;
  text: string;
};

interface MedicalReportViewProps {
  logs: BabyDailyLog[];
  t: BabyGrowthTranslations;
  checkups?: BabyCheckup[];
  babyId?: string;
  groupId?: string;
  onAddLog?: (draft: BabyDailyLogDraft) => Promise<unknown>;
}

export function MedicalReportView({ logs, t, checkups, babyId, groupId, onAddLog }: MedicalReportViewProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [symptomNote, setSymptomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [savingSymptom, setSavingSymptom] = useState(false);

  const columns = useMemo(() => buildSymptomColumns(logs, t), [logs, t]);

  const summaryText = useMemo(() => {
    const lines = [t.report_title];
    for (const col of columns) {
      if (col.items.length === 0) continue;
      lines.push(
        `${col.title}: ${col.items.map((i) => `${i.label} ${i.text}`).join(', ')}`,
      );
    }
    return lines.join('\n');
  }, [columns, t.report_title]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const shareSummary = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.report_title, text: summaryText });
        return;
      } catch {
        return;
      }
    }
    await copySummary();
  };

  const saveSymptom = async () => {
    if (!onAddLog || !babyId || !groupId || (tags.length === 0 && !symptomNote.trim())) return;
    setSavingSymptom(true);
    try {
      await onAddLog({
        baby_id: babyId,
        group_id: groupId,
        log_type: 'symptom',
        logged_at: new Date().toISOString(),
        symptom_tags: tags.join(','),
        notes: symptomNote.trim() || undefined,
      });
      setTags([]);
      setSymptomNote('');
    } finally {
      setSavingSymptom(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{t.report_title}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void copySummary()}
            className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] dark:bg-gray-800"
          >
            {copied ? t.report_copied : t.report_copy}
          </button>
          <button
            type="button"
            onClick={() => void shareSummary()}
            className="rounded-lg bg-pink-500 px-2 py-1 text-[11px] text-white"
          >
            {t.report_share}
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t.symptom_title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {BABY_SYMPTOM_CHIPS.map((chip) => {
            const on = tags.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() =>
                  setTags((prev) => (on ? prev.filter((x) => x !== chip) : [...prev, chip]))
                }
                className={`rounded-full px-2.5 py-1 text-xs ${
                  on ? 'bg-rose-500 text-white' : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
        <textarea
          value={symptomNote}
          onChange={(e) => setSymptomNote(e.target.value)}
          rows={2}
          placeholder={t.symptom_note}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
        <button
          type="button"
          disabled={savingSymptom || !onAddLog}
          onClick={() => void saveSymptom()}
          className="w-full rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {t.symptom_save}
        </button>
      </section>

      {/* 증상별 가로 칸 + 세로 시간순 */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          {t.report_timeline_title}
        </h3>
        {columns.length === 0 ? (
          <p className="m-0 text-center text-[10px] text-gray-400">{t.no_record}</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex w-[9.5rem] shrink-0 flex-col rounded-xl border border-rose-100 bg-rose-50/60 p-2 dark:border-rose-900/40 dark:bg-rose-950/20"
              >
                <p className="m-0 mb-1.5 text-center text-xs font-bold text-rose-600 dark:text-rose-300">
                  {col.emoji} {col.title}
                </p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {col.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg bg-white/90 px-1.5 py-1 text-[10px] leading-snug text-gray-700 shadow-sm dark:bg-gray-900/70 dark:text-gray-200"
                    >
                      <span className="font-semibold text-pink-500">{item.label}</span>
                      <span className="mt-0.5 block">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {checkups && checkups.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
            🏥 {t.checkup_title}
          </h3>
          <div className="space-y-2">
            {checkups.slice(-5).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl bg-teal-50 p-3 dark:bg-teal-900/20"
              >
                <span className="whitespace-nowrap rounded-full bg-teal-500 px-2 py-0.5 text-xs font-bold text-white">
                  {c.checkup_type}
                </span>
                <span className="flex-1 text-xs text-gray-600 dark:text-gray-400">
                  {new Date(c.checkup_date).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex gap-2 text-xs text-gray-500">
                  {c.weight_kg != null && <span>{c.weight_kg}kg</span>}
                  {c.height_cm != null && <span>{c.height_cm}cm</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function buildSymptomColumns(logs: BabyDailyLog[], t: BabyGrowthTranslations) {
  const typeMap: Record<string, string> = {
    wet: t.diaper_wet,
    dirty: t.diaper_dirty,
    mixed: t.diaper_mixed,
    dry: t.diaper_dry,
  };

  const feverItems: TimelineItem[] = [];
  const medicationItems: TimelineItem[] = [];
  for (const l of logs) {
    if (l.log_type === 'temperature' && l.temperature_celsius != null) {
      feverItems.push({
        id: `t-${l.id}`,
        at: new Date(l.logged_at).getTime(),
        label: formatTime(l.logged_at),
        text: `${l.temperature_celsius}°C`,
      });
    }
    if (l.log_type === 'medication' && l.medication_name) {
      medicationItems.push({
        id: `m-${l.id}`,
        at: new Date(l.logged_at).getTime(),
        label: formatTime(l.logged_at),
        text: `${l.medication_name}${l.medication_dose_mg != null ? ` ${l.medication_dose_mg}mg` : ''}`,
      });
    }
  }
  feverItems.sort((a, b) => a.at - b.at);
  medicationItems.sort((a, b) => a.at - b.at);

  const diarrheaItems: TimelineItem[] = logs
    .filter((l) => l.log_type === 'diaper')
    .map((l) => {
      const typeName = l.diaper_type ? (typeMap[l.diaper_type] ?? '') : '';
      const cKey = l.diaper_consistency
        ? (`diaper_consistency_${l.diaper_consistency}` as keyof BabyGrowthTranslations)
        : null;
      const cLabel =
        cKey && typeof t[cKey] === 'string' ? (t[cKey] as string) : l.diaper_consistency ?? '';
      return {
        id: `d-${l.id}`,
        at: new Date(l.logged_at).getTime(),
        label: formatTime(l.logged_at),
        text: [typeName, cLabel].filter(Boolean).join(' · ') || t.log_diaper,
      };
    })
    .sort((a, b) => a.at - b.at);

  const otherChips = BABY_SYMPTOM_CHIPS.filter((c) => c !== '열' && c !== '설사');

  const columns: {
    key: string;
    title: string;
    emoji: string;
    items: TimelineItem[];
  }[] = [
    { key: 'fever', title: '열', emoji: BABY_SYMPTOM_EMOJI['열'], items: feverItems },
    { key: 'medication', title: t.log_medication, emoji: '💊', items: medicationItems },
    { key: 'diarrhea', title: '설사', emoji: BABY_SYMPTOM_EMOJI['설사'], items: diarrheaItems },
  ];

  for (const chip of otherChips) {
    const items = logs
      .filter(
        (l) =>
          l.log_type === 'symptom' &&
          (l.symptom_tags ?? '')
            .split(',')
            .map((s) => s.trim())
            .includes(chip),
      )
      .map((l) => ({
        id: `s-${chip}-${l.id}`,
        at: new Date(l.logged_at).getTime(),
        label: formatTime(l.logged_at),
        text: l.notes?.trim() || chip,
      }))
      .sort((a, b) => a.at - b.at);
    if (items.length === 0) continue;
    columns.push({ key: chip, title: chip, emoji: BABY_SYMPTOM_EMOJI[chip], items });
  }

  return columns.filter((col) => col.items.length > 0);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
