'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { BabyProfile, BabyGrowthRecord, BabyGrowthRecordDraft, BabyMilestone } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { useBabyGrowthRecords } from '../hooks/useBabyGrowthRecords';
import {
  WHO_WEIGHT_BOYS, WHO_WEIGHT_GIRLS,
  WHO_HEIGHT_BOYS, WHO_HEIGHT_GIRLS,
  estimatePercentile,
} from '../utils/who-growth-curves';
import { calcAgeInMonths } from '../utils/age-calculator';
import { MILESTONE_DEFINITIONS } from './MilestoneChecklist';

type Metric = 'weight' | 'height';

interface GrowthChartViewProps {
  profile: BabyProfile;
  currentGroupId: string | null;
  userId: string;
  t: BabyGrowthTranslations;
}

export function GrowthChartView({ profile, currentGroupId, userId, t }: GrowthChartViewProps) {
  const [records, setRecords] = useState<BabyGrowthRecord[]>([]);
  const [milestones, setMilestones] = useState<BabyMilestone[]>([]);
  const [metric, setMetric] = useState<Metric>('weight');
  const [addOpen, setAddOpen] = useState(false);

  const { fetchGrowthRecords, addGrowthRecord, fetchMilestones, upsertMilestone } =
    useBabyGrowthRecords({ babyId: profile.id, currentGroupId, userId });

  useEffect(() => {
    void fetchGrowthRecords().then(setRecords);
    void fetchMilestones().then(setMilestones);
  }, [fetchGrowthRecords, fetchMilestones]);

  const handleAddRecord = useCallback(
    async (draft: BabyGrowthRecordDraft) => {
      const rec = await addGrowthRecord(draft);
      setRecords((prev) => [...prev, rec].sort((a, b) => a.measured_at.localeCompare(b.measured_at)));
      setAddOpen(false);
    },
    [addGrowthRecord]
  );

  const handleToggleMilestone = useCallback(
    async (key: string, category: BabyMilestone['category'], achieved: boolean) => {
      await upsertMilestone({
        baby_id: profile.id,
        group_id: currentGroupId ?? '',
        category,
        milestone_key: key,
        achieved_at: achieved ? new Date().toISOString().split('T')[0] : null,
      });
      void fetchMilestones().then(setMilestones);
    },
    [upsertMilestone, fetchMilestones, profile.id, currentGroupId]
  );

  const latestRecord = records[records.length - 1] ?? null;
  const ageMonths = calcAgeInMonths(profile.birth_date);

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto">
      <h2 className="text-base font-bold">{t.growth_title}</h2>

      {/* 최근 측정값 요약 */}
      {latestRecord && (
        <div className="grid grid-cols-3 gap-2">
          {latestRecord.weight_kg != null && (
            <MetricBadge
              emoji="⚖️"
              label={t.weight_kg}
              value={`${latestRecord.weight_kg}kg`}
              percentile={estimatePercentile(latestRecord.weight_kg, ageMonths, 'weight', profile.gender ?? 'other')}
              t={t}
            />
          )}
          {latestRecord.height_cm != null && (
            <MetricBadge
              emoji="📏"
              label={t.height_cm}
              value={`${latestRecord.height_cm}cm`}
              percentile={estimatePercentile(latestRecord.height_cm, ageMonths, 'height', profile.gender ?? 'other')}
              t={t}
            />
          )}
          {latestRecord.head_cm != null && (
            <MetricBadge emoji="🧠" label={t.head_cm} value={`${latestRecord.head_cm}cm`} t={t} />
          )}
        </div>
      )}

      {/* WHO 성장 곡선 토글 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            📈 {t.who_percentile}
          </h3>
          <div className="flex gap-1">
            {(['weight', 'height'] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  metric === m
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                }`}
              >
                {m === 'weight' ? t.weight_kg : t.height_cm}
              </button>
            ))}
          </div>
        </div>
        <WhoChart
          records={records}
          metric={metric}
          gender={profile.gender ?? 'other'}
          birthDate={profile.birth_date}
        />
      </div>

      {/* 측정 추가 버튼 */}
      <button
        onClick={() => setAddOpen(true)}
        className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
      >
        + {t.add_measurement}
      </button>

      {/* 마일스톤 체크리스트 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
          🏆 {t.milestone_title}
        </h3>
        <MilestoneChecklist
          milestones={milestones}
          ageMonths={ageMonths}
          t={t}
          onToggle={handleToggleMilestone}
        />
      </section>

      {/* 성장 측정 추가 모달 */}
      {addOpen && (
        <AddGrowthRecordModal
          babyId={profile.id}
          currentGroupId={currentGroupId ?? ''}
          t={t}
          onSave={handleAddRecord}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricBadge
// ---------------------------------------------------------------------------
function percentilePeerLabel(
  percentile: number,
  t: BabyGrowthTranslations,
): string {
  if (percentile <= 3) return t.percentile_peer_very_small;
  if (percentile <= 15) return t.percentile_peer_small;
  if (percentile <= 50) return t.percentile_peer_average;
  if (percentile <= 85) return t.percentile_peer_large;
  return t.percentile_peer_very_large;
}

function MetricBadge({
  emoji, label, value, percentile, t,
}: {
  emoji: string;
  label: string;
  value: string;
  percentile?: number;
  t: BabyGrowthTranslations;
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-center">
      <span className="text-xl">{emoji}</span>
      <span className="text-sm font-bold">{value}</span>
      <span className="text-[10px] text-gray-500">{label}</span>
      {percentile != null && (
        <>
          <span className="text-[10px] leading-tight text-green-700 font-medium">
            {percentilePeerLabel(percentile, t)}
          </span>
          <span className="text-[9px] text-green-600/70 font-medium">P{percentile}</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WHO 성장 곡선 SVG 차트
// ---------------------------------------------------------------------------
function WhoChart({
  records, metric, gender, birthDate,
}: {
  records: BabyGrowthRecord[];
  metric: Metric;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
}) {
  const isMale = gender !== 'female';
  const table = metric === 'weight'
    ? (isMale ? WHO_WEIGHT_BOYS : WHO_WEIGHT_GIRLS)
    : (isMale ? WHO_HEIGHT_BOYS : WHO_HEIGHT_GIRLS);

  const W = 320;
  const H = 160;
  const PAD = { top: 10, right: 8, bottom: 28, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxAge = 24;
  const allValues = table.flatMap((r) => [r.p3, r.p97]);
  const minV = Math.min(...allValues) * 0.95;
  const maxV = Math.max(...allValues) * 1.02;
  const range = maxV - minV;

  const tx = (m: number) => PAD.left + (m / maxAge) * innerW;
  const ty = (v: number) => PAD.top + (1 - (v - minV) / range) * innerH;

  const makePath = (key: keyof typeof table[0]) =>
    table.map((r, i) => `${i === 0 ? 'M' : 'L'} ${tx(r.monthAge).toFixed(1)} ${ty(r[key] as number).toFixed(1)}`).join(' ');

  // 아기 실측 데이터
  const babyPoints = records
    .filter((r) => (metric === 'weight' ? r.weight_kg : r.height_cm) != null)
    .map((r) => {
      const birth = new Date(birthDate);
      const measured = new Date(r.measured_at);
      const months = Math.max(0, Math.floor((measured.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.4)));
      const val = metric === 'weight' ? r.weight_kg! : r.height_cm!;
      return { x: tx(months), y: ty(val), val };
    });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ minWidth: W }}>
        {/* P3-P97 밴드 */}
        <path
          d={`${makePath('p3')} L ${tx(maxAge).toFixed(1)} ${ty(table[table.length - 1].p97).toFixed(1)} ${makePath('p97').replace('M', 'L')} Z`}
          fill="#86efac"
          opacity={0.15}
        />
        {/* 백분위 선 */}
        {(['p3', 'p15', 'p50', 'p85', 'p97'] as const).map((p) => (
          <path
            key={p}
            d={makePath(p)}
            fill="none"
            stroke={p === 'p50' ? '#22c55e' : '#86efac'}
            strokeWidth={p === 'p50' ? 1.5 : 0.8}
            strokeDasharray={p === 'p50' ? undefined : '3 2'}
          />
        ))}
        {/* Y축 */}
        {[minV, (minV + maxV) / 2, maxV].map((v) => (
          <text key={v} x={PAD.left - 4} y={ty(v) + 3} fontSize={8} fill="#9ca3af" textAnchor="end">
            {v.toFixed(1)}
          </text>
        ))}
        {/* X축 월령 */}
        {[0, 6, 12, 18, 24].map((m) => (
          <text key={m} x={tx(m)} y={H - 6} fontSize={8} fill="#9ca3af" textAnchor="middle">
            {m}mo
          </text>
        ))}
        {/* 아기 실측 점 */}
        {babyPoints.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#f43f5e" stroke="white" strokeWidth={1.5} />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MilestoneChecklist (인라인 — import 순환 방지)
// ---------------------------------------------------------------------------
function MilestoneChecklist({
  milestones, ageMonths, t, onToggle,
}: {
  milestones: BabyMilestone[];
  ageMonths: number;
  t: BabyGrowthTranslations;
  onToggle: (key: string, category: BabyMilestone['category'], achieved: boolean) => void;
}) {
  const achievedKeys = new Set(milestones.filter((m) => m.achieved_at).map((m) => m.milestone_key));

  const relevant = MILESTONE_DEFINITIONS.filter(
    (d) => d.typicalMonths[0] <= ageMonths + 3
  );

  if (relevant.length === 0) return null;

  return (
    <div className="space-y-2">
      {relevant.map((def) => {
        const achieved = achievedKeys.has(def.key);
        return (
          <button
            key={def.key}
            onClick={() => onToggle(def.key, def.category, !achieved)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
              achieved
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'
            }`}
          >
            <span className="text-lg">{achieved ? '⭐' : '○'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{def.label}</p>
              <p className="text-xs text-gray-400">{def.typicalMonths[0]}~{def.typicalMonths[1]}개월</p>
            </div>
            <span className={`text-xs font-medium ${achieved ? 'text-yellow-500' : 'text-gray-400'}`}>
              {achieved ? t.milestone_achieved : t.milestone_not_yet}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddGrowthRecordModal
// ---------------------------------------------------------------------------
function AddGrowthRecordModal({
  babyId, currentGroupId, t, onSave, onClose,
}: {
  babyId: string;
  currentGroupId: string;
  t: BabyGrowthTranslations;
  onSave: (draft: BabyGrowthRecordDraft) => Promise<void>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [measuredAt, setMeasuredAt] = useState(today);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!measuredAt) return;
    setSaving(true);
    try {
      await onSave({
        baby_id: babyId,
        group_id: currentGroupId,
        measured_at: measuredAt,
        weight_kg: weightKg ? Number(weightKg) : undefined,
        height_cm: heightCm ? Number(heightCm) : undefined,
        head_cm: headCm ? Number(headCm) : undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:w-96 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl pb-safe">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold">{t.add_measurement}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block text-xs font-medium text-gray-500">{t.measured_at}
            <input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 block" />
          </label>
          <label className="block text-xs font-medium text-gray-500">{t.weight_kg}
            <input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
              step="0.001" placeholder="ex) 6.250"
              className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 block" />
          </label>
          <label className="block text-xs font-medium text-gray-500">{t.height_cm}
            <input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
              step="0.1" placeholder="ex) 65.0"
              className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 block" />
          </label>
          <label className="block text-xs font-medium text-gray-500">{t.head_cm}
            <input type="number" inputMode="decimal" value={headCm} onChange={(e) => setHeadCm(e.target.value)}
              step="0.1" placeholder="ex) 40.5"
              className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 block" />
          </label>
          <label className="block text-xs font-medium text-gray-500">{t.notes}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 block resize-none" />
          </label>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleSave} disabled={saving || !measuredAt}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
            {saving ? '...' : t.save}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
