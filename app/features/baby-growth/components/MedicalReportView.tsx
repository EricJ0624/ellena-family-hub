'use client';

import React, { useMemo, useState } from 'react';
import type { BabyCheckup, BabyDailyLog, BabyDailyLogDraft } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

const SYMPTOM_CHIPS = ['열', '구토', '설사', '발진', '기침', '콧물', '보챔'] as const;

interface MedicalReportViewProps {
  logs: BabyDailyLog[];
  t: BabyGrowthTranslations;
  checkups?: BabyCheckup[];
  babyId?: string;
  groupId?: string;
  onAddLog?: (draft: BabyDailyLogDraft) => Promise<unknown>;
}

interface TempPoint {
  time: string;
  label: string;
  value: number;
}

interface MedEvent {
  time: string;
  label: string;
  name: string;
  dose: number | null;
}

export function MedicalReportView({ logs, t, checkups, babyId, groupId, onAddLog }: MedicalReportViewProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [symptomNote, setSymptomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [savingSymptom, setSavingSymptom] = useState(false);
  const tempLogs = useMemo(
    () =>
      logs
        .filter((l) => l.log_type === 'temperature' && l.temperature_celsius != null)
        .slice(0, 48)
        .reverse(),
    [logs]
  );

  const medLogs = useMemo(
    () =>
      logs
        .filter((l) => l.log_type === 'medication' && l.medication_name)
        .slice(0, 20)
        .reverse(),
    [logs]
  );

  const tempPoints: TempPoint[] = tempLogs.map((l) => ({
    time: l.logged_at,
    label: formatTime(l.logged_at),
    value: l.temperature_celsius!,
  }));

  const medEvents: MedEvent[] = medLogs.map((l) => ({
    time: l.logged_at,
    label: formatTime(l.logged_at),
    name: l.medication_name!,
    dose: l.medication_dose_mg,
  }));

  const symptomLogs = logs.filter((l) => l.log_type === 'symptom').slice(0, 20);

  const summaryText = [
    t.report_title,
    tempPoints.length ? `체온: ${tempPoints.map((p) => `${p.label} ${p.value}°C`).join(', ')}` : '체온 기록 없음',
    medEvents.length ? `투약: ${medEvents.map((e) => `${e.label} ${e.name}${e.dose != null ? ` ${e.dose}mg` : ''}`).join(', ')}` : '투약 기록 없음',
    symptomLogs.length
      ? `증상: ${symptomLogs.map((l) => `${formatTime(l.logged_at)} ${l.symptom_tags ?? ''} ${l.notes ?? ''}`).join(' / ')}`
      : '증상 기록 없음',
  ].join('\n');

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
        /* 사용자가 공유를 닫은 경우 복사로 폴백하지 않음 */
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
          <button type="button" onClick={() => void copySummary()} className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800">
            {copied ? t.report_copied : t.report_copy}
          </button>
          <button type="button" onClick={() => void shareSummary()} className="text-[11px] px-2 py-1 rounded-lg bg-pink-500 text-white">
            {t.report_share}
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t.symptom_title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOM_CHIPS.map((chip) => {
            const on = tags.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setTags((prev) => on ? prev.filter((x) => x !== chip) : [...prev, chip])}
                className={`px-2.5 py-1 rounded-full text-xs ${on ? 'bg-rose-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
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
          className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
        />
        <button
          type="button"
          disabled={savingSymptom || !onAddLog}
          onClick={() => void saveSymptom()}
          className="w-full py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white disabled:opacity-50"
        >
          {t.symptom_save}
        </button>
        {symptomLogs.length > 0 && (
          <ul className="space-y-1">
            {symptomLogs.map((l) => (
              <li key={l.id} className="text-xs text-gray-600 dark:text-gray-300">
                {formatTime(l.logged_at)} · {l.symptom_tags || l.notes}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 체온 그래프 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
          🌡️ {t.temperature_chart}
        </h3>
        {tempPoints.length === 0 ? (
          <p className="text-xs text-gray-400">{t.no_temperature_data}</p>
        ) : (
          <TempLineChart points={tempPoints} />
        )}
      </section>

      {/* 해열제 타임라인 */}
      {medEvents.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
            💊 {t.medication_timeline}
          </h3>
          <div className="space-y-2">
            {medEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{ev.name}</span>
                  {ev.dose != null && (
                    <span className="text-xs text-gray-500 ml-1">{ev.dose}mg</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{ev.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 영유아 검진 요약 */}
      {checkups && checkups.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
            🏥 {t.checkup_title}
          </h3>
          <div className="space-y-2">
            {checkups.slice(-5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20">
                <span className="text-xs font-bold bg-teal-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                  {c.checkup_type}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">
                  {new Date(c.checkup_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
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

// ---------------------------------------------------------------------------
// 간단한 SVG 꺾은선 그래프 (외부 라이브러리 미사용)
// ---------------------------------------------------------------------------
function TempLineChart({ points }: { points: TempPoint[] }) {
  const W = 320;
  const H = 120;
  const PADDING = { top: 16, right: 8, bottom: 24, left: 32 };

  const values = points.map((p) => p.value);
  const minV = Math.max(35, Math.min(...values) - 0.5);
  const maxV = Math.min(42, Math.max(...values) + 0.5);
  const range = maxV - minV || 1;

  const toX = (i: number) =>
    PADDING.left + (i / Math.max(points.length - 1, 1)) * (W - PADDING.left - PADDING.right);
  const toY = (v: number) =>
    PADDING.top + (1 - (v - minV) / range) * (H - PADDING.top - PADDING.bottom);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ');

  // 발열 기준선 (38.0°C)
  const feverY = toY(38.0);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="text-blue-500"
        style={{ minWidth: W }}
        aria-label="체온 그래프"
      >
        {/* 발열 기준선 */}
        {feverY > PADDING.top && feverY < H - PADDING.bottom && (
          <>
            <line
              x1={PADDING.left}
              y1={feverY}
              x2={W - PADDING.right}
              y2={feverY}
              stroke="#f97316"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.6}
            />
            <text x={PADDING.left - 2} y={feverY - 3} fontSize={9} fill="#f97316" textAnchor="end">
              38°
            </text>
          </>
        )}

        {/* Y축 레이블 */}
        {[minV, (minV + maxV) / 2, maxV].map((v) => (
          <text
            key={v}
            x={PADDING.left - 4}
            y={toY(v) + 4}
            fontSize={9}
            fill="#9ca3af"
            textAnchor="end"
          >
            {v.toFixed(1)}
          </text>
        ))}

        {/* 꺾은선 */}
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />

        {/* 데이터 점 + 시간 레이블 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.value)} r={3} fill="currentColor" />
            {/* 첫/마지막 레이블만 표시 */}
            {(i === 0 || i === points.length - 1) && (
              <text
                x={toX(i)}
                y={H - 4}
                fontSize={8}
                fill="#9ca3af"
                textAnchor="middle"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
