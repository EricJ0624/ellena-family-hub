'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getPiggyTranslation } from '@/lib/translations/piggy';

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

const LOCALE_MAP: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW' };

export default function PiggyBankPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const pt = (key: keyof import('@/lib/translations/piggy').PiggyTranslations) => getPiggyTranslation(lang, key);
  const formatAmount = (value: number) => `${value.toLocaleString(LOCALE_MAP[lang] || 'en-US')}${lang === 'ko' ? '원' : lang === 'ja' ? '円' : lang === 'zh-CN' || lang === 'zh-TW' ? '元' : ''}`;
  let currentGroupId: string | null = null;
  let currentGroup: { name?: string | null } | null = null;
  let userRole: 'ADMIN' | 'MEMBER' | null = null;
  let isOwner = false;
  try {
    const groupContext = useGroup();
    currentGroupId = groupContext.currentGroupId;
    currentGroup = groupContext.currentGroup;
    userRole = groupContext.userRole;
    isOwner = groupContext.isOwner;
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

  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b' }}>{pt('loading')}</span>
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
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <img src="/piggy/ellena-piggy-red.svg" alt="Ellena Piggy" style={{ width: '90px', height: '90px' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>{pt('management_title')}</h1>
            <p style={{ margin: '4px 0 0', color: '#64748b' }}>{currentGroup?.name || pt('group_label')} · {pt('piggy_per_child')}</p>
          </div>
        </div>
        {error && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', color: '#991b1b', marginBottom: '16px' }}>
            {error}
          </div>
        )}
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('select_child_title')}</h2>
          <p style={{ margin: '8px 0 12px', color: '#64748b', fontSize: '14px' }}>{pt('select_child_hint')}</p>
          <select
            value={selectedChildIdForAdmin}
            onChange={(e) => setSelectedChildIdForAdmin(e.target.value)}
            style={{ width: '100%', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}
          >
            <option value="">{pt('select_placeholder')}</option>
            {accountsForSelect.map((acc) => (
              <option key={acc.id} value={acc.user_id || ''}>
                {acc.ownerNickname || pt('piggy_label')} · {pt('allowance_label')} {formatAmount(acc.walletBalance ?? 0)} / {pt('piggy_label')} {formatAmount(acc.balance)}
              </option>
            ))}
          </select>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>{pt('select_child_hint2')}</p>
        </div>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('add_piggy_title')}</h2>
          <p style={{ margin: '8px 0 12px', color: '#64748b', fontSize: '14px' }}>{pt('add_piggy_hint')}</p>
          {membersWithoutPiggy.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>{pt('no_child_without_piggy')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, textAlign: 'left' }}
                >
                  + {p.ownerNickname || pt('child_label')} {pt('create_piggy_btn')}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('open_requests_title')}</h2>
          <div style={{ marginTop: '12px' }}>
            {(() => {
              const pendingRequests = requests.filter((req) => req.status === 'pending');
              if (pendingRequests.length === 0) {
                return <p style={{ color: '#94a3b8' }}>{pt('no_pending_open_requests')}</p>;
              }
              const byChild = pendingRequests.reduce<Record<string, number>>((acc, req) => {
                const id = req.child_id || '';
                acc[id] = (acc[id] || 0) + 1;
                return acc;
              }, {});
              const total = pendingRequests.length;
              return (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    color: '#92400e',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                    {pt('pending_open_requests_count')} {total}{pt('count_suffix')}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#78350f' }}>
                    {Object.entries(byChild).map(([childId, count]) => (
                      <li key={childId} style={{ marginBottom: '4px' }}>
                        {resolveMemberName(childId)} {count}{pt('count_suffix')}
                      </li>
                    ))}
                  </ul>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#78350f' }}>
                    {pt('select_child_to_approve')}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '12px 16px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}>{pt('back_to_dashboard')}</button>
      </div>
    );
  }

  if (!hasAccountView) {
    if (summary !== null && summary.account == null && !isAdmin) {
      const pendingRequest = summary.pendingAccountRequest === true;
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <img src="/piggy/ellena-piggy-red.svg" alt="Ellena Piggy" style={{ width: '80px', height: '80px' }} />
          {pendingRequest ? (
            <p style={{ fontSize: '16px', color: '#92400e', textAlign: 'center', margin: 0, fontWeight: 600 }}>
              {pt('approval_pending')}
            </p>
          ) : (
            <p style={{ fontSize: '16px', color: '#475569', textAlign: 'center', margin: 0 }}>
              {pt('no_piggy_ask_admin')}
            </p>
          )}
          {!pendingRequest && (
            <button
              type="button"
              onClick={handleRequestAccount}
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                border: '1px solid #94a3b8',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {pt('request_piggy_btn')}
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}>{pt('go_dashboard')}</button>
        </div>
      );
    }
    if (summary !== null && summary.account == null && isAdmin && selectedChildIdForAdmin) {
      const childName = members.find((m) => m.user_id === selectedChildIdForAdmin)?.nickname || pt('child_label');
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <img src="/piggy/ellena-piggy-red.svg" alt="Ellena Piggy" style={{ width: '90px', height: '90px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>{pt('management_title')}</h1>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>{childName} · {pt('no_piggy')}</p>
            </div>
          </div>
          {error && (
            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', color: '#991b1b', marginBottom: '16px' }}>{error}</div>
          )}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <p style={{ fontSize: '15px', color: '#475569', marginBottom: '16px' }}>{pt('this_child_has_no_piggy')}</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await handleAddPiggyForChild(selectedChildIdForAdmin);
                } catch (err: any) {
                  setError(err.message || pt('add_piggy_failed_short'));
                }
              }}
              style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              {pt('add_piggy_btn')}
            </button>
          </div>
          <button onClick={() => router.push('/piggy-bank')} style={{ padding: '12px 16px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}>{pt('full_list')}</button>
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b' }}>{pt('loading')}</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <img
          src="/piggy/ellena-piggy-red.svg"
          alt="Ellena Piggy"
          style={{ width: '90px', height: '90px' }}
        />
        <div style={{ flex: 1 }}>
          {isAdmin && (
            <select
              value={selectedChildIdForAdmin}
              onChange={(e) => setSelectedChildIdForAdmin(e.target.value)}
              style={{ display: 'block', marginBottom: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '8px 12px', fontSize: '14px' }}
            >
              <option value="">{pt('full_list')}</option>
              {members.filter((m) => m.role === 'MEMBER').map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.nickname || pt('child_label')}</option>
              ))}
            </select>
          )}
          <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>{summary!.account!.ownerNickname || summary!.account!.name}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>
            {currentGroup?.name || pt('group_label')} {isAdmin && selectedChildIdForAdmin ? `· ${resolveMemberName(selectedChildIdForAdmin)} ${pt('piggy_label')}` : pt('piggy_label')}
          </p>
          {isAdmin && selectedChildIdForAdmin && (
            <button
              type="button"
              onClick={() => handleDeletePiggy(selectedChildIdForAdmin)}
              style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              {pt('delete_piggy_btn')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', color: '#991b1b', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#eff6ff', borderRadius: '14px', padding: '16px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '13px', color: '#1d4ed8' }}>{pt('wallet_balance')}</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>
            {formatAmount(summary?.wallet?.balance ?? 0)}
          </div>
        </div>
        <div style={{ background: '#fff7ed', borderRadius: '14px', padding: '16px', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: '13px', color: '#9a3412' }}>{pt('piggy_balance')}</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#9a3412' }}>
            {formatAmount(summary?.account?.balance ?? 0)}
          </div>
        </div>
      </div>

      {/* 용돈 거래 내역 */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
        <h2 style={{ margin: 0, fontSize: '18px', marginBottom: '12px' }}>{pt('allowance_history')}</h2>
        {walletTransactions.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>{pt('no_allowance_tx')}</p>
        ) : (
          <div style={{ maxHeight: '330px', overflowY: 'auto', display: 'grid', gap: '8px', paddingRight: '4px' }}>
            {walletTransactions.map((tx) => {
              const isNegative = tx.type === 'spend' || tx.type === 'child_save';
              return (
                <div
                  key={tx.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{tx.dateLabel}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{tx.typeLabel}</span>
                    </div>
                    {tx.actor_nickname && tx.type === 'allowance' && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        {tx.actor_nickname}{pt('paid_by_suffix')}
                      </div>
                    )}
                    {tx.memo && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{tx.memo}</div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: isNegative ? '#b91c1c' : '#16a34a',
                    }}
                  >
                    {isNegative ? '-' : '+'}{formatAmount(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 저금통 거래 내역 */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
        <h2 style={{ margin: 0, fontSize: '18px', marginBottom: '12px' }}>{pt('piggy_history')}</h2>
        {bankTransactions.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>{pt('no_piggy_tx')}</p>
        ) : (
          <div style={{ maxHeight: '330px', overflowY: 'auto', display: 'grid', gap: '8px', paddingRight: '4px' }}>
            {bankTransactions.map((tx) => {
              const isNegative = tx.type === 'withdraw_cash' || tx.type === 'withdraw_to_wallet';
              return (
                <div
                  key={tx.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{tx.dateLabel}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{tx.typeLabel}</span>
                    </div>
                    {tx.actor_nickname && tx.type === 'parent_deposit' && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        {tx.actor_nickname}{pt('deposited_by_suffix')}
                      </div>
                    )}
                    {tx.memo && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{tx.memo}</div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: isNegative ? '#b91c1c' : '#16a34a',
                    }}
                  >
                    {isNegative ? '-' : '+'}{formatAmount(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('piggy_name_title')}</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input
              value={piggyName}
              onChange={(e) => setPiggyName(e.target.value)}
              style={{ flex: 1, borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
            />
            <button
              onClick={handleRename}
              style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600 }}
            >
              {pt('rename_btn')}
            </button>
          </div>
        </div>
      )}

      {isAdmin ? (
        <>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('allowance_grant_title')}</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={allowanceAmount}
                onChange={(e) => setAllowanceAmount(e.target.value)}
                placeholder={pt('amount_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={allowanceMemo}
                onChange={(e) => setAllowanceMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
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
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: allowanceSubmitting ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: allowanceSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {allowanceSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('allowance_grant_btn')}
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('parent_deposit_title')}</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder={pt('amount_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={depositMemo}
                onChange={(e) => setDepositMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
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
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: depositSubmitting ? '#94a3b8' : '#ef4444',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: depositSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {depositSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('parent_deposit_btn')}
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('open_approve_title')}</h2>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '12px', marginTop: '12px', paddingRight: '4px' }}>
              {requests.length === 0 && <p style={{ color: '#94a3b8' }}>{pt('no_pending_requests')}</p>}
              {requests.map((req) => {
                const isInactive = req.status !== 'pending';
                return (
                  <div
                    key={req.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px',
                      opacity: isInactive ? 0.6 : 1,
                      textDecoration: isInactive ? 'line-through' : undefined,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{resolveMemberName(req.child_id)}</div>
                    <div style={{ color: '#475569', marginTop: '4px' }}>{formatAmount(req.amount)}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                      {req.destination === 'wallet' ? pt('to_wallet') : pt('to_cash')} · {req.reason || pt('reason_none')}
                    </div>
                    {isInactive && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{req.status === 'approved' ? pt('status_approved') : req.status === 'rejected' ? pt('status_rejected') : req.status}</div>}
                    {!isInactive && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button
                          onClick={async () => {
                            try {
                              await handleAction('/api/piggy-bank/open-approve', { requestId: req.id });
                            } catch (err: any) {
                              setError(err.message || pt('approve_failed'));
                            }
                          }}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700 }}
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
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#9ca3af', color: '#fff', fontWeight: 700 }}
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
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('spend_title')}</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={spendAmount}
                onChange={(e) => setSpendAmount(e.target.value)}
                placeholder={pt('amount_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={spendCategory}
                onChange={(e) => setSpendCategory(e.target.value)}
                placeholder={pt('category_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={spendMemo}
                onChange={(e) => setSpendMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
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
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: spendSubmitting ? '#94a3b8' : '#0ea5e9',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: spendSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {spendSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('spend_btn')}
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('save_title')}</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={saveAmount}
                onChange={(e) => setSaveAmount(e.target.value)}
                placeholder={pt('save_amount_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={saveMemo}
                onChange={(e) => setSaveMemo(e.target.value)}
                placeholder={pt('memo_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
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
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: saveSubmitting ? '#94a3b8' : '#f97316',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: saveSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {saveSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('save_btn')}
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{pt('open_request_title')}</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={openAmount}
                onChange={(e) => setOpenAmount(e.target.value)}
                placeholder={pt('request_amount_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <select
                value={openDestination}
                onChange={(e) => setOpenDestination(e.target.value as 'wallet' | 'cash')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              >
                <option value="wallet">{pt('to_wallet')}</option>
                <option value="cash">{pt('to_cash')}</option>
              </select>
              <input
                value={openReason}
                onChange={(e) => setOpenReason(e.target.value)}
                placeholder={pt('reason_placeholder')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
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
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: openRequestSubmitting ? '#94a3b8' : '#7c3aed',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: openRequestSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {openRequestSubmitting ? (lang === 'ko' ? '처리 중…' : 'Processing…') : pt('open_request_btn')}
              </button>
            </div>

            <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
              {requests.length === 0 && <p style={{ color: '#94a3b8' }}>{pt('no_requests')}</p>}
              {requests.map((req) => {
                const isInactive = req.status !== 'pending';
                return (
                  <div
                    key={req.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px',
                      opacity: isInactive ? 0.6 : 1,
                      textDecoration: isInactive ? 'line-through' : undefined,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{formatAmount(req.amount)}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {req.destination === 'wallet' ? pt('to_wallet') : pt('to_cash')} · {req.status === 'approved' ? pt('status_approved') : req.status === 'rejected' ? pt('status_rejected') : req.status}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{req.reason || pt('reason_none')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => router.push('/dashboard')}
        style={{ padding: '12px 16px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}
      >
        {pt('back_to_dashboard')}
      </button>
    </div>
  );
}
