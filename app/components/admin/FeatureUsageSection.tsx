'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DASHBOARD_WIDGET_KEYS, type DashboardWidgetKey } from '@/lib/widgets/types';
import {
  FEATURE_USAGE_PERIODS,
  type FeatureUsagePayload,
  type FeatureUsagePeriod,
} from '@/lib/admin-feature-usage';
import {
  getAdminFeatureUsageTranslation,
  type AdminFeatureUsageTranslations,
} from '@/lib/translations/adminFeatureUsage';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getTravelTranslation } from '@/lib/translations/travel';
import { getPiggyTranslation } from '@/lib/translations/piggy';
import { getGamesTranslation } from '@/lib/translations/games';
import { intlLocaleForLang, type LangCode } from '@/lib/language-fonts';

type SnapshotRow = {
  id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  group_id: string | null;
  totals: FeatureUsagePayload['totals'];
  per_group: FeatureUsagePayload['perGroup'];
  last_reset_at: string | null;
  saved_at: string;
  note: string | null;
};

type FeatureUsageSectionProps = {
  lang: LangCode;
};

const PERIOD_LABEL_KEY: Record<FeatureUsagePeriod, keyof AdminFeatureUsageTranslations> = {
  today: 'period_today',
  '7d': 'period_7d',
  '30d': 'period_30d',
  since_reset: 'period_since_reset',
  custom: 'period_custom',
};

function widgetLabel(lang: LangCode, key: DashboardWidgetKey): string {
  switch (key) {
    case 'tasks':
      return getDashboardTranslation(lang, 'todo_section_title');
    case 'calendar':
      return getDashboardTranslation(lang, 'section_title_calendar');
    case 'chat':
      return getDashboardTranslation(lang, 'section_title_chat');
    case 'location':
      return getDashboardTranslation(lang, 'section_title_location');
    case 'album':
      return getDashboardTranslation(lang, 'section_title_memories');
    case 'travel':
      return getTravelTranslation(lang, 'title');
    case 'piggy':
      return getPiggyTranslation(lang, 'piggy_label');
    case 'games':
      return getGamesTranslation(lang, 'section_title');
    case 'travel_diary':
      return getTravelTranslation(lang, 'diary_modal_title');
    default:
      return key;
  }
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateInput(value: string): Date {
  return startOfLocalDay(new Date(`${value}T00:00:00`));
}

function rangeForPeriod(
  period: FeatureUsagePeriod,
  customFrom: string,
  customTo: string,
  lastResetAt: string | null,
): { from: Date; to: Date } {
  const now = new Date();
  if (period === 'today') return { from: startOfLocalDay(now), to: now };
  if (period === '7d') return { from: startOfLocalDay(addDays(now, -6)), to: now };
  if (period === '30d') return { from: startOfLocalDay(addDays(now, -29)), to: now };
  if (period === 'since_reset') {
    return { from: lastResetAt ? new Date(lastResetAt) : new Date(0), to: now };
  }
  const from = customFrom ? parseLocalDateInput(customFrom) : startOfLocalDay(now);
  const to = customTo ? addDays(parseLocalDateInput(customTo), 1) : now;
  return { from, to };
}

function barWidthClass(count: number, maxCount: number): string {
  if (count <= 0) return 'w-0';
  const ratio = count / maxCount;
  if (ratio >= 0.9) return 'w-full';
  if (ratio >= 0.75) return 'w-3/4';
  if (ratio >= 0.55) return 'w-1/2';
  if (ratio >= 0.35) return 'w-1/3';
  if (ratio >= 0.2) return 'w-1/4';
  if (ratio >= 0.1) return 'w-1/6';
  return 'w-4';
}

async function authHeaders(): Promise<HeadersInit | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function FeatureUsageSection({ lang }: FeatureUsageSectionProps) {
  const t = useCallback(
    (key: Parameters<typeof getAdminFeatureUsageTranslation>[1]) =>
      getAdminFeatureUsageTranslation(lang, key),
    [lang],
  );
  const locale = intlLocaleForLang(lang);
  const todayValue = toDateInputValue(new Date());

  const [period, setPeriod] = useState<FeatureUsagePeriod>('today');
  const [customFrom, setCustomFrom] = useState(todayValue);
  const [customTo, setCustomTo] = useState(todayValue);
  const [groupId, setGroupId] = useState('');
  const [note, setNote] = useState('');
  const [live, setLive] = useState<FeatureUsagePayload | null>(null);
  const [groupOptions, setGroupOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [viewing, setViewing] = useState<SnapshotRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const display = useMemo((): FeatureUsagePayload | null => {
    if (!viewing) return live;
    return {
      periodLabel: viewing.period_label,
      periodStart: viewing.period_start,
      periodEnd: viewing.period_end,
      effectiveFrom: viewing.period_start,
      lastResetAt: viewing.last_reset_at,
      groupId: viewing.group_id,
      totals: viewing.totals,
      perGroup: viewing.per_group || [],
    };
  }, [live, viewing]);

  const rankedWidgets = useMemo(() => {
    if (!display) return [];
    return [...DASHBOARD_WIDGET_KEYS]
      .map((key) => ({ key, count: Number(display.totals[key] || 0) }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [display]);

  const maxCount = Math.max(1, ...rankedWidgets.map((item) => item.count));

  const loadLive = useCallback(async (resetAtHint?: string | null) => {
    const headers = await authHeaders();
    if (!headers) {
      setError(t('load_failed'));
      return;
    }
    const lastResetAt = resetAtHint ?? live?.lastResetAt ?? null;
    const range = rangeForPeriod(period, customFrom, customTo, lastResetAt);
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      period,
    });
    if (groupId) params.set('group_id', groupId);

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/feature-usage?${params.toString()}`, { headers });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('load_failed'));
      const next = result.data as FeatureUsagePayload;
      setLive(next);
      if (!groupId) {
        setGroupOptions(next.perGroup.map((group) => ({ id: group.groupId, name: group.groupName })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('load_failed'));
    } finally {
      setLoading(false);
    }
  }, [customFrom, customTo, groupId, live?.lastResetAt, period, t]);

  const loadSnapshots = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    try {
      const response = await fetch('/api/admin/feature-usage/snapshots', { headers });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('load_failed'));
      setSnapshots(result.data || []);
    } catch (err) {
      console.error('활동량 저장 기록 조회 오류:', err);
    }
  }, [t]);

  useEffect(() => {
    void loadLive();
    void loadSnapshots();
    // 기간·그룹이 바뀔 때만 다시 조회. loadLive 함수 자체는 의존에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo, groupId]);

  const formatDateTime = (value: string | null) => {
    if (!value) return t('never_reset');
    return new Date(value).toLocaleString(locale);
  };

  const formatCount = (count: number) => {
    const unit = t('count_unit');
    return unit ? `${count.toLocaleString(locale)} ${unit}` : count.toLocaleString(locale);
  };

  const handleSave = async () => {
    const headers = await authHeaders();
    if (!headers || !live) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const range = rangeForPeriod(period, customFrom, customTo, live.lastResetAt);
      const response = await fetch('/api/admin/feature-usage/snapshots', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          period,
          groupId: groupId || null,
          note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('save_failed'));
      setNote('');
      setNotice(t('save_ok'));
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(t('reset_confirm'))) return;
    const headers = await authHeaders();
    if (!headers) return;
    setResetting(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch('/api/admin/feature-usage/reset', {
        method: 'POST',
        headers,
        body: JSON.stringify({ note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('reset_failed'));
      setViewing(null);
      setNotice(t('reset_ok'));
      await loadLive(result.data?.reset_at ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reset_failed'));
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!window.confirm(t('delete_snapshot_confirm'))) return;
    const headers = await authHeaders();
    if (!headers) return;
    try {
      const response = await fetch(`/api/admin/feature-usage/snapshots?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('load_failed'));
      if (viewing?.id === id) setViewing(null);
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('load_failed'));
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{t('title')}</h3>
          <p className="mt-1 max-w-3xl text-[13px] text-slate-500">{t('hint')}</p>
          <p className="mt-1 max-w-3xl text-[12px] text-slate-400">{t('reset_hint')}</p>
        </div>
        {loading && (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-purple-600" />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {viewing ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-900">
          <span>
            {t('viewing_saved')} · {formatDateTime(viewing.saved_at)}
            {viewing.note ? ` · ${viewing.note}` : ''}
          </span>
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="rounded-md border border-purple-300 bg-white px-3 py-1 text-xs font-semibold text-purple-800 hover:bg-purple-100"
          >
            {t('back_to_live')}
          </button>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{t('period')}</span>
            {FEATURE_USAGE_PERIODS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  period === item
                    ? 'bg-purple-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t(PERIOD_LABEL_KEY[item])}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                {t('from')}
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2 text-slate-600">
                {t('to')}
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              {t('group_filter')}
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="">{t('group_all')}</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('note_placeholder')}
              className="min-w-[180px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !live}
              className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={resetting}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              {t('reset')}
            </button>
          </div>
        </div>
      )}

      {display && (
        <>
          <p className="mb-4 text-xs text-slate-500">
            {t('last_reset')}: {formatDateTime(display.lastResetAt)}
            {' · '}
            {t('effective_from')}: {formatDateTime(display.effectiveFrom)}
          </p>

          <h4 className="mb-3 text-sm font-semibold text-slate-800">{t('overall')}</h4>
          <ul className="mb-6 flex flex-col gap-2">
            {rankedWidgets.map((item) => (
              <li key={item.key} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-sm text-slate-700">{widgetLabel(lang, item.key)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${item.count === 0 ? 'bg-slate-300' : 'bg-purple-500'} ${barWidthClass(item.count, maxCount)}`}
                  />
                </div>
                <span className={`w-24 shrink-0 text-right text-sm font-semibold ${item.count === 0 ? 'text-slate-400' : 'text-slate-800'}`}>
                  {item.count === 0 ? t('unused') : formatCount(item.count)}
                </span>
              </li>
            ))}
          </ul>

          <h4 className="mb-3 text-sm font-semibold text-slate-800">{t('per_group')}</h4>
          <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-3 py-2 font-semibold">{t('group_filter')}</th>
                  {DASHBOARD_WIDGET_KEYS.map((key) => (
                    <th key={key} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {widgetLabel(lang, key)}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold">{t('overall')}</th>
                </tr>
              </thead>
              <tbody>
                {display.perGroup.map((group) => (
                  <tr key={group.groupId} className="border-t border-slate-100">
                    <td className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-800">
                      {group.groupName}
                    </td>
                    {DASHBOARD_WIDGET_KEYS.map((key) => {
                      const count = Number(group.counts?.[key] || 0);
                      return (
                        <td
                          key={key}
                          className={`px-3 py-2 ${count === 0 ? 'text-slate-400' : 'text-slate-700'}`}
                        >
                          {count === 0 ? '0' : formatCount(count)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {formatCount(group.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4 className="mb-3 text-sm font-semibold text-slate-800">{t('saved_title')}</h4>
      {snapshots.length === 0 ? (
        <p className="text-sm text-slate-400">{t('no_snapshots')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {snapshots.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => setViewing(row)}
                className="text-left text-sm text-slate-700 hover:text-purple-700"
              >
                <span className="font-semibold">{formatDateTime(row.saved_at)}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {PERIOD_LABEL_KEY[row.period_label as FeatureUsagePeriod]
                    ? t(PERIOD_LABEL_KEY[row.period_label as FeatureUsagePeriod])
                    : row.period_label}
                  {row.note ? ` · ${row.note}` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSnapshot(row.id)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t('delete_snapshot')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
