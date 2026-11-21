'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BabyBloodType, BabyProfile } from '../types';
import { BABY_BLOOD_TYPES } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { asFiniteNumber } from '../utils/birth-snapshot';
import { displayBabyName, estimateGestationalWeeksAtBirth } from '../utils/prenatal';
import type { BirthTransitionInput } from '../hooks/useBirthTransition';

interface BirthTransitionModalProps {
  profile: BabyProfile;
  t: BabyGrowthTranslations;
  onSubmit: (input: BirthTransitionInput) => Promise<void>;
  onClose: () => void;
}

export function BirthTransitionModal({ profile, t, onSubmit, onClose }: BirthTransitionModalProps) {
  const now = new Date();
  const defaultLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 태명과 동일하게 넣어 둔 name 은 정식 이름으로 쓰지 않음 — 사용자가 입력
  const [legalName, setLegalName] = useState('');
  const [deliveredAt, setDeliveredAt] = useState(defaultLocal);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');
  const [place, setPlace] = useState(profile.birth_place ?? '');
  const [bloodType, setBloodType] = useState<BabyBloodType | ''>(profile.blood_type ?? '');
  const [gestWeeks, setGestWeeks] = useState(() => {
    const est = estimateGestationalWeeksAtBirth(profile.due_date, defaultLocal.slice(0, 10));
    return est != null ? String(est) : '';
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedGw = useMemo(
    () => estimateGestationalWeeksAtBirth(profile.due_date, deliveredAt.slice(0, 10)),
    [deliveredAt, profile.due_date],
  );

  useEffect(() => {
    if (suggestedGw != null) setGestWeeks(String(suggestedGw));
  }, [suggestedGw]);

  const handleSave = async () => {
    const w = asFiniteNumber(weight);
    if (!legalName.trim() || !deliveredAt || w == null) {
      setError(t.birth_transition_required);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        legalName: legalName.trim(),
        // datetime-local 문자열을 Date로 파싱(로컬) 후 ISO 저장 — birth_date 는 훅에서 로컬 일자로 계산
        deliveredAt: new Date(deliveredAt).toISOString(),
        birthWeightKg: w,
        birthHeightCm: asFiniteNumber(height),
        birthHeadCm: asFiniteNumber(head),
        birthPlace: place.trim() || null,
        bloodType: bloodType || null,
        gestationalWeeks: asFiniteNumber(gestWeeks) ?? suggestedGw,
      });
      // 부모에서 birth_date 반영 후 isPrenatal=false 로 언마운트됨
    } catch (err) {
      console.error('[BirthTransitionModal]', err);
      setError(t.error_save);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white pb-safe shadow-2xl dark:bg-gray-900 sm:w-[420px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-2 pt-4 dark:border-gray-800">
          <h2 className="text-base font-bold">{t.birth_transition_title}</h2>
          <button type="button" onClick={onClose} className="text-xl text-gray-400">×</button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <p className="text-xs text-gray-500">{t.birth_transition_hint}</p>
          <div>
            <label className="block text-xs text-gray-500">{t.birth_legal_name}</label>
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder={displayBabyName(profile)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">{t.birth_delivered_at}</label>
            <input type="datetime-local" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500">{t.birth_weight_kg} *</label>
              <input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">{t.birth_height_cm}</label>
              <input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">{t.birth_head_cm}</label>
              <input type="number" step="0.1" value={head} onChange={(e) => setHead(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">{t.gestational_weeks}</label>
              <input type="number" step="0.1" value={gestWeeks} onChange={(e) => setGestWeeks(e.target.value)}
                placeholder={suggestedGw != null ? String(suggestedGw) : ''}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500">{t.birth_place}</label>
            <input value={place} onChange={(e) => setPlace(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">{t.blood_type}</label>
            <select value={bloodType} onChange={(e) => setBloodType((e.target.value || '') as BabyBloodType | '')}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="">{t.blood_type_unset}</option>
              {BABY_BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-medium dark:bg-gray-800">
            {t.cancel}
          </button>
          <button type="button" disabled={saving} onClick={() => void handleSave()}
            className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? '...' : t.birth_transition_confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
