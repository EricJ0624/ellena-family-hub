'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { PrenatalLogDraft, PrenatalLogType } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { asFiniteNumber } from '../utils/birth-snapshot';
import { fetalSizeLabelForWeek } from '../utils/fetal-size';

interface PrenatalQuickLogModalProps {
  isOpen: boolean;
  defaultType: PrenatalLogType;
  babyId: string;
  currentGroupId: string;
  weeksPregnant: number;
  t: BabyGrowthTranslations;
  onSave: (draft: PrenatalLogDraft) => Promise<void>;
  onClose: () => void;
}

export function PrenatalQuickLogModal({
  isOpen,
  defaultType,
  babyId,
  currentGroupId,
  weeksPregnant,
  t,
  onSave,
  onClose,
}: PrenatalQuickLogModalProps) {
  const [logType, setLogType] = useState<PrenatalLogType>(defaultType);
  const [weight, setWeight] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [notes, setNotes] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [checkupAt, setCheckupAt] = useState('');
  const [hospital, setHospital] = useState('');
  const [nextCheckup, setNextCheckup] = useState('');
  const [fundalHeight, setFundalHeight] = useState('');
  const [fetalWeightEst, setFetalWeightEst] = useState('');
  const [kickCount, setKickCount] = useState('');
  const [kickDuration, setKickDuration] = useState('');
  const [labName, setLabName] = useState('');
  const [labResult, setLabResult] = useState('');
  const [medicationName, setMedicationName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (logType === 'maternal_weight' || logType === 'blood_pressure') {
        if (asFiniteNumber(weight) != null) {
          await onSave({
            baby_id: babyId,
            group_id: currentGroupId,
            log_type: 'maternal_weight',
            weight_kg: asFiniteNumber(weight),
            notes: notes.trim() || null,
          });
        }
        if (asFiniteNumber(systolic) != null) {
          await onSave({
            baby_id: babyId,
            group_id: currentGroupId,
            log_type: 'blood_pressure',
            systolic: asFiniteNumber(systolic),
            diastolic: asFiniteNumber(diastolic),
            notes: notes.trim() || null,
          });
        }
        if (!weight && !systolic) {
          await onSave({
            baby_id: babyId,
            group_id: currentGroupId,
            log_type: 'maternal_weight',
            notes: notes.trim() || null,
          });
        }
      } else if (logType === 'fetal_size') {
        await onSave({
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: 'fetal_size',
          fetal_size_label: fetalSizeLabelForWeek(weeksPregnant),
          notes: notes.trim() || null,
        });
      } else if (logType === 'checkup_note') {
        await onSave({
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: 'checkup_note',
          checkup_at: checkupAt || null,
          hospital_name: hospital.trim() || null,
          next_checkup_at: nextCheckup || null,
          fundal_height_cm: asFiniteNumber(fundalHeight),
          fetal_weight_est_g: asFiniteNumber(fetalWeightEst),
          notes: notes.trim() || null,
        });
      } else if (logType === 'fetal_movement') {
        await onSave({
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: 'fetal_movement',
          kick_count: asFiniteNumber(kickCount),
          kick_duration_min: asFiniteNumber(kickDuration),
          notes: notes.trim() || null,
        });
      } else if (logType === 'lab_result') {
        await onSave({
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: 'lab_result',
          lab_name: labName.trim() || null,
          lab_result_text: labResult.trim() || null,
          notes: notes.trim() || null,
        });
      } else if (logType === 'medication') {
        await onSave({
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: 'medication',
          medication_name: medicationName.trim() || null,
          notes: notes.trim() || null,
        });
      } else if (logType === 'symptom') {
        await onSave({
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: 'symptom',
          symptom_tags: symptoms.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await onSave({
          baby_id: babyId,
          group_id: currentGroupId,
          log_type: 'diary',
          notes: notes.trim() || null,
        });
      }
      onClose();
    } catch (err) {
      console.error('[PrenatalQuickLogModal]', err);
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ key: PrenatalLogType; label: string }> = [
    { key: 'checkup_note', label: t.prenatal_card_checkup },
    { key: 'maternal_weight', label: t.prenatal_card_maternal },
    { key: 'fetal_movement', label: t.prenatal_card_kicks },
    { key: 'lab_result', label: t.prenatal_card_lab },
    { key: 'medication', label: t.prenatal_medication_name },
    { key: 'fetal_size', label: t.prenatal_card_fetal_size },
    { key: 'diary', label: t.prenatal_card_diary },
    { key: 'symptom', label: t.prenatal_log_symptom },
  ];

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white pb-safe shadow-2xl dark:bg-gray-900 sm:w-[420px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-2 pt-4 dark:border-gray-800">
          <h2 className="text-base font-bold">{t.record_now}</h2>
          <button type="button" onClick={onClose} className="text-xl text-gray-400">×</button>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setLogType(tab.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                logType === tab.key ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {(logType === 'maternal_weight' || logType === 'blood_pressure') && (
            <>
              <label className="block text-xs text-gray-500">{t.prenatal_weight_kg}</label>
              <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)}
                className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500">{t.prenatal_systolic}</label>
                  <input type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">{t.prenatal_diastolic}</label>
                  <input type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)}
                    className={inputClass} />
                </div>
              </div>
            </>
          )}
          {logType === 'fetal_size' && (
            <p className="text-sm text-gray-600">
              {t.prenatal_fetal_size_value
                .replace('{weeks}', String(weeksPregnant))
                .replace('{size}', fetalSizeLabelForWeek(weeksPregnant))}
            </p>
          )}
          {logType === 'checkup_note' && (
            <>
              <label className="block text-xs text-gray-500">{t.prenatal_checkup_at}</label>
              <input type="date" value={checkupAt} onChange={(e) => setCheckupAt(e.target.value)}
                className={inputClass} />
              <label className="block text-xs text-gray-500">{t.prenatal_hospital}</label>
              <input type="text" value={hospital} onChange={(e) => setHospital(e.target.value)}
                placeholder={t.prenatal_hospital_placeholder}
                className={inputClass} />
              <label className="block text-xs text-gray-500">{t.prenatal_next_checkup}</label>
              <input type="date" value={nextCheckup} onChange={(e) => setNextCheckup(e.target.value)}
                className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500">{t.prenatal_fundal_height}</label>
                  <input type="number" step="0.1" value={fundalHeight} onChange={(e) => setFundalHeight(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">{t.prenatal_fetal_weight_est}</label>
                  <input type="number" value={fetalWeightEst} onChange={(e) => setFetalWeightEst(e.target.value)}
                    className={inputClass} />
                </div>
              </div>
            </>
          )}
          {logType === 'fetal_movement' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500">{t.prenatal_kick_count}</label>
                <input type="number" min="0" value={kickCount} onChange={(e) => setKickCount(e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500">{t.prenatal_kick_duration}</label>
                <input type="number" min="0" value={kickDuration} onChange={(e) => setKickDuration(e.target.value)}
                  className={inputClass} />
              </div>
            </div>
          )}
          {logType === 'lab_result' && (
            <>
              <label className="block text-xs text-gray-500">{t.prenatal_lab_name}</label>
              <input type="text" value={labName} onChange={(e) => setLabName(e.target.value)}
                className={inputClass} />
              <label className="block text-xs text-gray-500">{t.prenatal_lab_result}</label>
              <input type="text" value={labResult} onChange={(e) => setLabResult(e.target.value)}
                className={inputClass} />
            </>
          )}
          {logType === 'medication' && (
            <>
              <label className="block text-xs text-gray-500">{t.prenatal_medication_name}</label>
              <input type="text" value={medicationName} onChange={(e) => setMedicationName(e.target.value)}
                className={inputClass} />
            </>
          )}
          {logType === 'symptom' && (
            <>
              <label className="block text-xs text-gray-500">{t.prenatal_log_symptom}</label>
              <input type="text" value={symptoms} onChange={(e) => setSymptoms(e.target.value)}
                placeholder="ex) 입덧, 부종"
                className={inputClass} />
            </>
          )}
          <label className="block text-xs text-gray-500">{t.notes}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className={inputClass} />
        </div>
        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="w-full rounded-xl bg-pink-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? '...' : t.save}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
