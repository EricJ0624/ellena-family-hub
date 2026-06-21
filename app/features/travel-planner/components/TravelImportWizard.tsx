'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Copy, Loader2, MessageSquare, X } from 'lucide-react';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTravelTranslation } from '@/lib/translations/travel';
import { supabase } from '@/lib/supabase';
import { formatCurrencyOptionLabel, getTopCurrencyCodes } from '@/lib/currencies';
import { intlLocaleForLang } from '@/lib/language-fonts';
import {
  applyImportedItinerary,
  createTripFromImport,
  IMPORT_PROMPT_TEMPLATE,
} from '@/lib/modules/travel-planner/itinerary-import-apply';
import {
  parseItineraryImportText,
  resolveImportItemDates,
} from '@/lib/modules/travel-planner/itinerary-import-parser';
import type {
  ImportItemKind,
  ImportWizardStep,
  ParsedImportItem,
} from '@/lib/modules/travel-planner/itinerary-import-types';

const KIND_OPTIONS: ImportItemKind[] = [
  'accommodation',
  'dining',
  'attraction',
  'transport',
  'other',
];

export function TravelImportWizard() {
  const router = useRouter();
  const { lang } = useLanguage();
  const tt = (key: Parameters<typeof getTravelTranslation>[1]) => getTravelTranslation(lang, key);
  const { currentGroupId, userRole, isOwner } = useGroup();
  const isTripAdmin = userRole === 'ADMIN' || isOwner;
  const localeForMoney = intlLocaleForLang(lang);

  const [step, setStep] = useState<ImportWizardStep>('paste');
  const [pasteText, setPasteText] = useState('');
  const [showPromptExample, setShowPromptExample] = useState(false);
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formCurrency, setFormCurrency] = useState('KRW');
  const [submitting, setSubmitting] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(getTravelTranslation(lang, 'auth_required'));
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [lang]);

  const resolvedItems = useMemo(() => {
    if (!formStartDate || !formEndDate) return items;
    return resolveImportItemDates(items, formStartDate, formEndDate);
  }, [items, formStartDate, formEndDate]);

  const handleClose = () => {
    router.push('/dashboard');
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT_TEMPLATE);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setShowPromptExample(true);
    }
  };

  const handleAnalyze = () => {
    if (!pasteText.trim()) {
      alert(tt('import_no_text'));
      return;
    }
    const { meta, items: parsed } = parseItineraryImportText(pasteText);
    if (parsed.length === 0) {
      alert(tt('import_parse_empty'));
      return;
    }
    setItems(parsed);
    setFormTitle(meta.title?.trim() || '');
    setFormDestination(meta.destination?.trim() || '');
    setFormStartDate(meta.start_date || '');
    setFormEndDate(meta.end_date || '');
    setFormBudget(meta.budget != null ? String(meta.budget) : '');
    setStep('trip');
  };

  const handleTripNext = () => {
    if (!formTitle.trim() || !formStartDate || !formEndDate) {
      alert(tt('alert_trip_required'));
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      alert(tt('alert_end_after_start'));
      return;
    }
    setStep('preview');
  };

  const updateItemKind = (id: string, kind: ImportItemKind) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, kind, low_confidence: kind === 'other' } : it)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const kindLabel = (kind: ImportItemKind) => {
    switch (kind) {
      case 'accommodation':
        return tt('import_kind_accommodation');
      case 'dining':
        return tt('import_kind_dining');
      case 'attraction':
        return tt('import_kind_attraction');
      case 'transport':
        return tt('import_kind_transport');
      default:
        return tt('import_kind_other');
    }
  };

  const handleApply = async () => {
    if (!currentGroupId) {
      alert(tt('select_group_first'));
      return;
    }
    const toApply = resolvedItems.filter((it) => {
      if (it.kind === 'accommodation') {
        return Boolean(it.title.trim() && (it.check_in_date || it.day_date));
      }
      return Boolean(it.title.trim() && it.day_date);
    });
    if (toApply.length === 0) {
      alert(tt('import_parse_empty'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const tripId = await createTripFromImport({
        groupId: currentGroupId,
        title: formTitle.trim(),
        destination: formDestination.trim() || undefined,
        start_date: formStartDate,
        end_date: formEndDate,
        budget: formBudget.trim() ? Number(formBudget) : null,
        currency: isTripAdmin ? formCurrency : undefined,
        headers,
      });
      await applyImportedItinerary({
        groupId: currentGroupId,
        tripId,
        items: toApply,
        headers,
      });
      router.replace(`/travel?tripId=${tripId}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('import_apply_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentGroupId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-600">{tt('select_group_first')}</p>
        <button
          type="button"
          onClick={handleClose}
          className="mt-4 cursor-pointer rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {tt('go_to_dashboard')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (step === 'paste') handleClose();
            else if (step === 'trip') setStep('paste');
            else setStep('trip');
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent p-1 text-sm font-medium text-slate-600"
        >
          <ChevronLeft className="h-5 w-5" />
          {step === 'paste' ? tt('import_close') : tt('import_back_button')}
        </button>
        <h1 className="m-0 text-base font-semibold text-slate-800">{tt('import_wizard_title')}</h1>
        <button
          type="button"
          onClick={handleClose}
          className="cursor-pointer rounded-lg border-0 bg-transparent p-1 text-slate-500"
          aria-label={tt('import_close')}
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 pb-8">
        {step === 'paste' && (
          <>
            <div className="flex gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
                <p className="m-0 text-sm leading-relaxed text-slate-700">{tt('import_intro_1')}</p>
                <p className="mb-2 mt-3 text-sm font-medium text-slate-800">{tt('import_intro_2')}</p>
                <button
                  type="button"
                  onClick={() => void handleCopyPrompt()}
                  className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copyDone ? tt('import_copy_done') : tt('import_copy_prompt')}
                </button>
                {showPromptExample && (
                  <pre className="mb-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                    {IMPORT_PROMPT_TEMPLATE}
                  </pre>
                )}
                <button
                  type="button"
                  onClick={() => setShowPromptExample((v) => !v)}
                  className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-violet-700 underline"
                >
                  {showPromptExample ? tt('import_hide_example') : tt('import_show_example')}
                </button>
                <p className="m-0 text-sm leading-relaxed text-slate-600">{tt('import_intro_3')}</p>
                <p className="m-0 mt-2 text-xs leading-relaxed text-slate-500">{tt('import_intro_4')}</p>
              </div>
            </div>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={tt('import_paste_placeholder')}
              rows={10}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
            />

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!pasteText.trim()}
              className="w-full cursor-pointer rounded-xl border-0 bg-violet-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {tt('import_analyze_button')}
            </button>
          </>
        )}

        {step === 'trip' && (
          <>
            <p className="m-0 text-sm font-medium text-slate-700">{tt('import_step_trip')}</p>
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
              <label className="mb-1 block text-xs font-medium text-slate-600">{tt('label_title')}</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs font-medium text-slate-600">{tt('label_destination')}</label>
              <input
                value={formDestination}
                onChange={(e) => setFormDestination(e.target.value)}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs font-medium text-slate-600">{tt('label_start_date')}</label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs font-medium text-slate-600">{tt('label_end_date')}</label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs font-medium text-slate-600">{tt('label_budget')}</label>
              <input
                type="number"
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                placeholder={tt('placeholder_optional')}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {isTripAdmin && (
                <>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{tt('label_trip_currency')}</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {getTopCurrencyCodes().map((c) => (
                      <option key={c} value={c}>
                        {formatCurrencyOptionLabel(c, localeForMoney)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleTripNext}
              className="w-full cursor-pointer rounded-xl border-0 bg-violet-600 py-3 text-sm font-bold text-white"
            >
              {tt('import_next_button')}
            </button>
          </>
        )}

        {step === 'preview' && (
          <>
            <p className="m-0 text-sm text-slate-600">
              {tt('import_items_found').replace('{n}', String(resolvedItems.length))}
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {resolvedItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/80"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800">{item.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {item.kind === 'accommodation'
                          ? `${item.check_in_date || item.day_date || '?'} ~ ${item.check_out_date || '?'}`
                          : `${item.day_date || `Day ${item.day_index ?? '?'}`}${item.start_time ? ` · ${item.start_time}` : ''}`}
                      </div>
                      {item.low_confidence && (
                        <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          {tt('import_other_hint')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="shrink-0 cursor-pointer rounded border-0 bg-red-50 px-2 py-1 text-xs text-red-700"
                    >
                      {tt('delete')}
                    </button>
                  </div>
                  <select
                    value={item.kind}
                    onChange={(e) => updateItemKind(item.id, e.target.value as ImportItemKind)}
                    className="box-border w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {kindLabel(k)}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={submitting}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-violet-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? tt('import_applying') : tt('import_apply_button')}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
