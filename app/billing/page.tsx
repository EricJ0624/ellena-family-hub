'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { CURRENT_APP_ID, isAppId } from '@/lib/apps';
import type { LangCode } from '@/lib/language-fonts';
import { billingApiMessage, formatBillingTranslation, getBillingTranslation } from '@/lib/translations/billing';
import { billingAppUserId, buildBillingProductId, type BillingQuotaTier } from '@/lib/billing-catalog';
import { openBillingPurchase } from '@/lib/billing-purchase-client';
import { clearDashboardScrollMemory } from '@/lib/dashboard-scroll-memory';
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

type PurchaseChoice = 'seats' | '5gb' | '20gb' | 'floor3' | 'floor20';

function formatUsd(cents: number): string {
  return `USD ${(cents / 100).toFixed(2)}`;
}

function isStorageIntent(intent: string | null): boolean {
  return intent === '20gb' || intent === '10gb' || intent === 'storage';
}

const ADMIN_TEST_SEAT_MAX = 8;

type AdminTestBlock = 'beta_floor' | 'beta_account' | 'card' | null;

type AdminTestRow = {
  key: string;
  seatCount: number;
  quotaTier: BillingQuotaTier;
  kind: 'official' | 'beta' | 'card';
  blocked: AdminTestBlock;
};

function planPriceCents(seatCount: number, quotaTier: BillingQuotaTier): number {
  return 100 + Math.max(0, seatCount - 2) * 100 + (quotaTier === '20gb' ? 100 : 0);
}

function buildAdminTestRows(): AdminTestRow[] {
  const rows: AdminTestRow[] = [];
  const tiers: BillingQuotaTier[] = ['5gb', '20gb'];
  for (const quotaTier of tiers) {
    for (let seatCount = 2; seatCount <= ADMIN_TEST_SEAT_MAX; seatCount += 1) {
      rows.push({
        key: `official-${seatCount}-${quotaTier}`,
        seatCount,
        quotaTier,
        kind: 'official',
        blocked: null,
      });
    }
  }
  rows.push(
    {
      key: 'beta-floor',
      seatCount: 2,
      quotaTier: '5gb',
      kind: 'beta',
      blocked: 'beta_floor',
    },
    {
      key: 'beta-account',
      seatCount: 0,
      quotaTier: '5gb',
      kind: 'beta',
      blocked: 'beta_account',
    },
  );
  rows.push({
    key: 'card',
    seatCount: 0,
    quotaTier: '5gb',
    kind: 'card',
    blocked: 'card',
  });
  return rows;
}

const ADMIN_TEST_ROWS = buildAdminTestRows();

function adminTestBlockedMessage(
  blocked: AdminTestBlock,
  bt: (key: Parameters<typeof getBillingTranslation>[1]) => string,
): string {
  if (blocked === 'beta_floor') return bt('test_blocked_beta_floor');
  if (blocked === 'beta_account') return bt('test_blocked_beta_account');
  if (blocked === 'card') return bt('test_blocked_card');
  return bt('test_pick_required');
}

function AdminTestCatalog({
  lang,
  testKey,
  onSelect,
}: {
  lang: LangCode;
  testKey: string;
  onSelect: (key: string) => void;
}) {
  const bt = (key: Parameters<typeof getBillingTranslation>[1]) => getBillingTranslation(lang, key);
  const sections: Array<{ kind: AdminTestRow['kind']; title: string }> = [
    { kind: 'official', title: bt('test_section_official') },
    { kind: 'beta', title: bt('test_section_beta') },
    { kind: 'card', title: bt('test_section_card') },
  ];
  return (
    <div className="flex flex-col gap-4 text-sm text-slate-900">
      <p className="font-medium">{bt('admin_test_product')}</p>
      {sections.map((section) => (
        <fieldset key={section.kind} className="flex flex-col gap-2">
          <legend className="font-medium">{section.title}</legend>
          {ADMIN_TEST_ROWS.filter((row) => row.kind === section.kind).map((row) => {
            if (row.blocked) {
              const reason = adminTestBlockedMessage(row.blocked, bt);
              return (
                <div key={row.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  {row.kind === 'beta' ? (
                    <p className="text-red-700">{reason}</p>
                  ) : (
                    <>
                      <p className="font-medium text-slate-900">{bt('test_card_row')}</p>
                      <p className="mt-1 text-red-700">{reason}</p>
                    </>
                  )}
                </div>
              );
            }
            const people = formatBillingTranslation(lang, 'test_people', { count: row.seatCount });
            const quota = row.quotaTier === '20gb' ? '20GB' : '5GB';
            const price = formatUsd(planPriceCents(row.seatCount, row.quotaTier));
            const label = formatBillingTranslation(lang, 'test_official_row', { people, quota, price });
            return (
              <label key={row.key} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="admin-test-product"
                  checked={testKey === row.key}
                  onChange={() => onSelect(row.key)}
                />
                {label}
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

function resolvePurchaseChoice(
  choice: PurchaseChoice,
  minimumFloor: boolean,
  intent: string | null,
): PurchaseChoice {
  if (!minimumFloor) {
    if (choice === 'floor20') return '20gb';
    if (choice === 'floor3') return '5gb';
    return choice;
  }
  if (choice === 'floor3') return 'floor3';
  if (choice === 'floor20' || choice === '20gb') return 'floor20';
  if (isStorageIntent(intent)) return 'floor20';
  return 'floor3';
}

function BillingCheckout() {
  const { lang } = useLanguage();
  const bt = (key: Parameters<typeof getBillingTranslation>[1]) => getBillingTranslation(lang, key);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentGroupId } = useGroup();
  const groupId = searchParams.get('groupId')?.trim() || currentGroupId || '';
  const mode = searchParams.get('mode') ?? '';
  const reason = searchParams.get('reason') ?? '';
  const isAdminTest = mode === 'new-user-test';
  const [adminTestAllowed, setAdminTestAllowed] = useState(false);
  const showAdminTest = isAdminTest && adminTestAllowed;
  const intent = searchParams.get('intent');
  const [choice, setChoice] = useState<PurchaseChoice>(
    intent === 'seats' ? 'seats' : isStorageIntent(intent) ? '20gb' : '5gb',
  );
  const [testKey, setTestKey] = useState('official-2-5gb');
  const [code, setCode] = useState('');
  const [shownCode, setShownCode] = useState('');
  const [notice, setNotice] = useState<PromoNotice | null>(null);
  const [groupState, setGroupState] = useState<GroupBillingState | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [billingRefresh, setBillingRefresh] = useState(0);

  const betaPeriodEnabled = groupState?.betaPeriodEnabled !== false;
  const needsPromo = !showAdminTest && groupState?.betaOwner === true;
  const minimumFloor = needsPromo
    && (groupState?.memberCount ?? 0) <= 2
    && (groupState?.allowedSeats ?? 0) <= 2
    && (groupState?.quotaBytes ?? 0) < TWENTY_GB;
  const selectedChoice = resolvePurchaseChoice(choice, minimumFloor, intent);

  useEffect(() => {
    if (!isAdminTest) {
      setAdminTestAllowed(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || cancelled) {
        if (!cancelled) setAdminTestAllowed(false);
        return;
      }
      const { data, error } = await supabase.rpc('is_system_admin', {
        user_id_param: session.user.id,
      });
      if (!cancelled) setAdminTestAllowed(!error && data === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminTest]);

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
      if (showAdminTest || stateJson.betaOwner !== true) return;
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
  }, [groupId, showAdminTest, billingRefresh, lang]);

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

  const leaveBilling = () => {
    if (showAdminTest) {
      router.push('/admin');
      return;
    }
    if (isStorageIntent(intent)) {
      clearDashboardScrollMemory();
      router.push('/dashboard?focus=album');
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/dashboard');
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setPaid(false);
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
    if (needsPromo && (!shownCode || code.trim().toUpperCase() !== shownCode.trim().toUpperCase())) {
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

      const adminRow = showAdminTest ? ADMIN_TEST_ROWS.find((item) => item.key === testKey) : null;
      if (showAdminTest && (!adminRow || adminRow.blocked)) {
        setError(adminRow ? adminTestBlockedMessage(adminRow.blocked, bt) : bt('test_pick_required'));
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?.trim() ?? '';
      if (!apiKey) {
        setMessage(bt('sdk_key_missing'));
        return;
      }

      const betaPrice = needsPromo;
      const seatCount = selectedChoice === 'floor20'
        ? 2
        : selectedChoice === 'floor3'
          ? 3
          : selectedChoice === 'seats'
            ? Math.max(groupState.memberCount, groupState.allowedSeats) + 1
            : Math.max(groupState.allowedSeats, groupState.memberCount, 2);
      const quotaTier: BillingQuotaTier = selectedChoice === 'floor20' || selectedChoice === '20gb'
        ? '20gb'
        : selectedChoice === 'seats' && groupState.quotaBytes >= TWENTY_GB
          ? '20gb'
          : '5gb';
      const quotaAction = selectedChoice === 'floor3' || selectedChoice === 'floor20'
        ? quotaTier
        : selectedChoice === 'seats' && groupState.quotaBytes < FIVE_GB
          ? 'keep'
          : quotaTier;
      const productId = buildBillingProductId({
        appId: isAppId(groupState.appId) ? groupState.appId : CURRENT_APP_ID,
        seatCount: adminRow ? adminRow.seatCount : seatCount,
        quotaTier: adminRow ? adminRow.quotaTier : quotaTier,
        betaPrice: showAdminTest ? false : betaPrice,
      });

      const result = await openBillingPurchase({
        apiKey,
        appUserId: billingAppUserId(CURRENT_APP_ID, user.id),
        groupId,
        productId,
        quotaAction: adminRow ? adminRow.quotaTier : quotaAction,
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
      setPaid(true);
      setMessage(bt('payment_succeeded'));
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
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-4 bg-white px-4 py-8 text-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {showAdminTest ? bt('title_test') : betaPeriodEnabled ? bt('title_virtual') : bt('title_paid')}
        </h1>
        <button
          type="button"
          onClick={leaveBilling}
          className="shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
        >
          {bt('test_exit')}
        </button>
      </div>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6">
        {betaPeriodEnabled ? (
          showAdminTest ? (
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
        {minimumFloor ? null : (
          <p>{formatBillingTranslation(lang, 'example', { base: baseExample, beta: betaExample })}</p>
        )}
        {needsPromo ? <p>{bt('enter_promo')}</p> : null}
        <p>{bt('server_confirms')}</p>
        {reason === 'subscription-required' ? (
          <p>{bt('no_active_sub')}</p>
        ) : null}
      </div>

      {showAdminTest ? (
        <p className="text-sm text-slate-800">
          {bt('admin_test_note')}
        </p>
      ) : null}

      {!groupId ? <p className="text-sm text-red-700">{bt('no_group')}</p> : null}
      {groupState?.isOwner === false ? (
        <p className="text-sm text-red-700">{bt('owner_only')}</p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {showAdminTest ? (
          <AdminTestCatalog lang={lang} testKey={testKey} onSelect={setTestKey} />
        ) : minimumFloor ? (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">{bt('choice_legend')}</legend>
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 leading-6">
            {bt('floor_minimum_notice')}
          </p>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={selectedChoice === 'floor3'} onChange={() => setChoice('floor3')} />
            {bt('floor_choice_3_5gb')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={selectedChoice === 'floor20'} onChange={() => setChoice('floor20')} />
            {bt('floor_choice_2_20gb')}
          </label>
        </fieldset>
        ) : (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">{bt('choice_legend')}</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={selectedChoice === 'seats'} onChange={() => setChoice('seats')} />
            {bt('choice_seat')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={selectedChoice === '5gb'} onChange={() => setChoice('5gb')} />
            {bt('choice_5gb')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="choice" checked={selectedChoice === '20gb'} onChange={() => setChoice('20gb')} />
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
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-slate-800">{message}</p> : null}
      {paid ? (
        <button
          type="button"
          onClick={leaveBilling}
          className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {bt('payment_ok')}
        </button>
      ) : null}
    </main>
  );
}

function BillingFallback() {
  const { lang } = useLanguage();
  return <main className="min-h-screen bg-white px-4 py-8 text-sm text-slate-800">{getBillingTranslation(lang, 'loading')}</main>;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingCheckout />
    </Suspense>
  );
}
