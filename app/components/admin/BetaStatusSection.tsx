'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/ui/cn';
import { ALL_APP_IDS, APP_ID_LABELS, type AppId } from '@/lib/apps';
import type { LangCode } from '@/lib/language-fonts';
import { billingApiMessage, formatBillingTranslation, getBillingTranslation } from '@/lib/translations/billing';

type BetaStatusRow = {
  appId: AppId;
  betaCount: number;
  limit: number;
  betaPeriodEnabled: boolean;
};

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function BetaStatusSection({ lang }: { lang: LangCode }) {
  const bt = (key: Parameters<typeof getBillingTranslation>[1]) => getBillingTranslation(lang, key);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BetaStatusRow[]>([]);
  const [savingAppId, setSavingAppId] = useState<AppId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setError(bt('beta_load_failed'));
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const response = await fetch('/api/admin/billing/beta-status', { headers });
      const result = await response.json();
      if (!response.ok) throw new Error(billingApiMessage(lang, result, bt('beta_load_failed')));
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : bt('beta_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(row: BetaStatusRow) {
    const next = !row.betaPeriodEnabled;
    if (
      !next &&
      !window.confirm(
        formatBillingTranslation(lang, 'beta_confirm_off', { app: APP_ID_LABELS[row.appId] }),
      )
    ) {
      return;
    }
    const headers = await authHeaders();
    if (!headers) {
      setError(bt('login_required'));
      return;
    }
    setSavingAppId(row.appId);
    setError(null);
    try {
      const response = await fetch('/api/admin/billing/beta-status', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ appId: row.appId, enabled: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(billingApiMessage(lang, result, bt('beta_save_failed')));
      setRows((current) =>
        current.map((item) =>
          item.appId === row.appId ? { ...item, betaPeriodEnabled: next } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : bt('beta_save_failed'));
    } finally {
      setSavingAppId(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-1 text-base font-semibold text-slate-800">{bt('beta_status_title')}</h3>
      <p className="mb-4 text-[13px] leading-5 text-slate-500">{bt('beta_status_hint')}</p>

      {loading ? (
        <div className="flex items-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {ALL_APP_IDS.map((appId) => {
            const row = rows.find((item) => item.appId === appId);
            const enabled = row?.betaPeriodEnabled !== false;
            const saving = savingAppId === appId;
            return (
              <li
                key={appId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{APP_ID_LABELS[appId]}</div>
                  <div className="text-[13px] text-slate-600">
                    {formatBillingTranslation(lang, 'beta_count', {
                      count: row ? row.betaCount : 0,
                      limit: row?.limit ?? 100,
                    })}
                    {' · '}
                    {enabled ? bt('beta_on') : bt('beta_off')}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={formatBillingTranslation(lang, 'beta_switch_label', { app: APP_ID_LABELS[appId] })}
                  disabled={!row || saving}
                  onClick={() => row && void toggle(row)}
                  className={cn(
                    'relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70',
                    enabled ? 'bg-emerald-500' : 'bg-slate-300',
                    (!row || saving) && 'cursor-not-allowed opacity-70',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]',
                      enabled ? 'left-5' : 'left-0.5',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
