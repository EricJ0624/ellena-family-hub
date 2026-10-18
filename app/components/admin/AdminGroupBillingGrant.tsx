'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { LangCode } from '@/lib/language-fonts';
import { getBillingTranslation } from '@/lib/translations/billing';
import { cn } from '@/lib/ui/cn';

const GB = 1024 * 1024 * 1024;

function quotaGbText(bytes: number): string {
  if (!bytes || bytes <= 0) return '5.00';
  return (bytes / GB).toFixed(2);
}

type AdminGroupBillingGrantProps = {
  lang: LangCode;
  groupId: string;
  billingComp: boolean;
  compSeats: number | null;
  quotaBytes: number;
  onSaved: () => void;
};

export function AdminGroupBillingGrant({
  lang,
  groupId,
  billingComp,
  compSeats,
  quotaBytes,
  onSaved,
}: AdminGroupBillingGrantProps) {
  const bt = (key: Parameters<typeof getBillingTranslation>[1]) => getBillingTranslation(lang, key);
  const initialQuota = quotaGbText(quotaBytes);
  const initialSeats = compSeats && compSeats > 0 ? String(compSeats) : '2';
  const [enabled, setEnabled] = useState(billingComp);
  const [seats, setSeats] = useState(initialSeats);
  const [quota, setQuota] = useState(initialQuota);
  const [savedSeats, setSavedSeats] = useState(initialSeats);
  const [savedQuota, setSavedQuota] = useState(initialQuota);
  const [persisted, setPersisted] = useState(billingComp);
  const [saving, setSaving] = useState(false);

  const unchanged = seats === savedSeats && quota === savedQuota;
  const buttonLabel = persisted && unchanged ? bt('comp_saved') : persisted ? bt('comp_change') : bt('comp_save');

  async function save(nextEnabled: boolean) {
    const seatCount = Number(seats);
    const quotaValue = Number(quota);
    const quotaBytesToSave = quota === quotaGbText(quotaBytes)
      ? quotaBytes
      : Math.round(quotaValue * GB);
    if (nextEnabled && (!Number.isInteger(seatCount) || seatCount < 1 || !Number.isFinite(quotaValue) || quotaValue <= 0)) {
      alert(bt('comp_invalid'));
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(bt('login_required'));
        return;
      }
      const response = await fetch('/api/admin/group-storage', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          nextEnabled
            ? { groupId, billingComp: true, billingCompSeats: seatCount, storageQuotaBytes: quotaBytesToSave }
            : { groupId, billingComp: false },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || bt('comp_invalid'));
      setEnabled(nextEnabled);
      setPersisted(nextEnabled);
      if (nextEnabled) {
        setSavedSeats(seats);
        setSavedQuota(quota);
      }
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : bt('comp_invalid'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">{bt('comp_title')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={() => {
            if (enabled) {
              if (billingComp) void save(false);
              else setEnabled(false);
              return;
            }
            setEnabled(true);
          }}
          className={cn(
            'relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70',
            enabled ? 'bg-emerald-500' : 'bg-slate-300',
            saving && 'cursor-not-allowed opacity-70',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]',
              enabled ? 'left-5' : 'left-0.5',
            )}
          />
        </button>
      </div>
      {enabled ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
            {bt('comp_seats')}
            <input
              type="number"
              min={1}
              step={1}
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
            {bt('comp_quota')}
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={quota}
              onChange={(event) => setQuota(event.target.value)}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800"
            />
          </label>
          <button
            type="button"
            disabled={saving || (persisted && unchanged)}
            onClick={() => { void save(true); }}
            className="cursor-pointer rounded-md border-none bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-600"
          >
            {buttonLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
