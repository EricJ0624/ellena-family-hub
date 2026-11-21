'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LogType, BabyDailyLogDraft, FeedingType, DiaperType, ActivityType } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { BABY_SYMPTOM_CHIPS } from '../utils/symptom-chips';

interface QuickLogModalProps {
  isOpen: boolean;
  defaultLogType: LogType;
  babyId: string;
  currentGroupId: string;
  t: BabyGrowthTranslations;
  onBed?: () => Promise<void>;
  onWake?: () => Promise<void>;
  onSave: (draft: BabyDailyLogDraft) => Promise<void>;
  onClose: () => void;
}

type TabKey = LogType;

const TABS: { key: TabKey; emoji: string; labelKey: keyof BabyGrowthTranslations }[] = [
  { key: 'feeding',     emoji: '🍼', labelKey: 'log_feeding' },
  { key: 'sleep',       emoji: '😴', labelKey: 'log_sleep' },
  { key: 'diaper',      emoji: '🧷', labelKey: 'log_diaper' },
  { key: 'temperature', emoji: '🌡️', labelKey: 'log_temperature' },
  { key: 'medication',  emoji: '💊', labelKey: 'log_medication' },
  { key: 'activity',    emoji: '🛁', labelKey: 'log_activity' },
];

// ---------------------------------------------------------------------------
// 모유 수유 타이머 컴포넌트
// ---------------------------------------------------------------------------
function BreastfeedingTimer({
  side,
  label,
  initialMin,
  onChange,
}: {
  side: 'left' | 'right';
  label: string;
  initialMin: number;
  onChange: (minutes: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(initialMin * 60); // 초
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          onChange(Math.round(next / 60));
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, onChange]);

  const displayMin = Math.floor(elapsed / 60);
  const displaySec = elapsed % 60;

  const color = side === 'left' ? 'bg-pink-500' : 'bg-indigo-500';
  const idleColor = side === 'left' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${idleColor}`}>
      <span className="text-xs font-semibold w-10">{label}</span>
      <span className="text-base font-mono font-bold flex-1">
        {String(displayMin).padStart(2, '0')}:{String(displaySec).padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        className={`${color} text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity ${running ? 'opacity-80' : ''}`}
      >
        {running ? '⏸ 정지' : elapsed > 0 ? '▶ 재개' : '▶ 시작'}
      </button>
      {elapsed > 0 && !running && (
        <button
          type="button"
          onClick={() => { setElapsed(0); setRunning(false); onChange(0); }}
          className="text-xs text-gray-400 hover:text-gray-600 px-2"
        >
          초기화
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 배변 색상 선택
// ---------------------------------------------------------------------------
const DIAPER_COLORS = [
  { value: 'yellow', label: '노랑', bg: 'bg-yellow-400' },
  { value: 'green',  label: '녹색', bg: 'bg-green-500' },
  { value: 'brown',  label: '갈색', bg: 'bg-amber-700' },
  { value: 'red',    label: '빨강', bg: 'bg-red-500' },
  { value: 'white',  label: '흰색', bg: 'bg-gray-200' },
  { value: 'black',  label: '검정', bg: 'bg-gray-900' },
];

const DIAPER_CONSISTENCY = [
  'normal',
  'soft',
  'firm',
  'loose',
  'other',
] as const;

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------
export function QuickLogModal({
  isOpen,
  defaultLogType,
  babyId,
  currentGroupId,
  t,
  onBed,
  onWake,
  onSave,
  onClose,
}: QuickLogModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultLogType);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // feeding
  const [feedingType, setFeedingType] = useState<FeedingType>('bottle');
  const [feedingAmountMl, setFeedingAmountMl] = useState('');
  const [feedingDurationMin, setFeedingDurationMin] = useState('');
  const [breastLeftMin, setBreastLeftMin] = useState(0);
  const [breastRightMin, setBreastRightMin] = useState(0);
  const [solidIngredients, setSolidIngredients] = useState('');
  const [allergyReaction, setAllergyReaction] = useState('');
  const [showAllergy, setShowAllergy] = useState(false);
  // sleep
  const [sleepStart, setSleepStart] = useState('');
  const [sleepEnd, setSleepEnd] = useState('');
  // diaper
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');
  const [diaperColor, setDiaperColor] = useState('');
  const [diaperConsistency, setDiaperConsistency] = useState('');
  // temperature
  const [tempCelsius, setTempCelsius] = useState('');
  // medication
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  // illness symptoms (체온 탭에서 함께 기록)
  const [symptomTags, setSymptomTags] = useState<string[]>([]);
  const [symptomNote, setSymptomNote] = useState('');
  // activity
  const [activityType, setActivityType] = useState<ActivityType>('bath');
  const [activityDurationMin, setActivityDurationMin] = useState('');
  const [pumpAmountMl, setPumpAmountMl] = useState('');
  // shared
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(defaultLogType);
    setSymptomTags([]);
    setSymptomNote('');
    setSavedMsg(false);
  }, [isOpen, defaultLogType]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (activeTab === 'temperature') {
        const jobs: Array<() => Promise<void>> = [];
        if (tempCelsius) {
          jobs.push(() =>
            onSave({
              baby_id: babyId,
              group_id: currentGroupId,
              log_type: 'temperature',
              logged_at: now,
              temperature_celsius: Number(tempCelsius),
            }),
          );
        }
        if (medName.trim()) {
          jobs.push(() =>
            onSave({
              baby_id: babyId,
              group_id: currentGroupId,
              log_type: 'medication',
              logged_at: now,
              medication_name: medName.trim(),
              medication_dose_mg: medDose ? Number(medDose) : undefined,
            }),
          );
        }
        if (symptomTags.length > 0 || symptomNote.trim()) {
          jobs.push(() =>
            onSave({
              baby_id: babyId,
              group_id: currentGroupId,
              log_type: 'symptom',
              logged_at: now,
              symptom_tags: symptomTags.join(','),
              notes: symptomNote.trim() || undefined,
            }),
          );
        }
        if (jobs.length === 0) return;
        // 순차 저장 — Realtime/상태 갱신 충돌 완화
        for (const job of jobs) await job();
      } else {
        const draft: BabyDailyLogDraft = {
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: activeTab,
          logged_at: sleepStart ? new Date(sleepStart).toISOString() : now,
          notes: notes.trim() || undefined,
        };

        if (activeTab === 'feeding') {
          draft.feeding_type = feedingType;
          if (feedingType === 'breast_left') {
            if (breastLeftMin > 0) draft.breast_left_min = breastLeftMin;
          } else if (feedingType === 'breast_right') {
            if (breastRightMin > 0) draft.breast_right_min = breastRightMin;
          } else if (feedingType === 'solid') {
            if (feedingAmountMl) draft.feeding_amount_ml = Number(feedingAmountMl);
            if (solidIngredients.trim()) draft.solid_ingredients = solidIngredients.trim();
            if (allergyReaction.trim()) draft.allergy_reaction = allergyReaction.trim();
          } else {
            // bottle(분유) · mixed(모유 젖병): ml + 선택 시간
            if (feedingAmountMl) draft.feeding_amount_ml = Number(feedingAmountMl);
            if (feedingDurationMin) draft.feeding_duration_min = Number(feedingDurationMin);
          }
        } else if (activeTab === 'sleep') {
          draft.sleep_start_recorded = Boolean(sleepStart);
          if (sleepEnd) {
            draft.sleep_end_at = new Date(sleepEnd).toISOString();
            draft.sleep_end_recorded = true;
          } else {
            draft.sleep_end_recorded = false;
          }
        } else if (activeTab === 'diaper') {
          draft.diaper_type = diaperType;
          if (diaperColor) draft.diaper_color = diaperColor;
          if (diaperConsistency) draft.diaper_consistency = diaperConsistency;
        } else if (activeTab === 'medication') {
          if (medName.trim()) draft.medication_name = medName.trim();
          if (medDose) draft.medication_dose_mg = Number(medDose);
        } else if (activeTab === 'activity') {
          draft.activity_type = activityType;
          if (activityDurationMin) draft.activity_duration_min = Number(activityDurationMin);
          if (activityType === 'pumping' && pumpAmountMl) draft.pump_amount_ml = Number(pumpAmountMl);
        }

        await onSave(draft);
      }

      setSavedMsg(true);
      setTimeout(() => {
        setSavedMsg(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('[QuickLogModal] 저장 오류:', err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:w-[420px] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl pb-safe max-h-[90dvh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold">{t.record_now}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 px-3 pt-3 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {tab.emoji} {t[tab.labelKey] as string}
            </button>
          ))}
        </div>

        {/* 폼 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* ── 수유 ── */}
          {activeTab === 'feeding' && (
            <>
              <Field label={t.feeding_type}>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['breast_left', 'breast_right', 'mixed', 'bottle', 'solid'] as FeedingType[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFeedingType(v)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        feedingType === v ? 'bg-pink-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}
                    >
                      {t[`feeding_${v}` as keyof BabyGrowthTranslations] as string}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 모유 직수 타이머 */}
              {feedingType === 'breast_left' && (
                <BreastfeedingTimer
                  side="left"
                  label={t.breast_left_timer}
                  initialMin={breastLeftMin}
                  onChange={setBreastLeftMin}
                />
              )}
              {feedingType === 'breast_right' && (
                <BreastfeedingTimer
                  side="right"
                  label={t.breast_right_timer}
                  initialMin={breastRightMin}
                  onChange={setBreastRightMin}
                />
              )}

              {/* 이유식 */}
              {feedingType === 'solid' && (
                <>
                  <Field label={t.feeding_amount_ml}>
                    <NumberInput value={feedingAmountMl} onChange={setFeedingAmountMl} placeholder="ex) 60" />
                  </Field>
                  <Field label={t.solid_ingredients}>
                    <input
                      type="text"
                      value={solidIngredients}
                      onChange={(e) => setSolidIngredients(e.target.value)}
                      placeholder="ex) 단호박, 닭고기, 쌀"
                      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="allergy-toggle"
                      checked={showAllergy}
                      onChange={(e) => setShowAllergy(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="allergy-toggle" className="text-xs text-gray-500">
                      {t.allergy_reaction} 체크
                    </label>
                  </div>
                  {showAllergy && (
                    <Field label={t.allergy_reaction}>
                      <input
                        type="text"
                        value={allergyReaction}
                        onChange={(e) => setAllergyReaction(e.target.value)}
                        placeholder="ex) 두드러기, 발진, 구토"
                        className="w-full text-sm rounded-lg border border-red-200 dark:border-red-800 dark:bg-gray-800 px-3 py-2"
                      />
                    </Field>
                  )}
                </>
              )}

              {/* 분유 · 모유 젖병 — 양/시간 */}
              {(feedingType === 'bottle' || feedingType === 'mixed') && (
                <>
                  <Field
                    label={
                      feedingType === 'bottle'
                        ? t.feeding_amount_formula_ml
                        : t.feeding_amount_breast_bottle_ml
                    }
                  >
                    <NumberInput value={feedingAmountMl} onChange={setFeedingAmountMl} placeholder="ex) 120" />
                  </Field>
                  <Field label={t.feeding_duration_min}>
                    <NumberInput value={feedingDurationMin} onChange={setFeedingDurationMin} placeholder="ex) 15" />
                  </Field>
                </>
              )}
            </>
          )}

          {/* ── 수면 ── */}
          {activeTab === 'sleep' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {onBed && (
                  <button
                    type="button"
                    onClick={() => { void onBed().then(onClose); }}
                    className="py-2 rounded-xl text-sm font-semibold bg-indigo-500 text-white"
                  >
                    {t.sleep_bed_btn}
                  </button>
                )}
                {onWake && (
                  <button
                    type="button"
                    onClick={() => { void onWake().then(onClose); }}
                    className="py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white"
                  >
                    {t.sleep_wake_btn}
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { min: 30, label: t.sleep_nap_30 },
                  { min: 60, label: t.sleep_nap_60 },
                  { min: 90, label: t.sleep_nap_90 },
                ].map(({ min, label }) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      const end = new Date();
                      const start = new Date(end.getTime() - min * 60_000);
                      void onSave({
                        baby_id: babyId,
                        group_id: currentGroupId,
                        log_type: 'sleep',
                        logged_at: start.toISOString(),
                        sleep_end_at: end.toISOString(),
                        sleep_start_recorded: true,
                        sleep_end_recorded: true,
                      });
                    }}
                    className="px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Field label={t.sleep_start}>
                <DatetimeInput value={sleepStart} onChange={setSleepStart} />
              </Field>
              <Field label={t.sleep_end}>
                <DatetimeInput value={sleepEnd} onChange={setSleepEnd} />
              </Field>
            </>
          )}

          {/* ── 배변 ── */}
          {activeTab === 'diaper' && (
            <>
              <Field label={t.diaper_type}>
                <div className="flex gap-2 flex-wrap">
                  {(['wet', 'dirty', 'mixed', 'dry'] as DiaperType[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setDiaperType(v);
                        if (v !== 'dirty' && v !== 'mixed') {
                          setDiaperColor('');
                          setDiaperConsistency('');
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        diaperType === v
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}
                    >
                      {t[`diaper_${v}` as keyof BabyGrowthTranslations] as string}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 대변·소변+대변: 색/성상(보통·무른·딱딱·설사·기타) */}
              {(diaperType === 'dirty' || diaperType === 'mixed') && (
                <>
                  <Field label={t.diaper_color}>
                    <div className="flex gap-2 flex-wrap">
                      {DIAPER_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setDiaperColor(diaperColor === c.value ? '' : c.value)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all ${
                            diaperColor === c.value
                              ? 'border-gray-700 dark:border-gray-200 font-bold'
                              : 'border-transparent'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${c.bg} inline-block`} />
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t.diaper_consistency}>
                    <div className="flex gap-2 flex-wrap">
                      {DIAPER_CONSISTENCY.map((value) => {
                        const labelKey =
                          `diaper_consistency_${value}` as keyof BabyGrowthTranslations;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setDiaperConsistency(diaperConsistency === value ? '' : value)
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              diaperConsistency === value
                                ? 'bg-amber-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                            }`}
                          >
                            {t[labelKey] as string}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </>
              )}
            </>
          )}

          {/* ── 체온(+투약·증상) — 아픈 날 한곳에서 기록 ── */}
          {activeTab === 'temperature' && (
            <>
              <Field label={t.temperature_celsius}>
                <NumberInput
                  value={tempCelsius}
                  onChange={setTempCelsius}
                  placeholder="ex) 37.2"
                  step="0.1"
                />
              </Field>
              <Field label={t.log_medication}>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder={t.medication_name}
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                  />
                  <NumberInput value={medDose} onChange={setMedDose} placeholder="ex) 80" />
                </div>
              </Field>
              <Field label={t.symptom_title}>
                <div className="flex flex-wrap gap-1.5">
                  {BABY_SYMPTOM_CHIPS.map((chip) => {
                    const on = symptomTags.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() =>
                          setSymptomTags((prev) =>
                            on ? prev.filter((x) => x !== chip) : [...prev, chip],
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          on ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label={t.symptom_note}>
                <textarea
                  value={symptomNote}
                  onChange={(e) => setSymptomNote(e.target.value)}
                  rows={2}
                  placeholder={t.symptom_note}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                />
              </Field>
            </>
          )}

          {/* ── 투약 (단독 탭) ── */}
          {activeTab === 'medication' && (
            <>
              <Field label={t.medication_name}>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="ex) 타이레놀"
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                />
              </Field>
              <Field label={t.medication_dose_mg}>
                <NumberInput value={medDose} onChange={setMedDose} placeholder="ex) 80" />
              </Field>
            </>
          )}

          {/* ── 기타 활동 ── */}
          {activeTab === 'activity' && (
            <>
              <Field label={t.log_activity}>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'bath' as ActivityType,      emoji: '🛁', label: t.activity_bath },
                    { v: 'tummy_time' as ActivityType, emoji: '🤸', label: t.activity_tummy_time },
                    { v: 'pumping' as ActivityType,   emoji: '🍼', label: t.activity_pumping },
                    { v: 'other' as ActivityType,     emoji: '📝', label: t.activity_other },
                  ]).map(({ v, emoji, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setActivityType(v)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        activityType === v
                          ? 'bg-teal-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t.activity_duration_min}>
                <NumberInput value={activityDurationMin} onChange={setActivityDurationMin} placeholder="ex) 10" />
              </Field>
              {activityType === 'pumping' && (
                <Field label={t.pump_amount_ml}>
                  <NumberInput value={pumpAmountMl} onChange={setPumpAmountMl} placeholder="ex) 80" />
                </Field>
              )}
            </>
          )}

          {/* ── 메모 (체온 탭은 증상 메모로 대체) ── */}
          {activeTab !== 'temperature' && (
            <Field label={t.notes}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={
                  activeTab === 'diaper' && diaperConsistency === 'other'
                    ? t.diaper_other_notes_hint
                    : undefined
                }
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 resize-none"
              />
            </Field>
          )}
        </div>

        {/* 저장 버튼 */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          {savedMsg ? (
            <div className="text-center text-green-500 font-medium text-sm">{t.log_saved}</div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {saving ? '...' : t.save}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// 소형 공통 컴포넌트
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  step = '1',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
    />
  );
}

function DatetimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
    />
  );
}
