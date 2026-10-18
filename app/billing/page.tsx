'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { CURRENT_APP_ID, isAppId } from '@/lib/apps';
import { billingApiMessage, formatBillingTranslation, getBillingTranslation } from '@/lib/translations/billing';
import { buildBillingProductId, type BillingQuotaTier } from '@/lib/billing-catalog';
import { openBillingPurchase } from '@/lib/billing-purchase-client';
import { supabase } from '@/lib/supabase';

const FIVE_GB = 5 * 1024 * 1024 * 1024;
const TWENTY_GB = 20 * 1024 * 1024 * 1024;

type PromoNotice = {
  virtualPayment: boolean;
  includedSeats: number;
  basePriceCents: number;
  betaBasePriceCents: number;
  extraSeatPriceCents: number;
  betaExtraSeatPriceCents: number;
  storageUpgradePriceCents: number;
  betaStorageUpgradePriceCents: number;
};

type GroupBillingState = {
  appId?: string;
  isOwner?: boolean;
  quotaBytes: number;
  memberCount: number;
  allowedSeats: number;
  betaOwner: boolean;
  betaPeriodEnabled: boolean;
  virtualPayment: boolean;
};

type PurchaseChoice = 'seats' | '5gb' | '20gb';

function formatUsd(cents: number): string {
  return `USD ${(cents / 100).toFixed(2)}`;
}

function BillingCheckout() {
  const { lang } = useLanguage();
  const bt = (key: Parameters<typeof getBillingTranslation>[1]) => getBillingTranslation(lang, key);
  const searchParams = useSearchParams();
  const { currentGroupId } = useGroup();
  const groupId = searchParams.get('groupId')?.trim() || currentGroupId || '';
  const mode = searchParams.get('mode') ?? '';
  const reason = searchParams.get('reason') ?? '';
  const isAdminTest = mode === 'new-user-test';
  const intent = searchParams.get('intent');
  const [choice, setChoice] = useState<PurchaseChoice>(
    intent === 'seats' ? 'seats' : intent === '20gb' || intent === '10gb' || intent === 'storage' ? '20gb' : '5gb',
  );
  const [code, setCode] = useState('');
  const [shownCode, setShownCode] = useState('');
  const [notice, setNotice] = useState<PromoNotice | null>(null);
  const [groupState, setGroupState] = useState<GroupBillingState | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [billingRefresh, setBillingRefresh] = useState(0);

  const betaPeriodEnabled = groupState?.betaPeriodEnabled !== false;
  const needsPromo = !isAdminTest && groupState?.betaOwner === true;

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) setError(bt('login_required'));
        return;
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const stateRes = await fetch(`/api/billing/group-state?groupId=${encodeURIComponent(groupId)}`, { headers });
      const stateJson = await stateRes.json();
      if (cancelled) return;
      if (!stateRes.ok) {
        setError(billingApiMessage(lang, stateJson, bt('state_failed')));
        return;
      }
      setGroupState(stateJson);
      if (isAdminTest || stateJson.betaOwner !== true) return;
      const promoRes = await fetch(`/api/billing/promo?groupId=${encodeURIComponent(groupId)}`, { headers });
      const promoJson = await promoRes.json();
      if (cancelled) return;
      if (!promoRes.ok) {
        setError(billingApiMessage(lang, promoJson, bt('promo_load_failed')));
        return;
      }
      setShownCode(promoJson.code || '');
      setNotice(promoJson.notice ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, isAdminTest, billingRefresh, lang]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`billing-page:${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billing_subscriptions', filter: `group_id=eq.${groupId}` },
        () => setBillingRefresh((current) => current + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!understood) {
      setError(bt('confirm_required'));
      return;
    }
    if (!groupId || !groupState) {
      setError(bt('state_not_ready'));
      return;
    }
    if (groupState.isOwner === false) {
      setError(bt('owner_only'));
      return;
    }
    if (needsPromo && code.trim().toUpperCase() !== shownCode.trim().toUpperCase()) {
      setError(bt('promo_mismatch'));
      return;
    }

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!session?.access_token || !user?.id) {
        setError(bt('login_required'));
        return;
      }

      if (needsPromo) {
        const res = await fetch('/api/billing/promo', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ groupId, code }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(billingApiMessage(lang, json, bt('promo_check_failed')));
          return;
        }
      }

      const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?.trim() ?? '';
      if (!apiKey) {
        setMessage(bt('sdk_key_missing'));
        return;
      }

      const betaPrice = needsPromo;
      const seatCount = choice === 'seats'
        ? Math.max(groupState.memberCount, groupState.allowedSeats) + 1
        : Math.max(groupState.allowedSeats, groupState.memberCount, 2);
      const quotaTier: BillingQuotaTier = choice === '20gb'
        ? '20gb'
        : choice === 'seats' && groupState.quotaBytes >= TWENTY_GB
          ? '20gb'
          : '5gb';
      const quotaAction = choice === 'seats' && groupState.quotaBytes < FIVE_GB
        ? 'keep'
        : quotaTier;
      const productId = buildBillingProductId({
        appId: isAppId(groupState.appId) ? groupState.appId : CURRENT_APP_ID,
        seatCount: isAdminTest ? 2 : seatCount,
        quotaTier: isAdminTest ? '5gb' : quotaTier,
        betaPrice: isAdminTest ? false : betaPrice,
      });

      const result = await openBillingPurchase({
        apiKey,
        appUserId: `${CURRENT_APP_ID}:${user.id}`,
        groupId,
        productId,
        quotaAction: isAdminTest ? '5gb' : quotaAction,
        customerEmail: user.email,
      });
      if (result === 'cancelled') {
        setMessage(bt('sheet_cancelled'));
        return;
      }
      if (result === 'missing_product') {
        setError(formatBillingTranslation(lang, 'product_missing', { productId }));
        return;
      }
      setMessage(bt('sheet_done'));
    } catch (purchaseError) {
      const text = purchaseError instanceof Error ? purchaseError.message : bt('sheet_failed');
      setError(text);
    } finally {
      setBusy(false);
    }
  }

  const baseExample = notice ? formatUsd(notice.basePriceCents) : 'USD 1.00';
  const betaExample = notice ? formatUsd(notice.betaBasePriceCents) : 'USD 0.50';
  const testStore = groupState?.virtualPayment !== false;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-8 text-slate-900">
      <h1 className="text-2xl font-bold">
        {isAdminTest ? bt('title_test') : betaPeriodEnabled ? bt('title_virtual') : bt('title_paid')}
      </h1>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6">
        {betaPeriodEnabled ? (
          isAdminTest ? (
            <>
              <p>{bt('admin_no_charge')}</p>
              <p>{bt('bug_test')}</p>
              <p>{bt('admin_after_charge')}</p>
            </>
          ) : (
            <>
              <p>{bt('owner_no_card')}</p>
              <p>{bt('bug_test')}</p>
              <p>{bt('owner_after_notice')}</p>
              <p>{bt('owner_half_later')}</p>
            </>
          )
        ) : (
          <>
            <p>{bt('ended_need_sub')}</p>
            {testStore ? (
              <p>{bt('test_store_no_charge')}</p>
            ) : (
              <p>{bt('real_charge')}</p>
            )}
            <p>{bt('half_vs_full')}</p>
          </>
        )}
        <p>{formatBillingTranslation(lang, 'example', { base: baseExample, beta: betaExample })}</p>
        {needsPromo ? <p>{bt('enter_promo')}</p> : null}
        <p>{bt('server_confirms')}</p>
        {reason === 'subscription-required' ? (
          <p>{bt('no_active_sub')}</p>
        ) : null}
      </div>

      {isAdminTest ? (
        <p className="text-sm text-slate-600">
          {bt('admin_test_note')}
        </p>
      ) : null}

      {!groupId ? <p className="text-sm text-red-700">{bt('no_group')}</p> : null}
      {groupState?.isOwner === false ? (
        <p className="text-sm text-red-700">{bt('owner_only')}</p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {isAdminTest ? (
          <p className="text-sm text-slate-700">{bt('admin_test_product')}</p>
        ) : (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">{bt('choice_legend')}</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={choice === 'seats'} onChange={() => setChoice('seats')} />
            {bt('choice_seat')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={choice === '5gb'} onChange={() => setChoice('5gb')} />
            {bt('choice_5gb')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={choice === '20gb'} onChange={() => setChoice('20gb')} />
            {bt('choice_20gb')}
          </label>
        </fieldset>
        )}
        {needsPromo && shownCode ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
            {formatBillingTranslation(lang, 'promo_for_group', { code: shownCode })}
          </p>
        ) : null}
        {needsPromo ? (
          <label className="flex flex-col gap-1 text-sm">
            {bt('promo_label')}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              autoComplete="off"
            />
          </label>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="mt-1"
          />
          {bt('understood')}
        </label>
        <button
          type="submit"
          disabled={busy || groupState?.isOwner === false}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? bt('opening_sheet') : bt('open_sheet')}
        </button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </main>
  );
}

function BillingFallback() {
  const { lang } = useLanguage();
  return <main className="px-4 py-8 text-sm text-slate-600">{getBillingTranslation(lang, 'loading')}</main>;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingCheckout />
    </Suspense>
  );
}
