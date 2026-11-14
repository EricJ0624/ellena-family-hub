'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BabyCheckup, BabyCheckupDraft, CheckupType } from '../types';
import { useBabyGrowthRecords } from '../hooks/useBabyGrowthRecords';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

const CHECKUP_TYPES: CheckupType[] = [
  '1m', '2m', '4m', '6m', '9m', '12m', '15m', '18m', '24m', '36m', '48m', '54m', '60m', '66m', '72m',
];

const CHECKUP_LABEL: Record<CheckupType, string> = {
  '1m': '1개월', '2m': '2개월', '4m': '4개월', '6m': '6개월',
  '9m': '9개월', '12m': '12개월', '15m': '15개월', '18m': '18개월',
  '24m': '24개월', '36m': '36개월', '48m': '48개월', '54m': '54개월',
  '60m': '60개월', '66m': '66개월', '72m': '72개월',
};

interface CheckupViewProps {
  babyId: string;
  currentGroupId: string | null;
  userId: string;
  t: BabyGrowthTranslations;
  /** 부모(진료 리포트 등)와 검진 목록을 맞출 때 사용 */
  onCheckupsChange?: (checkups: BabyCheckup[]) => void;
}

export function CheckupView({
  babyId,
  currentGroupId,
  userId,
  t,
  onCheckupsChange,
}: CheckupViewProps) {
  const { fetchCheckups, addCheckup, updateCheckup, deleteCheckup } = useBabyGrowthRecords({
    babyId,
    currentGroupId,
    userId,
  });

  const [checkups, setCheckups] = useState<BabyCheckup[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BabyCheckup | null>(null);

  const publish = (next: BabyCheckup[]) => {
    setCheckups(next);
    onCheckupsChange?.(next);
  };

  const load = async () => {
    setLoading(true);
    const data = await fetchCheckups();
    publish(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId]);

  const handleSave = async (draft: BabyCheckupDraft) => {
    if (editTarget) {
      const updated = await updateCheckup(editTarget.id, draft);
      setCheckups((prev) => {
        const next = prev.map((c) => (c.id === updated.id ? updated : c));
        onCheckupsChange?.(next);
        return next;
      });
    } else {
      const created = await addCheckup(draft);
      setCheckups((prev) => {
        const next = [...prev, created].sort((a, b) =>
          a.checkup_date.localeCompare(b.checkup_date),
        );
        onCheckupsChange?.(next);
        return next;
      });
    }
    setAddOpen(false);
    setEditTarget(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('검진 기록을 삭제하시겠습니까?')) return;
    await deleteCheckup(id);
    setCheckups((prev) => {
      const next = prev.filter((c) => c.id !== id);
      onCheckupsChange?.(next);
      return next;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-gray-400">{t.loading}</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{t.checkup_title}</h2>
        <button
          onClick={() => { setEditTarget(null); setAddOpen(true); }}
          className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          + {t.checkup_title} 추가
        </button>
      </div>

      {checkups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          <p>아직 검진 기록이 없습니다.</p>
          <p className="text-xs mt-1">검진 후 기록을 추가해 보세요.</p>
        </div>
      ) : (
        <div className="relative">
          {/* 타임라인 선 */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-teal-100 dark:bg-teal-900/30" />
          <div className="space-y-4">
            {checkups.map((c) => (
              <CheckupCard
                key={c.id}
                checkup={c}
                t={t}
                onEdit={() => { setEditTarget(c); setAddOpen(true); }}
                onDelete={() => handleDelete(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 추가/편집 모달 */}
      {addOpen && (
        <AddCheckupModal
          initial={editTarget ?? undefined}
          babyId={babyId}
          currentGroupId={currentGroupId ?? ''}
          t={t}
          onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 검진 카드
// ---------------------------------------------------------------------------
function CheckupCard({
  checkup: c,
  t,
  onEdit,
  onDelete,
}: {
  checkup: BabyCheckup;
  t: BabyGrowthTranslations;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative ml-10">
      {/* 타임라인 점 */}
      <div className="absolute -left-6 top-3 w-3 h-3 rounded-full bg-teal-500 border-2 border-white dark:border-gray-900" />

      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-100 dark:border-teal-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-block bg-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mr-2">
              {CHECKUP_LABEL[c.checkup_type] ?? c.checkup_type}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(c.checkup_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex gap-1">
            <button onClick={onEdit} className="text-xs text-gray-400 hover:text-teal-600 px-1">편집</button>
            <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-500 px-1">삭제</button>
          </div>
        </div>

        {/* 측정값 */}
        <div className="flex gap-3 mt-2 flex-wrap">
          {c.weight_kg != null && (
            <Metric label={t.weight_kg ?? '체중'} value={`${c.weight_kg}kg`} />
          )}
          {c.height_cm != null && (
            <Metric label={t.height_cm ?? '키'} value={`${c.height_cm}cm`} />
          )}
          {c.head_cm != null && (
            <Metric label={t.head_cm ?? '머리둘레'} value={`${c.head_cm}cm`} />
          )}
          {c.vision_ok != null && (
            <Metric label={t.checkup_vision} value={c.vision_ok ? '✅' : '⚠️'} />
          )}
          {c.hearing_ok != null && (
            <Metric label={t.checkup_hearing} value={c.hearing_ok ? '✅' : '⚠️'} />
          )}
        </div>

        {/* 메모 */}
        {(c.dev_notes || c.doctor_notes) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-teal-500 mt-2"
          >
            {expanded ? '▲ 접기' : '▼ 메모 보기'}
          </button>
        )}
        {expanded && (
          <div className="mt-2 space-y-1">
            {c.dev_notes && <p className="text-xs text-gray-600 dark:text-gray-400">발달: {c.dev_notes}</p>}
            {c.doctor_notes && <p className="text-xs text-gray-600 dark:text-gray-400">의사 소견: {c.doctor_notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 추가/편집 모달
// ---------------------------------------------------------------------------
interface AddCheckupModalProps {
  initial?: BabyCheckup;
  babyId: string;
  currentGroupId: string;
  t: BabyGrowthTranslations;
  onSave: (draft: BabyCheckupDraft) => Promise<void>;
  onClose: () => void;
}

function AddCheckupModal({ initial, babyId, currentGroupId, t, onSave, onClose }: AddCheckupModalProps) {
  const [checkupType, setCheckupType] = useState<CheckupType>(initial?.checkup_type ?? '1m');
  const [checkupDate, setCheckupDate] = useState(initial?.checkup_date ?? new Date().toISOString().slice(0, 10));
  const [weightKg, setWeightKg] = useState(initial?.weight_kg?.toString() ?? '');
  const [heightCm, setHeightCm] = useState(initial?.height_cm?.toString() ?? '');
  const [headCm, setHeadCm] = useState(initial?.head_cm?.toString() ?? '');
  const [visionOk, setVisionOk] = useState<boolean | null>(initial?.vision_ok ?? null);
  const [hearingOk, setHearingOk] = useState<boolean | null>(initial?.hearing_ok ?? null);
  const [devNotes, setDevNotes] = useState(initial?.dev_notes ?? '');
  const [doctorNotes, setDoctorNotes] = useState(initial?.doctor_notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!checkupDate) return;
    setSaving(true);
    try {
      await onSave({
        baby_id: babyId,
        group_id: currentGroupId,
        checkup_type: checkupType,
        checkup_date: checkupDate,
        weight_kg: weightKg ? Number(weightKg) : undefined,
        height_cm: heightCm ? Number(heightCm) : undefined,
        head_cm: headCm ? Number(headCm) : undefined,
        vision_ok: visionOk ?? undefined,
        hearing_ok: hearingOk ?? undefined,
        dev_notes: devNotes.trim() || undefined,
        doctor_notes: doctorNotes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:w-[400px] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl pb-safe max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold">{initial ? '검진 기록 편집' : '검진 기록 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* 검진 차수 */}
          <FormField label={t.checkup_type}>
            <select
              value={checkupType}
              onChange={(e) => setCheckupType(e.target.value as CheckupType)}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
            >
              {CHECKUP_TYPES.map((v) => (
                <option key={v} value={v}>{CHECKUP_LABEL[v]}</option>
              ))}
            </select>
          </FormField>

          {/* 검진 날짜 */}
          <FormField label={t.checkup_date}>
            <input
              type="date"
              value={checkupDate}
              onChange={(e) => setCheckupDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
            />
          </FormField>

          {/* 측정값 */}
          <div className="grid grid-cols-3 gap-2">
            <FormField label={`${t.weight_kg ?? '체중'} (kg)`}>
              <input type="number" step="0.01" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                placeholder="ex) 7.2"
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2 py-2" />
            </FormField>
            <FormField label={`${t.height_cm ?? '키'} (cm)`}>
              <input type="number" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
                placeholder="ex) 65.5"
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2 py-2" />
            </FormField>
            <FormField label={`${t.head_cm ?? '머리둘레'} (cm)`}>
              <input type="number" step="0.1" value={headCm} onChange={(e) => setHeadCm(e.target.value)}
                placeholder="ex) 42.0"
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2 py-2" />
            </FormField>
          </div>

          {/* 시력/청력 */}
          <div className="flex gap-4">
            <FormField label={t.checkup_vision}>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button"
                    onClick={() => setVisionOk(visionOk === v ? null : v)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      visionOk === v ? (v ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                    }`}>
                    {v ? '정상' : '이상'}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label={t.checkup_hearing}>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button"
                    onClick={() => setHearingOk(hearingOk === v ? null : v)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      hearingOk === v ? (v ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                    }`}>
                    {v ? '정상' : '이상'}
                  </button>
                ))}
              </div>
            </FormField>
          </div>

          {/* 발달 메모 */}
          <FormField label="발달 사항">
            <textarea value={devNotes} onChange={(e) => setDevNotes(e.target.value)} rows={2}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 resize-none" />
          </FormField>

          {/* 의사 소견 */}
          <FormField label="의사 소견">
            <textarea value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)} rows={2}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 resize-none" />
          </FormField>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleSave}
            disabled={saving || !checkupDate}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}
