'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBabyGrowthRecords } from '../hooks/useBabyGrowthRecords';
import { buildVaccineDDayViews } from '../utils/vaccination-schedule';
import type { BabyProfile, VaccineDDayView } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface VaccinationScheduleProps {
  profile: BabyProfile;
  currentGroupId: string | null;
  userId: string;
  t: BabyGrowthTranslations;
}

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800';

export function VaccinationSchedule({
  profile, currentGroupId, userId, t,
}: VaccinationScheduleProps) {
  const [views, setViews] = useState<VaccineDDayView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<VaccineDDayView | 'custom' | null>(null);

  const { fetchVaccinations, upsertVaccination } = useBabyGrowthRecords({
    babyId: profile.id,
    currentGroupId,
    userId,
  });

  const reload = useCallback(async () => {
    const records = await fetchVaccinations();
    setViews(buildVaccineDDayViews(profile.country_code, profile.birth_date, records));
  }, [fetchVaccinations, profile.birth_date, profile.country_code]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const saveRecord = async (input: {
    vaccineKey: string;
    scheduledAt: string | null;
    administeredAt: string | null;
    facilityName: string;
    productName: string;
    customLabel: string | null;
    notes: string;
  }) => {
    await upsertVaccination({
      baby_id: profile.id,
      group_id: currentGroupId ?? '',
      vaccine_key: input.vaccineKey,
      scheduled_at: input.scheduledAt,
      administered_at: input.administeredAt,
      facility_name: input.facilityName.trim() || null,
      product_name: input.productName.trim() || null,
      custom_label: input.customLabel,
      notes: input.notes.trim() || null,
    });
    await reload();
    setEditor(null);
  };

  if (loading) {
    return <div className="p-4 text-xs text-gray-400">{t.loading}</div>;
  }

  const standard = views.filter((view) => !view.isCustom);
  const custom = views.filter((view) => view.isCustom);
  const upcoming = standard.filter((view) => !view.isDone && view.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil);
  const overdue = standard.filter((view) => !view.isDone && view.daysUntil < 0).sort((a, b) => a.daysUntil - b.daysUntil);
  const done = standard.filter((view) => view.isDone);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-base font-bold">{t.vaccine_title}</h2>

      {overdue.length > 0 && (
        <Section title="⚠️ 지연" color="red">
          {overdue.map((view) => <VaccineRow key={view.vaccineKey} view={view} t={t} onOpen={setEditor} />)}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="📅 예정" color="blue">
          {upcoming.map((view) => <VaccineRow key={view.vaccineKey} view={view} t={t} onOpen={setEditor} />)}
        </Section>
      )}

      {done.length > 0 && (
        <Section title="✅ 완료" color="green">
          {done.map((view) => <VaccineRow key={view.vaccineKey} view={view} t={t} onOpen={setEditor} />)}
        </Section>
      )}

      {custom.length > 0 && (
        <Section title={t.vaccine_custom_section} color="green">
          {custom.map((view) => <VaccineRow key={view.vaccineKey} view={view} t={t} onOpen={setEditor} />)}
        </Section>
      )}

      <button
        type="button"
        onClick={() => setEditor('custom')}
        className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white"
      >
        {t.vaccine_custom_add}
      </button>

      {editor && (
        <VaccineEditor
          view={editor === 'custom' ? null : editor}
          t={t}
          onClose={() => setEditor(null)}
          onSave={saveRecord}
        />
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
      <h3 className={`mb-2 text-sm font-semibold ${colorMap[color]}`}>{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function VaccineRow({
  view, t, onOpen,
}: { view: VaccineDDayView; t: BabyGrowthTranslations; onOpen: (view: VaccineDDayView) => void }) {
  const ddayLabel =
    view.daysUntil === 0
      ? t.vaccine_dday_today
      : view.daysUntil < 0
      ? t.vaccine_dday_past.replace('{n}', String(Math.abs(view.daysUntil)))
      : `D-${view.daysUntil}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(view)}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        view.isDone
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
          : view.daysUntil < 0
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : 'border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20'
      }`}
    >
      <span className="text-base">{view.isDone ? '✅' : '💉'}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{view.label}</p>
        {(view.disease || view.productName) && (
          <p className="truncate text-xs text-gray-400">{view.disease || view.productName}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {view.isDone ? (
          <>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{view.administeredAt}</p>
            {view.facilityName && <p className="text-[10px] text-gray-400">{view.facilityName}</p>}
          </>
        ) : !view.isCustom && (
          <>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{ddayLabel}</p>
            {view.scheduledAt && <p className="text-[10px] text-gray-400">{view.scheduledAt}</p>}
          </>
        )}
      </div>
    </button>
  );
}

function VaccineEditor({
  view, t, onClose, onSave,
}: {
  view: VaccineDDayView | null;
  t: BabyGrowthTranslations;
  onClose: () => void;
  onSave: (input: {
    vaccineKey: string;
    scheduledAt: string | null;
    administeredAt: string | null;
    facilityName: string;
    productName: string;
    customLabel: string | null;
    notes: string;
  }) => Promise<void>;
}) {
  const isCustom = !view || view.isCustom;
  const [vaccineKey] = useState(() => view?.vaccineKey ?? `custom:${crypto.randomUUID()}`);
  const [name, setName] = useState(view?.isCustom ? view.label : '');
  const [date, setDate] = useState(view?.administeredAt ?? '');
  const [facility, setFacility] = useState(view?.facilityName ?? '');
  const [product, setProduct] = useState(view?.productName ?? '');
  const [notes, setNotes] = useState(view?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const canSave = Boolean(date) && (!isCustom || name.trim().length > 0) && !saving;

  const submit = async (administeredAt: string | null) => {
    if (savingRef.current) return;
    if (administeredAt && !canSave) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({
        vaccineKey,
        scheduledAt: view && !view.isCustom ? view.scheduledAt : null,
        administeredAt,
        facilityName: facility,
        productName: product,
        customLabel: isCustom ? (name.trim() || view?.label || null) : null,
        notes,
      });
    } catch (error) {
      console.error('[VaccinationSchedule] 접종 기록 저장 오류:', error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-gray-900 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">{view ? view.label : t.vaccine_custom_add}</h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-500">{t.close}</button>
        </div>
        {view && !view.isCustom && (
          <p className="mb-3 text-xs text-gray-400">{t.vaccine_recommended} {view.scheduledAt}</p>
        )}
        <div className="space-y-3">
          {isCustom && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-500">{t.vaccine_custom_name}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500">{t.vaccine_date}</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500">{t.vaccine_facility}</span>
            <input value={facility} onChange={(event) => setFacility(event.target.value)} className={fieldClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500">{t.vaccine_product}</span>
            <input value={product} onChange={(event) => setProduct(event.target.value)} className={fieldClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500">{t.vaccine_reaction}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className={fieldClass} />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          {view?.isDone && (
            <button
              type="button"
              disabled={saving}
              onClick={() => { void submit(null); }}
              className="rounded-full px-4 py-2 text-sm font-semibold text-gray-500"
            >
              {t.vaccine_undo}
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={() => { void submit(date); }}
            className="ml-auto rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t.vaccine_save}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
