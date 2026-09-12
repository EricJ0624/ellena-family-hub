'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/ui/cn';
import {
  formatAdminSignupSettingsTranslation,
  getAdminSignupSettingsTranslation,
} from '@/lib/translations/adminSignupSettings';
import { parseSignupMaxUsers, type SignupAvailability } from '@/lib/signup-settings';
import { ALL_APP_IDS, APP_ID_LABELS, type AppId } from '@/lib/apps';
import type { LangCode } from '@/lib/language-fonts';

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

type AppSignupRow = SignupAvailability & { appId: AppId };

type SignupSettingsSectionProps = {
  lang: LangCode;
};

export function SignupSettingsSection({ lang }: SignupSettingsSectionProps) {
  const t = useCallback(
    (key: Parameters<typeof getAdminSignupSettingsTranslation>[1]) =>
      getAdminSignupSettingsTranslation(lang, key),
    [lang],
  );
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AppSignupRow[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<AppId>(ALL_APP_IDS[0]);
  const [maxInput, setMaxInput] = useState('');
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingMax, setSavingMax] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = rows.find((r) => r.appId === selectedAppId) ?? null;

  const applyList = useCallback((list: AppSignupRow[]) => {
    setRows(list);
    setSelectedAppId((prev) => {
      if (list.some((r) => r.appId === prev)) return prev;
      return list[0]?.appId ?? ALL_APP_IDS[0];
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setMaxInput(selected.signupMaxUsers == null ? '' : String(selected.signupMaxUsers));
  }, [selected]);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setError(t('load_failed'));
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const response = await fetch('/api/admin/signup-settings', { headers });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('load_failed'));
      const list = (Array.isArray(result.data) ? result.data : []) as AppSignupRow[];
      applyList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('load_failed'));
    } finally {
      setLoading(false);
    }
  }, [applyList, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (payload: {
    appId: AppId;
    signupEnabled: boolean;
    signupMaxUsers: number | null;
  }) => {
    const headers = await authHeaders();
    if (!headers) throw new Error(t('save_failed'));
    const response = await fetch('/api/admin/signup-settings', {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('save_failed'));
    const updated = result.data as AppSignupRow;
    setRows((prev) => prev.map((r) => (r.appId === updated.appId ? { ...r, ...updated } : r)));
  };

  const handleToggle = async () => {
    if (!selected || savingToggle) return;
    const nextEnabled = !selected.signupEnabled;
    if (!nextEnabled && !window.confirm(t('confirm_disable'))) return;
    setSavingToggle(true);
    setNotice(null);
    setError(null);
    try {
      await patch({
        appId: selected.appId,
        signupEnabled: nextEnabled,
        signupMaxUsers: selected.signupMaxUsers,
      });
      setNotice(t('saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('save_failed'));
    } finally {
      setSavingToggle(false);
    }
  };

  const handleSaveMax = async () => {
    if (!selected || savingMax) return;
    const parsed = parseSignupMaxUsers(maxInput.trim() === '' ? null : maxInput.trim());
    if (!parsed.ok) {
      setError(t('invalid_max'));
      return;
    }
    if (parsed.value != null && parsed.value < selected.currentUserCount) {
      if (!window.confirm(t('confirm_cap_below'))) return;
    }
    setSavingMax(true);
    setNotice(null);
    setError(null);
    try {
      await patch({
        appId: selected.appId,
        signupEnabled: selected.signupEnabled,
        signupMaxUsers: parsed.value,
      });
      setNotice(t('saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('save_failed'));
    } finally {
      setSavingMax(false);
    }
  };

  const statusText = !selected
    ? ''
    : selected.reason === 'disabled'
      ? t('status_disabled')
      : selected.reason === 'cap_reached'
        ? t('status_cap')
        : t('status_allowed');

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-1 text-base font-semibold text-slate-800">{t('title')}</h3>
      <p className="mb-4 text-[13px] leading-5 text-slate-500">{t('hint')}</p>

      {loading ? (
        <div className="flex items-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {ALL_APP_IDS.map((appId) => {
              const row = rows.find((r) => r.appId === appId);
              const active = selectedAppId === appId;
              return (
                <button
                  key={appId}
                  type="button"
                  onClick={() => setSelectedAppId(appId)}
                  className={cn(
                    'cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
                    active
                      ? 'border-purple-500 bg-purple-50 text-purple-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {APP_ID_LABELS[appId]}
                  {row ? (
                    <span className="ml-1.5 font-normal text-slate-500">
                      ({row.currentUserCount}
                      {row.signupMaxUsers != null ? `/${row.signupMaxUsers}` : ''})
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={selected?.signupEnabled === true}
              aria-label={t('switch_label')}
              disabled={!selected || savingToggle}
              onClick={() => void handleToggle()}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full border-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70',
                selected?.signupEnabled ? 'bg-emerald-500' : 'bg-slate-300',
                (!selected || savingToggle) && 'cursor-not-allowed opacity-70',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]',
                  selected?.signupEnabled ? 'left-5' : 'left-0.5',
                )}
              />
            </button>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {APP_ID_LABELS[selectedAppId]} ·{' '}
                {selected?.signupEnabled ? t('switch_on') : t('switch_off')}
              </div>
              <div
                className={cn(
                  'text-[13px]',
                  selected?.allowed ? 'text-emerald-600' : 'text-amber-700',
                )}
              >
                {statusText}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">{t('max_label')}</span>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder={t('max_placeholder')}
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSaveMax();
                  }
                }}
                className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={!selected || savingMax}
              onClick={() => void handleSaveMax()}
              className="cursor-pointer rounded-md border-none bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingMax ? t('save_max') + '…' : t('save_max')}
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-5 text-slate-500">{t('max_hint')}</p>
          {selected && (
            <p className="mt-1 text-sm font-medium text-slate-700">
              {formatAdminSignupSettingsTranslation(lang, 'current_count', {
                count: selected.currentUserCount,
              })}
              {' · '}
              {selected.signupMaxUsers == null
                ? t('unlimited')
                : `${selected.currentUserCount} / ${selected.signupMaxUsers}`}
            </p>
          )}

          {notice && <p className="mt-3 text-sm text-emerald-600">{notice}</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
