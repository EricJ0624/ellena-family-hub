'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getPiggyTranslation } from '@/lib/translations/piggy';
import {
  deleteAttachment,
  listAttachments,
  uploadFeatureAttachments,
  validateAttachmentFile,
  type UploadJob,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';
import { formatCurrencyOptionLabel, getAllowedCurrencyCodes } from '@/lib/currencies';
import { formatMoneyAmount } from '@/lib/format-currency';

export const dynamic = 'force-dynamic';

type PiggyAccount = {
  id: string;
  name: string;
  balance: number;
  currency: string;
  user_id?: string | null;
  ownerNickname?: string | null;
};

type PiggyWallet = {
  id: string;
  balance: number;
};

type MemberInfo = {
  user_id: string;
  email: string | null;
  nickname: string | null;
  role: 'ADMIN' | 'MEMBER';
};

type OpenRequest = {
  id: string;
  child_id: string;
  amount: number;
  reason: string | null;
  destination: 'wallet' | 'cash';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
};

type Transaction = {
  id: string;
  amount: number;
  type: string;
  typeLabel: string;
  memo: string | null;
  created_at: string;
  dateLabel: string;
  actor_nickname: string;
};

type PiggyAttachment = UploadedAttachment;

const LOCALE_MAP: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW' };

const PIGGY_CURRENCY_OPTIONS = [...getAllowedCurrencyCodes()];

function piggyTxAttachmentKey(entityType: 'piggy_wallet_tx' | 'piggy_bank_tx', entityId: string) {
  return `${entityType}:${entityId}`;
}

export default function PiggyBankPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const pt = (key: keyof import('@/lib/translations/piggy').PiggyTranslations) => getPiggyTranslation(lang, key);
  let currentGroupId: string | null = null;
  let currentGroup: { name?: string | null; piggy_currency?: string } | null = null;
  let userRole: 'ADMIN' | 'MEMBER' | null = null;
  let isOwner = false;
  let refreshGroups: (() => Promise<void>) | undefined;
  try {
    const groupContext = useGroup();
    currentGroupId = groupContext.currentGroupId;
    currentGroup = groupContext.currentGroup;
    userRole = groupContext.userRole;
    isOwner = groupContext.isOwner;
    refreshGroups = groupContext.refreshGroups;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('GroupProvider가 없습니다.');
    }
  }
  const [loading, setLoading] = useState(true);
  type MemberPiggy = {
    user_id: string;
    ownerNickname: string | null;
    noAccount: true;
  } | {
    id: string;
    user_id: string | null;
    ownerNickname: string | null;
    name: string;
    balance: number;
    walletBalance: number;
    currency?: string;
    noAccount: false;
  };
  const [summary, setSummary] = useState<{
    account?: PiggyAccount | null;
    wallet?: PiggyWallet | null;
    accounts?: PiggyAccount[];
    memberPiggies?: MemberPiggy[];
    pendingAccountRequest?: boolean;
  } | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [requests, setRequests] = useState<OpenRequest[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<Transaction[]>([]);
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildIdForAdmin, setSelectedChildIdForAdmin] = useState('');

  const isAdmin = useMemo(() => userRole === 'ADMIN' || isOwner, [userRole, isOwner]);

  const [piggyName, setPiggyName] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [allowanceMemo, setAllowanceMemo] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMemo, setDepositMemo] = useState('');
  const [spendAmount, setSpendAmount] = useState('');
  const [spendCategory, setSpendCategory] = useState('');
  const [spendMemo, setSpendMemo] = useState('');
  const [saveAmount, setSaveAmount] = useState('');
  const [saveMemo, setSaveMemo] = useState('');
  const [openAmount, setOpenAmount] = useState('');
  const [openReason, setOpenReason] = useState('');
  const [openDestination, setOpenDestination] = useState<'wallet' | 'cash'>('wallet');
  const [allowanceSubmitting, setAllowanceSubmitting] = useState(false);
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [spendSubmitting, setSpendSubmitting] = useState(false);
  const [openRequestSubmitting, setOpenRequestSubmitting] = useState(false);
  const [txAttachmentsByKey, setTxAttachmentsByKey] = useState<Record<string, PiggyAttachment[]>>({});
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentJobs, setAttachmentJobs] = useState<UploadJob[]>([]);
  const [receiptUploadingKey, setReceiptUploadingKey] = useState<string | null>(null);
  const [piggyCurrencySelect, setPiggyCurrencySelect] = useState('KRW');
  const [piggyCurrencySaving, setPiggyCurrencySaving] = useState(false);
  const pendingAttachmentUploadRef = useRef<{ entityType: 'piggy_wallet_tx' | 'piggy_bank_tx'; entityId: string } | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentAbortRef = useRef<AbortController | null>(null);

  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => {
    const c = currentGroup?.piggy_currency?.trim().toUpperCase();
    setPiggyCurrencySelect(c && /^[A-Z]{3}$/.test(c) ? c : 'KRW');
  }, [currentGroup?.piggy_currency]);

  const formatPiggyAmount = (value: number, currencyOverride?: string) => {
    const cur = (
      currencyOverride ||
      summary?.account?.currency ||
      currentGroup?.piggy_currency ||
      'KRW'
    )
      .trim()
      .toUpperCase() || 'KRW';
    return formatMoneyAmount(value, cur, LOCALE_MAP[lang] || 'en-US');
  };

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error(pt('auth_required'));
    }
    return { Authorization: `Bearer ${token}` };
  };

  const fetchSummary = async () => {
    if (!currentGroupId) return;
    const headers = await getAuthHeader();
    const url =
      isAdmin && selectedChildIdForAdmin
        ? `/api/piggy-bank/summary?group_id=${currentGroupId}&child_id=${selectedChildIdForAdmin}`
        : `/api/piggy-bank/summary?group_id=${currentGroupId}`;
    const response = await fetch(url, { headers });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || pt('load_summary_failed'));
    }
    setSummary({
      account: result.data.account,
      wallet: result.data.wallet,
      accounts: result.data.accounts,
      memberPiggies: result.data.memberPiggies,
      pendingAccountRequest: !!result.data.pendingAccountRequest,
    });
    if (result.data.account) {
      // ownerNickname을 우선 사용, 없으면 name 사용
      setPiggyName(result.data.account.ownerNickname || result.data.account.name);
    }
  };

  const fetchMembers = async () => {
    if (!currentGroupId || !isAdmin) return;
    const headers = await getAuthHeader();
    const response = await fetch(`/api/piggy-bank/members?group_id=${currentGroupId}`, {
      headers,
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || pt('load_children_failed'));
    }
    setMembers(result.data || []);
  };

  const fetchRequests = async () => {
    if (!currentGroupId) return;
    const headers = await getAuthHeader();
    const response = await fetch(`/api/piggy-bank/requests?group_id=${currentGroupId}`, {
      headers,
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || pt('load_requests_failed'));
    }
    setRequests(result.data || []);
  };

  const fetchTransactions = async () => {
    if (!currentGroupId) return;
    const headers = await getAuthHeader();
    const targetUserId = isAdmin && selectedChildIdForAdmin ? selectedChildIdForAdmin : undefined;
    const url = targetUserId
      ? `/api/piggy-bank/transactions?group_id=${currentGroupId}&child_id=${targetUserId}&limit=50`
      : `/api/piggy-bank/transactions?group_id=${currentGroupId}&limit=50`;
    const response = await fetch(url, { headers });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || pt('load_transactions_failed'));
    }
    setWalletTransactions(result.data?.walletTransactions || []);
    setBankTransactions(result.data?.bankTransactions || []);
  };

  const handleSavePiggyCurrency = async () => {
    if (!currentGroupId) return;
    setPiggyCurrencySaving(true);
    setError(null);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/groups/${currentGroupId}/piggy-currency`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: piggyCurrencySelect.trim().toUpperCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || pt('piggy_currency_save_failed'));
      await refreshGroups?.();
      await fetchSummary();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : pt('piggy_currency_save_failed'));
    } finally {
      setPiggyCurrencySaving(false);
    }
  };

  const loadAllTxAttachments = useCallback(async () => {
    if (!currentGroupId) return;
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const walletIds = walletTransactions.map((t) => String(t.id)).filter((id) => uuidLike.test(id));
    const bankIds = bankTransactions.map((t) => String(t.id)).filter((id) => uuidLike.test(id));
    try {
      const [walletRows, bankRows] = await Promise.all([
        walletIds.length ? listAttachments({ groupId: currentGroupId, entityType: 'piggy_wallet_tx', entityIds: walletIds }) : Promise.resolve([]),
        bankIds.length ? listAttachments({ groupId: currentGroupId, entityType: 'piggy_bank_tx', entityIds: bankIds }) : Promise.resolve([]),
      ]);
      const next: Record<string, PiggyAttachment[]> = {};
      for (const row of walletRows) {
        const k = piggyTxAttachmentKey('piggy_wallet_tx', String(row.entity_id));
        (next[k] ??= []).push(row);
      }
      for (const row of bankRows) {
        const k = piggyTxAttachmentKey('piggy_bank_tx', String(row.entity_id));
        (next[k] ??= []).push(row);
      }
      setTxAttachmentsByKey(next);
    } catch (e) {
      console.error(e);
    }
  }, [currentGroupId, walletTransactions, bankTransactions]);

  useEffect(() => {
    if (!currentGroupId) {
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([fetchSummary(), fetchRequests(), fetchMembers(), fetchTransactions()])
      .catch((err) => setError(err.message || pt('load_error')))
      .finally(() => setLoading(false));
  }, [currentGroupId, isAdmin, selectedChildIdForAdmin]);

  useEffect(() => {
    void loadAllTxAttachments();
  }, [loadAllTxAttachments]);

  /** 실시간 반영: 테이블당 채널 1개만 사용 (한 채널에 여러 postgres_changes 시 server/client bindings mismatch 방지) */
  useEffect(() => {
    if (!currentGroupId) return;

    const groupId = currentGroupId;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const chAccounts = supabase
      .channel(`piggy_bank_accounts:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piggy_bank_accounts', filter: `group_id=eq.${groupId}` }, () => {
        fetchSummary();
        fetchTransactions();
      })
      .subscribe();
    channels.push(chAccounts);

    const chWallets = supabase
      .channel(`piggy_wallets:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piggy_wallets', filter: `group_id=eq.${groupId}` }, () => fetchSummary())
      .subscribe();
    channels.push(chWallets);

    const chRequests = supabase
      .channel(`piggy_open_requests:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piggy_open_requests', filter: `group_id=eq.${groupId}` }, () => {
        fetchSummary();
        fetchRequests();
      })
      .subscribe();
    channels.push(chRequests);

    const chWalletTx = supabase
      .channel(`piggy_wallet_transactions:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piggy_wallet_transactions', filter: `group_id=eq.${groupId}` }, () => fetchTransactions())
      .subscribe();
    channels.push(chWalletTx);

    const chBankTx = supabase
      .channel(`piggy_bank_transactions:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piggy_bank_transactions', filter: `group_id=eq.${groupId}` }, () => fetchTransactions())
      .subscribe();
    channels.push(chBankTx);

    channelsRef.current = channels;

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [currentGroupId, isAdmin, selectedChildIdForAdmin]);

  const handleAction = async (url: string, payload: any) => {
    if (!currentGroupId) return;
    const headers = await getAuthHeader();
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: currentGroupId, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || pt('request_action_failed'));
    }
    await Promise.all([fetchSummary(), fetchRequests(), fetchTransactions()]);
  };

  const handleRename = async () => {
    if (!currentGroupId) return;
    const headers = await getAuthHeader();
    const body: { groupId: string; name: string; childId?: string } = { groupId: currentGroupId, name: piggyName };
    if (isAdmin && selectedChildIdForAdmin) body.childId = selectedChildIdForAdmin;
    const response = await fetch('/api/piggy-bank/settings', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || pt('rename_failed'));
    }
    await Promise.all([fetchSummary(), fetchTransactions()]);
  };

  const handleAddPiggyForChild = async (childId: string) => {
    if (!currentGroupId) return;
    const headers = await getAuthHeader();
    const response = await fetch('/api/piggy-bank/accounts', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: currentGroupId, childId }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || pt('add_piggy_failed'));
    }
    setSelectedChildIdForAdmin(childId);
    await Promise.all([fetchSummary(), fetchTransactions()]);
  };

  const handleRequestAccount = async () => {
    if (!currentGroupId) return;
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/piggy-bank/request-account', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: currentGroupId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || pt('request_failed'));
      alert(result.message || pt('request_sent'));
    } catch (err: any) {
      setError(err.message || pt('request_failed'));
    }
  };

  const handleDeletePiggy = async (childId: string) => {
    if (!currentGroupId || !confirm(pt('delete_confirm'))) return;
    try {
      const headers = await getAuthHeader();
      const response = await fetch(
        `/api/piggy-bank/accounts?groupId=${encodeURIComponent(currentGroupId)}&childId=${encodeURIComponent(childId)}`,
        { method: 'DELETE', headers }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || pt('delete_failed'));
      setSelectedChildIdForAdmin('');
      await Promise.all([fetchSummary(), fetchMembers(), fetchTransactions()]);
    } catch (err: any) {
      setError(err.message || pt('delete_failed'));
    }
  };

  const resolveMemberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    if (!member) return pt('child_label');
    return member.nickname || pt('child_label');
  };

  const handlePickAttachment = async (e: { target: HTMLInputElement }) => {
    const pending = pendingAttachmentUploadRef.current;
    if (!pending || !currentGroupId) {
      e.target.value = '';
      return;
    }
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      pendingAttachmentUploadRef.current = null;
      e.target.value = '';
      return;
    }
    for (const file of files) {
      const err = validateAttachmentFile(file);
      if (err) {
        alert(err);
        e.target.value = '';
        pendingAttachmentUploadRef.current = null;
        return;
      }
    }
    const mapKey = piggyTxAttachmentKey(pending.entityType, pending.entityId);
    setReceiptUploadingKey(mapKey);
    setAttachmentUploading(true);
    const abort = new AbortController();
    attachmentAbortRef.current = abort;
    try {
      await uploadFeatureAttachments({
        groupId: currentGroupId,
        featureType: 'piggy',
        entityType: pending.entityType,
        entityId: pending.entityId,
        files,
        maxConcurrent: 2,
        retryCount: 1,
        signal: abort.signal,
        onJobsChange: setAttachmentJobs,
      });
      const rows = await listAttachments({
        groupId: currentGroupId,
        entityType: pending.entityType,
        entityIds: [pending.entityId],
      });
      setTxAttachmentsByKey((prev) => ({ ...prev, [mapKey]: rows }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 사용자 취소 — 무시
      } else {
        alert(error instanceof Error ? error.message : pt('request_failed'));
      }
    } finally {
      setAttachmentUploading(false);
      setReceiptUploadingKey(null);
      attachmentAbortRef.current = null;
      pendingAttachmentUploadRef.current = null;
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-slate-500">{pt('loading')}</span>
      </div>
    );
  }

  if (!currentGroupId) {
    return null;
  }

  const hasAccountView = summary?.account && summary?.wallet;
  const memberPiggies = summary?.memberPiggies;
  const hasAccountsList = isAdmin && Array.isArray(memberPiggies);

  if (isAdmin && !selectedChildIdForAdmin && hasAccountsList) {
    const list = memberPiggies!;
    const accountsForSelect = list.filter((p): p is MemberPiggy & { noAccount: false } => !p.noAccount);
    const membersWithoutPiggy = list.filter((p) => p.noAccount);

    return (
      <div className="min-h-screen bg-slate-50 p-5">
        <div className="mb-5 flex items-center gap-4">
          <img src="/piggy/ellena-piggy-red.svg" alt="Ellena Piggy" className="h-[90px] w-[90px]" />
          <div>
            <h1 className="m-0 text-[22px] text-gray-800">{pt('management_title')}</h1>
            <p className="m-0 mt-1 text-slate-500">{currentGroup?.name || pt('group_label')} · {pt('piggy_per_child')}</p>
          </div>
        </div>
        {error && (
          <div className="mb-4 rounded-[10px] border border-red-200 bg-red-100 p-3 text-red-800">
            {error}
          </div>
        )}
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
          <h2 className="mb-2 mt-0 text-lg">{pt('piggy_currency_admin_title')}</h2>
          <p className="mb-3 mt-0 text-sm text-slate-500">ISO 4217 코드 · 모든 저금통에 동일하게 적용됩니다.</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={piggyCurrencySelect}
              onChange={(e) => setPiggyCurrencySelect(e.target.value)}
              className="flex-[1_1_200px] rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm"
            >
              {PIGGY_CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {formatCurrencyOptionLabel(c, LOCALE_MAP[lang] || 'en-US')}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={piggyCurrencySaving}
              onClick={() => void handleSavePiggyCurrency()}
              className={`rounded-[10px] border-none px-[18px] py-2.5 font-semibold text-white ${
                piggyCurrencySaving ? 'cursor-not-allowed bg-slate-300' : 'cursor-pointer bg-indigo-500'
              }`}
            >
              {piggyCurrencySaving ? '…' : pt('piggy_currency_save')}
            </button>
          </div>
        </div>
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
          <h2 className="m-0 text-lg">{pt('select_child_title')}</h2>
          <p className="mb-3 mt-2 text-sm text-slate-500">{pt('select_child_hint')}</p>
          <select
            value={selectedChildIdForAdmin}
            onChange={(e) => setSelectedChildIdForAdmin(e.target.value)}
            className="w-full rounded-[10px] border border-slate-200 p-3"
          >
            <option value="">{pt('select_placeholder')}</option>
            {accountsForSelect.map((acc) => (
              <option key={acc.id} value={acc.user_id || ''}>
                {acc.ownerNickname || pt('piggy_label')} · {pt('allowance_label')}{' '}
                {formatPiggyAmount(acc.walletBalance ?? 0, acc.currency)} / {pt('piggy_label')}{' '}
                {formatPiggyAmount(acc.balance, acc.currency)}
              </option>
            ))}
          </select>
          <p className="m-0 mt-2 text-xs text-slate-400">{pt('select_child_hint2')}</p>
        </div>
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
          <h2 className="m-0 text-lg">{pt('add_piggy_title')}</h2>
          <p className="mb-3 mt-2 text-sm text-slate-500">{pt('add_piggy_hint')}</p>
          {membersWithoutPiggy.length === 0 ? (
            <p className="text-slate-400">{pt('no_child_without_piggy')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {membersWithoutPiggy.map((p) => (
                <button
                  key={p.user_id}
                  onClick={async () => {
                    try {
                      await handleAddPiggyForChild(p.user_id);
                    } catch (err: any) {
                      setError(err.message || pt('add_piggy_failed_short'));
                    }
                  }}
                  className="rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-left font-semibold"
                >
                  + {p.ownerNickname || pt('child_label')} {pt('create_piggy_btn')}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mb-5 rounded-2xl bg-white p-4">
          <h2 className="m-0 text-lg">{pt('open_requests_title')}</h2>
          <div className="mt-3">
            {(() => {
              const pendingRequests = requests.filter((req) => req.status === 'pending');
              if (pendingRequests.length === 0) {
                return <p className="text-slate-400">{pt('no_pending_open_requests')}</p>;
              }
              const byChild = pendingRequests.reduce<Record<string, number>>((acc, req) => {
                const id = req.child_id || '';
                acc[id] = (acc[id] || 0) + 1;
                return acc;
              }, {});
              const total = pendingRequests.length;
              return (
                <div className="rounded-[10px] border border-amber-300 bg-amber-100 p-3 text-amber-800">
                  <div className="mb-2 font-semibold">
                    {pt('pending_open_requests_count')} {total}{pt('count_suffix')}
                  </div>
                  <ul className="m-0 list-disc pl-5 text-sm text-amber-900">
                    {Object.entries(byChild).map(([childId, count]) => (
                      <li key={childId} className="mb-1">
                        {resolveMemberName(childId)} {count}{pt('count_suffix')}
                      </li>
                    ))}
                  </ul>
                  <p className="m-0 mt-2 text-[13px] text-amber-900">
                    {pt('select_child_to_approve')}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-xl border-none bg-slate-200 px-4 py-3 font-semibold text-slate-700"
        >
          {pt('back_to_dashboard')}
        </button>
      </div>
    );
  }

  if (!hasAccountView) {
    if (summary !== null && summary.account == null && !isAdmin) {
      const pendingRequest = summary.pendingAccountRequest === true;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-5">
          <img src="/piggy/ellena-piggy-red.svg" alt="Ellena Piggy" className="h-20 w-20" />
          {pendingRequest ? (
            <p className="m-0 text-center text-base font-semibold text-amber-800">
              {pt('approval_pending')}
            </p>
          ) : (
            <p className="m-0 text-center text-base text-slate-600">
              {pt('no_piggy_ask_admin')}
            </p>
          )}
          {!pendingRequest && (
            <button
              type="button"
              onClick={handleRequestAccount}
              className="cursor-pointer rounded-[10px] border border-slate-400 bg-slate-100 px-5 py-3 font-semibold text-slate-600"
            >
              {pt('request_piggy_btn')}
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-[10px] border-none bg-slate-200 px-4 py-2.5 font-semibold text-slate-700"
          >
            {pt('go_dashboard')}
          </button>
        </div>
      );
    }
    if (summary !== null && summary.account == null && isAdmin && selectedChildIdForAdmin) {
      const childName = members.find((m) => m.user_id === selectedChildIdForAdmin)?.nickname || pt('child_label');
      return (
        <div className="min-h-screen bg-slate-50 p-5">
          <div className="mb-5 flex items-center gap-4">
            <img src="/piggy/ellena-piggy-red.svg" alt="Ellena Piggy" className="h-[90px] w-[90px]" />
            <div>
              <h1 className="m-0 text-[22px] text-gray-800">{pt('management_title')}</h1>
              <p className="m-0 mt-1 text-slate-500">{childName} · {pt('no_piggy')}</p>
            </div>
          </div>
          {error && (
            <div className="mb-4 rounded-[10px] border border-red-200 bg-red-100 p-3 text-red-800">{error}</div>
          )}
          <div className="mb-5 rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <p className="mb-4 text-[15px] text-slate-600">{pt('this_child_has_no_piggy')}</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await handleAddPiggyForChild(selectedChildIdForAdmin);
                } catch (err: any) {
                  setError(err.message || pt('add_piggy_failed_short'));
                }
              }}
              className="cursor-pointer rounded-[10px] border-none bg-green-500 px-5 py-3 font-semibold text-white"
            >
              {pt('add_piggy_btn')}
            </button>
          </div>
          <button
            onClick={() => router.push('/piggy-bank')}
            className="rounded-xl border-none bg-slate-200 px-4 py-3 font-semibold text-slate-700"
          >
            {pt('full_list')}
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-slate-500">{pt('loading')}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-5">
      <div className="mb-5 flex items-center gap-4">
        <img
          src="/piggy/ellena-piggy-red.svg"
          alt="Ellena Piggy"
          className="h-[90px] w-[90px]"
        />
        <div className="flex-1">
          {isAdmin && (
            <select
              value={selectedChildIdForAdmin}
              onChange={(e) => setSelectedChildIdForAdmin(e.target.value)}
              className="mb-2 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{pt('full_list')}</option>
              {members.filter((m) => m.role === 'MEMBER').map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.nickname || pt('child_label')}</option>
              ))}
            </select>
          )}
          <h1 className="m-0 text-[22px] text-gray-800">{summary!.account!.ownerNickname || summary!.account!.name}</h1>
          <p className="m-0 mt-1 text-slate-500">
            {currentGroup?.name || pt('group_label')} {isAdmin && selectedChildIdForAdmin ? `· ${resolveMemberName(selectedChildIdForAdmin)} ${pt('piggy_label')}` : pt('piggy_label')}
          </p>
          {isAdmin && selectedChildIdForAdmin && (
            <button
              type="button"
              onClick={() => handleDeletePiggy(selectedChildIdForAdmin)}
              className="mt-2 cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700"
            >
              {pt('delete_piggy_btn')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-red-200 bg-red-100 p-3 text-red-800">
          {error}
        </div>
      )}

      <input
        ref={receiptFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        onChange={handlePickAttachment}
        className="hidden"
      />

      <div className="mb-5 grid gap-3">
        <div className="rounded-[14px] border border-blue-200 bg-blue-50 p-4">
          <div className="text-[13px] text-blue-700">{pt('wallet_balance')}</div>
          <div className="text-2xl font-bold text-blue-700">
            {formatPiggyAmount(summary?.wallet?.balance ?? 0)}
          </div>
        </div>
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4">
          <div className="text-[13px] text-amber-800">{pt('piggy_balance')}</div>
          <div className="text-2xl font-bold text-amber-800">
            {formatPiggyAmount(summary?.account?.balance ?? 0)}
          </div>
        </div>
      </div>

      {/* 용돈 거래 내역 */}
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
        <h2 className="mb-3 mt-0 text-lg">{pt('allowance_history')}</h2>
        {walletTransactions.length === 0 ? (
          <p className="text-sm text-slate-400">{pt('no_allowance_tx')}</p>
        ) : (
          <div className="grid max-h-[330px] gap-2 overflow-y-auto pr-1">
            {walletTransactions.map((tx) => {
              const isNegative = tx.type === 'spend' || tx.type === 'child_save';
              const receiptKey = piggyTxAttachmentKey('piggy_wallet_tx', tx.id);
              const receipts = txAttachmentsByKey[receiptKey] ?? [];
              const showReceiptSection =
                receipts.length > 0 || (receiptUploadingKey === receiptKey && (attachmentUploading || attachmentJobs.length > 0));
              return (
                <div
                  key={tx.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs text-slate-500">{tx.dateLabel}</span>
                        <span className="text-[13px] font-semibold text-slate-800">{tx.typeLabel}</span>
                      </div>
                      {tx.actor_nickname && tx.type === 'allowance' && (
                        <div className="mb-1 text-xs text-slate-500">
                          {tx.actor_nickname}{pt('paid_by_suffix')}
                        </div>
                      )}
                      {tx.memo && (
                        <div className="text-xs text-slate-400">{tx.memo}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          pendingAttachmentUploadRef.current = { entityType: 'piggy_wallet_tx', entityId: tx.id };
                          receiptFileInputRef.current?.click();
                        }}
                        className="mt-1.5 cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        영수증 첨부
                      </button>
                    </div>
                    <div
                      className={`text-base font-bold ${isNegative ? 'text-red-700' : 'text-green-600'}`}
                    >
                      {isNegative ? '-' : '+'}{formatPiggyAmount(tx.amount)}
                    </div>
                  </div>
                  {showReceiptSection && (
                    <div className="w-full border-t border-slate-100 pt-2">
                      {receipts.length > 0 && (
                        <div className="flex flex-wrap items-start gap-2">
                          {receipts.map((att) => (
                            <div key={att.id} className="relative h-[72px] w-[72px]">
                              <a href={att.image_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={att.thumbnail_url || att.image_url}
                                  alt={att.original_filename}
                                  className="block h-[72px] w-[72px] rounded-lg object-cover"
                                />
                              </a>
                              <button
                                type="button"
                                aria-label="삭제"
                                onClick={() => {
                                  if (!currentGroupId) return;
                                  void (async () => {
                                    try {
                                      await deleteAttachment(currentGroupId, att.id);
                                      const rows = await listAttachments({
                                        groupId: currentGroupId,
                                        entityType: 'piggy_wallet_tx',
                                        entityIds: [tx.id],
                                      });
                                      setTxAttachmentsByKey((prev) => ({ ...prev, [receiptKey]: rows }));
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : '삭제 실패');
                                    }
                                  })();
                                }}
                                className="absolute right-1 top-1 h-5 w-5 cursor-pointer rounded-full border-none bg-[rgba(239,68,68,0.95)] p-0 text-xs leading-none text-white"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {receiptUploadingKey === receiptKey && attachmentJobs.length > 0 && (
                        <div className="mt-2 grid gap-1">
                          {attachmentJobs.map((job) => (
                            <div key={job.id} className="text-[11px] text-slate-500">
                              {job.fileName} · {job.status}
                              {job.status === 'uploading' ? ` ${Math.round(job.progress)}%` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                      {receiptUploadingKey === receiptKey && attachmentUploading && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-600">업로드 중…</span>
                          <button
                            type="button"
                            onClick={() => attachmentAbortRef.current?.abort()}
                            className="cursor-pointer rounded-lg border-none bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 저금통 거래 내역 */}
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
        <h2 className="mb-3 mt-0 text-lg">{pt('piggy_history')}</h2>
        {bankTransactions.length === 0 ? (
          <p className="text-sm text-slate-400">{pt('no_piggy_tx')}</p>
        ) : (
          <div className="grid max-h-[330px] gap-2 overflow-y-auto pr-1">
            {bankTransactions.map((tx) => {
              const isNegative = tx.type === 'withdraw_cash' || tx.type === 'withdraw_to_wallet';
              const receiptKey = piggyTxAttachmentKey('piggy_bank_tx', tx.id);
              const receipts = txAttachmentsByKey[receiptKey] ?? [];
              const showReceiptSection =
                receipts.length > 0 || (receiptUploadingKey === receiptKey && (attachmentUploading || attachmentJobs.length > 0));
              return (
                <div
                  key={tx.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs text-slate-500">{tx.dateLabel}</span>
                        <span className="text-[13px] font-semibold text-slate-800">{tx.typeLabel}</span>
                      </div>
                      {tx.actor_nickname && tx.type === 'parent_deposit' && (
                        <div className="mb-1 text-xs text-slate-500">
                          {tx.actor_nickname}{pt('deposited_by_suffix')}
                        </div>
                      )}
                      {tx.memo && (
                        <div className="text-xs text-slate-400">{tx.memo}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          pendingAttachmentUploadRef.current = { entityType: 'piggy_bank_tx', entityId: tx.id };
                          receiptFileInputRef.current?.click();
                        }}
                        className="mt-1.5 cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        영수증 첨부
                      </button>
                    </div>
                    <div
                      className={`text-base font-bold ${isNegative ? 'text-red-700' : 'text-green-600'}`}
                    >
                      {isNegative ? '-' : '+'}{formatPiggyAmount(tx.amount)}
                    </div>
                  </div>
                  {showReceiptSection && (
                    <div className="w-full border-t border-slate-100 pt-2">
                      {receipts.length > 0 && (
                        <div className="flex flex-wrap items-start gap-2">
                          {receipts.map((att) => (
                            <div key={att.id} className="relative h-[72px] w-[72px]">
                              <a href={att.image_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={att.thumbnail_url || att.image_url}
                                  alt={att.original_filename}
                                  className="block h-[72px] w-[72px] rounded-lg object-cover"
                                />
                              </a>
                              <button
                                type="button"
                                aria-label="삭제"
                                onClick={() => {
                                  if (!currentGroupId) return;
                                  void (async () => {
                                    try {
                                      await deleteAttachment(currentGroupId, att.id);
                                      const rows = await listAttachments({
                                        groupId: currentGroupId,
                                        entityType: 'piggy_bank_tx',
                                        entityIds: [tx.id],
                                      });
                                      setTxAttachmentsByKey((prev) => ({ ...prev, [receiptKey]: rows }));
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : '삭제 실패');
                                    }
                                  })();
                                }}
                                className="absolute right-1 top-1 h-5 w-5 cursor-pointer rounded-full border-none bg-[rgba(239,68,68,0.95)] p-0 text-xs leading-none text-white"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {receiptUploadingKey === receiptKey && attachmentJobs.length > 0 && (
                        <div className="mt-2 grid gap-1">
                          {attachmentJobs.map((job) => (
                            <div key={job.id} className="text-[11px] text-slate-500">
                              {job.fileName} · {job.status}
                              {job.status === 'uploading' ? ` ${Math.round(job.progress)}%` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                      {receiptUploadingKey === receiptKey && attachmentUploading && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-600">업로드 중…</span>
                          <button
                            type="button"
                            onClick={() => attachmentAbortRef.current?.abort()}
                            className="cursor-pointer rounded-lg border-none bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
          <h2 className="m-0 text-lg">{pt('piggy_name_title')}</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={piggyName}
              onChange={(e) => setPiggyName(e.target.value)}
              className="flex-1 rounded-[10px] border border-slate-200 p-2.5"
            />
            <button
              onClick={handleRename}
              className="rounded-[10px] border-none bg-red-500 px-4 py-2.5 font-semibold text-white"
            >
              {pt('rename_btn')}
            </button>
          </div>
        </div>
      )}

      {isAdmin ? (
        <>
          <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <h2 className="m-0 text-lg">{pt('allowance_grant_title')}</h2>
            <div className="mt-3 grid gap-2.5">
              <input
                type="number"
                value={allowanceAmount}
                onChange={(e) => setAllowanceAmount(e.target.value)}
                placeholder={pt('amount_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <input
                value={allowanceMemo}
                onChange={(e) => setAllowanceMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <button
                type="button"
                disabled={allowanceSubmitting}
                onClick={async () => {
                  if (allowanceSubmitting) return;
                  if (!selectedChildIdForAdmin) {
                    setError(pt('select_child_first'));
                    return;
                  }
                  setAllowanceSubmitting(true);
                  try {
                    await handleAction('/api/piggy-bank/allowance', {
                      childId: selectedChildIdForAdmin,
                      amount: allowanceAmount,
                      memo: allowanceMemo,
                    });
                    setAllowanceAmount('');
                    setAllowanceMemo('');
                  } catch (err: any) {
                    setError(err.message || pt('allowance_grant_failed'));
                  } finally {
                    setAllowanceSubmitting(false);
                  }
                }}
                className={`rounded-xl border-none p-3 font-bold text-white ${
                  allowanceSubmitting ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-blue-600'
                }`}
              >
                {allowanceSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('allowance_grant_btn')}
              </button>
            </div>
          </div>

          <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <h2 className="m-0 text-lg">{pt('parent_deposit_title')}</h2>
            <div className="mt-3 grid gap-2.5">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder={pt('amount_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <input
                value={depositMemo}
                onChange={(e) => setDepositMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <button
                type="button"
                disabled={depositSubmitting}
                onClick={async () => {
                  if (depositSubmitting) return;
                  if (!selectedChildIdForAdmin) {
                    setError(pt('select_child_first'));
                    return;
                  }
                  setDepositSubmitting(true);
                  try {
                    await handleAction('/api/piggy-bank/parent-deposit', {
                      childId: selectedChildIdForAdmin,
                      amount: depositAmount,
                      memo: depositMemo,
                    });
                    setDepositAmount('');
                    setDepositMemo('');
                  } catch (err: any) {
                    setError(err.message || pt('parent_deposit_failed'));
                  } finally {
                    setDepositSubmitting(false);
                  }
                }}
                className={`rounded-xl border-none p-3 font-bold text-white ${
                  depositSubmitting ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-red-500'
                }`}
              >
                {depositSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('parent_deposit_btn')}
              </button>
            </div>
          </div>

          <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <h2 className="m-0 text-lg">{pt('open_approve_title')}</h2>
            <div className="mt-3 grid max-h-[200px] gap-3 overflow-y-auto pr-1">
              {requests.length === 0 && <p className="text-slate-400">{pt('no_pending_requests')}</p>}
              {requests.map((req) => {
                const isInactive = req.status !== 'pending';
                return (
                  <div
                    key={req.id}
                    className={`rounded-xl border border-slate-200 p-3 ${
                      isInactive ? 'opacity-60 line-through' : ''
                    }`}
                  >
                    <div className="font-semibold">{resolveMemberName(req.child_id)}</div>
                    <div className="mt-1 text-slate-600">{formatPiggyAmount(req.amount)}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {req.destination === 'wallet' ? pt('to_wallet') : pt('to_cash')} · {req.reason || pt('reason_none')}
                    </div>
                    {isInactive && <div className="mt-1 text-xs text-slate-400">{req.status === 'approved' ? pt('status_approved') : req.status === 'rejected' ? pt('status_rejected') : req.status}</div>}
                    {!isInactive && (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await handleAction('/api/piggy-bank/open-approve', { requestId: req.id });
                            } catch (err: any) {
                              setError(err.message || pt('approve_failed'));
                            }
                          }}
                          className="flex-1 rounded-[10px] border-none bg-green-600 p-2.5 font-bold text-white"
                        >
                          {pt('approve_btn')}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await handleAction('/api/piggy-bank/open-reject', { requestId: req.id });
                            } catch (err: any) {
                              setError(err.message || pt('reject_failed'));
                            }
                          }}
                          className="flex-1 rounded-[10px] border-none bg-gray-400 p-2.5 font-bold text-white"
                        >
                          {pt('reject_btn')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <h2 className="m-0 text-lg">{pt('spend_title')}</h2>
            <div className="mt-3 grid gap-2.5">
              <input
                type="number"
                value={spendAmount}
                onChange={(e) => setSpendAmount(e.target.value)}
                placeholder={pt('amount_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <input
                value={spendCategory}
                onChange={(e) => setSpendCategory(e.target.value)}
                placeholder={pt('category_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <input
                value={spendMemo}
                onChange={(e) => setSpendMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <button
                type="button"
                disabled={spendSubmitting}
                onClick={async () => {
                  if (spendSubmitting) return;
                  setSpendSubmitting(true);
                  try {
                    await handleAction('/api/piggy-bank/spend', {
                      amount: spendAmount,
                      memo: spendMemo,
                      category: spendCategory,
                    });
                    setSpendAmount('');
                    setSpendCategory('');
                    setSpendMemo('');
                  } catch (err: any) {
                    setError(err.message || pt('spend_failed'));
                  } finally {
                    setSpendSubmitting(false);
                  }
                }}
                className={`rounded-xl border-none p-3 font-bold text-white ${
                  spendSubmitting ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-sky-500'
                }`}
              >
                {spendSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('spend_btn')}
              </button>
            </div>
          </div>

          <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <h2 className="m-0 text-lg">{pt('save_title')}</h2>
            <div className="mt-3 grid gap-2.5">
              <input
                type="number"
                value={saveAmount}
                onChange={(e) => setSaveAmount(e.target.value)}
                placeholder={pt('save_amount_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <input
                value={saveMemo}
                onChange={(e) => setSaveMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <button
                type="button"
                disabled={saveSubmitting}
                onClick={async () => {
                  if (saveSubmitting) return;
                  setSaveSubmitting(true);
                  try {
                    await handleAction('/api/piggy-bank/save', { amount: saveAmount, memo: saveMemo });
                    setSaveAmount('');
                    setSaveMemo('');
                  } catch (err: any) {
                    setError(err.message || pt('save_failed'));
                  } finally {
                    setSaveSubmitting(false);
                  }
                }}
                className={`rounded-xl border-none p-3 font-bold text-white ${
                  saveSubmitting ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-orange-500'
                }`}
              >
                {saveSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('save_btn')}
              </button>
            </div>
          </div>

          <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <h2 className="m-0 text-lg">{pt('open_request_title')}</h2>
            <div className="mt-3 grid gap-2.5">
              <input
                type="number"
                value={openAmount}
                onChange={(e) => setOpenAmount(e.target.value)}
                placeholder={pt('request_amount_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <select
                value={openDestination}
                onChange={(e) => setOpenDestination(e.target.value as 'wallet' | 'cash')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              >
                <option value="wallet">{pt('to_wallet')}</option>
                <option value="cash">{pt('to_cash')}</option>
              </select>
              <input
                value={openReason}
                onChange={(e) => setOpenReason(e.target.value)}
                placeholder={pt('reason_placeholder')}
                className="rounded-[10px] border border-slate-200 p-2.5"
              />
              <button
                type="button"
                disabled={openRequestSubmitting}
                onClick={async () => {
                  if (openRequestSubmitting) return;
                  setOpenRequestSubmitting(true);
                  try {
                    await handleAction('/api/piggy-bank/open-request', {
                      amount: openAmount,
                      reason: openReason,
                      destination: openDestination,
                    });
                    setOpenAmount('');
                    setOpenReason('');
                  } catch (err: any) {
                    setError(err.message || pt('open_request_failed'));
                  } finally {
                    setOpenRequestSubmitting(false);
                  }
                }}
                className={`rounded-xl border-none p-3 font-bold text-white ${
                  openRequestSubmitting ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-violet-600'
                }`}
              >
                {openRequestSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('open_request_btn')}
              </button>
            </div>

            <div className="mt-4 grid gap-2.5">
              {requests.length === 0 && <p className="text-slate-400">{pt('no_requests')}</p>}
              {requests.map((req) => {
                const isInactive = req.status !== 'pending';
                return (
                  <div
                    key={req.id}
                    className={`rounded-xl border border-slate-200 p-3 ${
                      isInactive ? 'opacity-60 line-through' : ''
                    }`}
                  >
                    <div className="font-semibold">{formatPiggyAmount(req.amount)}</div>
                    <div className="text-xs text-slate-400">
                      {req.destination === 'wallet' ? pt('to_wallet') : pt('to_cash')} · {req.status === 'approved' ? pt('status_approved') : req.status === 'rejected' ? pt('status_rejected') : req.status}
                    </div>
                    <div className="text-xs text-slate-400">{req.reason || pt('reason_none')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => router.push('/dashboard')}
        className="rounded-xl border-none bg-slate-200 px-4 py-3 font-semibold text-slate-700"
      >
        {pt('back_to_dashboard')}
      </button>
    </div>
  );
}
