'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';

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

const formatAmount = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export default function PiggyBankPage() {
  const router = useRouter();
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
  const [selectedChild, setSelectedChild] = useState('');
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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error('인증이 필요합니다.');
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
      throw new Error(result.error || '요약 정보를 불러오지 못했습니다.');
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
      throw new Error(result.error || '아이 목록을 불러오지 못했습니다.');
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
      throw new Error(result.error || '요청 목록을 불러오지 못했습니다.');
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
      throw new Error(result.error || '거래 내역을 불러오지 못했습니다.');
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
      .catch((err) => setError(err.message || '데이터 로드 오류'))
      .finally(() => setLoading(false));
  }, [currentGroupId, isAdmin, selectedChildIdForAdmin]);

  /** 실시간 반영: 동일 그룹 저금통 변경 구독 */
  useEffect(() => {
    if (!currentGroupId) return;

    const groupId = currentGroupId;
    const channel = supabase
      .channel(`piggy_bank_${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_bank_accounts', filter: `group_id=eq.${groupId}` },
        () => {
          fetchSummary();
          fetchTransactions();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_wallets', filter: `group_id=eq.${groupId}` },
        () => {
          fetchSummary();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_open_requests', filter: `group_id=eq.${groupId}` },
        () => {
          fetchSummary();
          fetchRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_wallet_transactions', filter: `group_id=eq.${groupId}` },
        () => {
          fetchTransactions();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_bank_transactions', filter: `group_id=eq.${groupId}` },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
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
      throw new Error(result.error || '요청 처리에 실패했습니다.');
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
      throw new Error(result.error || '이름 변경에 실패했습니다.');
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
      throw new Error(result.error || '저금통 추가에 실패했습니다.');
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
      if (!response.ok) throw new Error(result.error || '요청에 실패했습니다.');
      alert(result.message || '요청이 전달되었습니다.');
    } catch (err: any) {
      setError(err.message || '요청에 실패했습니다.');
    }
  };

  const handleDeletePiggy = async (childId: string) => {
    if (!currentGroupId || !confirm('이 사용자의 저금통을 삭제하시겠습니까? 잔액 데이터가 삭제됩니다.')) return;
    try {
      const headers = await getAuthHeader();
      const response = await fetch(
        `/api/piggy-bank/accounts?groupId=${encodeURIComponent(currentGroupId)}&childId=${encodeURIComponent(childId)}`,
        { method: 'DELETE', headers }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '삭제에 실패했습니다.');
      setSelectedChildIdForAdmin('');
      await Promise.all([fetchSummary(), fetchMembers(), fetchTransactions()]);
    } catch (err: any) {
      setError(err.message || '삭제에 실패했습니다.');
    }
  };

  const resolveMemberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    if (!member) return '아이';
    return member.nickname || '아이';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b' }}>불러오는 중...</span>
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
            <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>Piggy Bank 관리</h1>
            <p style={{ margin: '4px 0 0', color: '#64748b' }}>{currentGroup?.name || '그룹'} · 아이별 저금통</p>
          </div>
        </div>
        {error && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', color: '#991b1b', marginBottom: '16px' }}>
            {error}
          </div>
        )}
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>아이 선택</h2>
          <p style={{ margin: '8px 0 12px', color: '#64748b', fontSize: '14px' }}>저금통을 볼 아이를 선택하세요.</p>
          <select
            value={selectedChildIdForAdmin}
            onChange={(e) => setSelectedChildIdForAdmin(e.target.value)}
            style={{ width: '100%', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}
          >
            <option value="">선택하세요</option>
            {accountsForSelect.map((acc) => (
              <option key={acc.id} value={acc.user_id || ''}>
                {acc.ownerNickname || '저금통'} · 용돈 {formatAmount(acc.walletBalance ?? 0)} / 저금통 {formatAmount(acc.balance)}
              </option>
            ))}
          </select>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>아이를 선택하면 해당 저금통 화면으로 이동합니다.</p>
        </div>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>저금통 추가</h2>
          <p style={{ margin: '8px 0 12px', color: '#64748b', fontSize: '14px' }}>아이를 위해 실물 저금통을 준비한 뒤, 아래에서 저금통을 만들어 주세요.</p>
          {membersWithoutPiggy.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>저금통이 없는 아이가 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {membersWithoutPiggy.map((p) => (
                <button
                  key={p.user_id}
                  onClick={async () => {
                    try {
                      await handleAddPiggyForChild(p.user_id);
                    } catch (err: any) {
                      setError(err.message || '저금통 추가 실패');
                    }
                  }}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, textAlign: 'left' }}
                >
                  + {p.ownerNickname || '아이'} 저금통 만들기
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>저금통 개봉요청</h2>
          <div style={{ marginTop: '12px' }}>
            {(() => {
              const pendingRequests = requests.filter((req) => req.status === 'pending');
              if (pendingRequests.length === 0) {
                return <p style={{ color: '#94a3b8' }}>대기 중인 개봉요청이 없습니다.</p>;
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
                    대기 중인 개봉요청 {total}건
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#78350f' }}>
                    {Object.entries(byChild).map(([childId, count]) => (
                      <li key={childId} style={{ marginBottom: '4px' }}>
                        {resolveMemberName(childId)} {count}건
                      </li>
                    ))}
                  </ul>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#78350f' }}>
                    아이를 선택하면 해당 아이의 개봉요청을 승인할 수 있습니다.
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '12px 16px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}>돌아가기</button>
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
              저금통 승인 대기중
            </p>
          ) : (
            <p style={{ fontSize: '16px', color: '#475569', textAlign: 'center', margin: 0 }}>
              저금통이 없습니다. 관리자에게 요청하세요.
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
              저금통 요청
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}>대시보드로</button>
        </div>
      );
    }
    if (summary !== null && summary.account == null && isAdmin && selectedChildIdForAdmin) {
      const childName = members.find((m) => m.user_id === selectedChildIdForAdmin)?.nickname || '아이';
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <img src="/piggy/ellena-piggy-red.svg" alt="Ellena Piggy" style={{ width: '90px', height: '90px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>Piggy Bank 관리</h1>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>{childName} · 저금통 없음</p>
            </div>
          </div>
          {error && (
            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', color: '#991b1b', marginBottom: '16px' }}>{error}</div>
          )}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <p style={{ fontSize: '15px', color: '#475569', marginBottom: '16px' }}>이 아이는 저금통을 소유하지 않았습니다. 아래 버튼으로 저금통을 추가하세요.</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await handleAddPiggyForChild(selectedChildIdForAdmin);
                } catch (err: any) {
                  setError(err.message || '저금통 추가 실패');
                }
              }}
              style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              저금통 추가
            </button>
          </div>
          <button onClick={() => router.push('/piggy-bank')} style={{ padding: '12px 16px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}>전체 목록으로</button>
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b' }}>불러오는 중...</span>
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
              <option value="">전체 목록으로</option>
              {members.filter((m) => m.role === 'MEMBER').map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.nickname || '아이'}</option>
              ))}
            </select>
          )}
          <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>{summary!.account!.ownerNickname || summary!.account!.name}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>
            {currentGroup?.name || '그룹'} {isAdmin && selectedChildIdForAdmin ? `· ${resolveMemberName(selectedChildIdForAdmin)} 저금통` : '저금통'}
          </p>
          {isAdmin && selectedChildIdForAdmin && (
            <button
              type="button"
              onClick={() => handleDeletePiggy(selectedChildIdForAdmin)}
              style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              저금통 삭제
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
          <div style={{ fontSize: '13px', color: '#1d4ed8' }}>내 용돈 잔액</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>
            {formatAmount(summary?.wallet?.balance ?? 0)}
          </div>
        </div>
        <div style={{ background: '#fff7ed', borderRadius: '14px', padding: '16px', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: '13px', color: '#9a3412' }}>저금통 잔액</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#9a3412' }}>
            {formatAmount(summary?.account?.balance ?? 0)}
          </div>
        </div>
      </div>

      {/* 용돈 거래 내역 */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
        <h2 style={{ margin: 0, fontSize: '18px', marginBottom: '12px' }}>용돈 내역</h2>
        {walletTransactions.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>용돈 거래 내역이 없습니다.</p>
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
                        {tx.actor_nickname}가 지급
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
        <h2 style={{ margin: 0, fontSize: '18px', marginBottom: '12px' }}>저금통 내역</h2>
        {bankTransactions.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>저금통 거래 내역이 없습니다.</p>
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
                        {tx.actor_nickname}가 입금
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
          <h2 style={{ margin: 0, fontSize: '18px' }}>저금통 이름</h2>
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
              변경
            </button>
          </div>
        </div>
      )}

      {isAdmin ? (
        <>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>용돈 지급</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              >
                <option value="">지급 대상 선택</option>
                {members.filter((m) => m.role === 'MEMBER').map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.nickname || '아이'}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={allowanceAmount}
                onChange={(e) => setAllowanceAmount(e.target.value)}
                placeholder="금액"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={allowanceMemo}
                onChange={(e) => setAllowanceMemo(e.target.value)}
                placeholder="메모 (선택)"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <button
                onClick={async () => {
                  try {
                    await handleAction('/api/piggy-bank/allowance', {
                      childId: selectedChild,
                      amount: allowanceAmount,
                      memo: allowanceMemo,
                    });
                    setAllowanceAmount('');
                    setAllowanceMemo('');
                  } catch (err: any) {
                    setError(err.message || '용돈 지급 실패');
                  }
                }}
                style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700 }}
              >
                용돈 지급
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>저금통 입금 (용돈과 별개)</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="금액"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={depositMemo}
                onChange={(e) => setDepositMemo(e.target.value)}
                placeholder="메모 (선택)"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <button
                onClick={async () => {
                  if (!selectedChildIdForAdmin) {
                    setError('아이를 먼저 선택해 주세요.');
                    return;
                  }
                  try {
                    await handleAction('/api/piggy-bank/parent-deposit', {
                      childId: selectedChildIdForAdmin,
                      amount: depositAmount,
                      memo: depositMemo,
                    });
                    setDepositAmount('');
                    setDepositMemo('');
                  } catch (err: any) {
                    setError(err.message || '저금통 입금 실패');
                  }
                }}
                style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700 }}
              >
                저축 입금
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>저금통 개봉요청 승인</h2>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '12px', marginTop: '12px', paddingRight: '4px' }}>
              {requests.length === 0 && <p style={{ color: '#94a3b8' }}>대기 중인 요청이 없습니다.</p>}
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
                      {req.destination === 'wallet' ? '용돈으로 적립' : '현금 인출'} · {req.reason || '사유 없음'}
                    </div>
                    {isInactive && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{req.status === 'approved' ? '승인됨' : req.status === 'rejected' ? '거절됨' : req.status}</div>}
                    {!isInactive && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button
                          onClick={async () => {
                            try {
                              await handleAction('/api/piggy-bank/open-approve', { requestId: req.id });
                            } catch (err: any) {
                              setError(err.message || '승인 실패');
                            }
                          }}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700 }}
                        >
                          승인
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await handleAction('/api/piggy-bank/open-reject', { requestId: req.id });
                            } catch (err: any) {
                              setError(err.message || '거절 실패');
                            }
                          }}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#9ca3af', color: '#fff', fontWeight: 700 }}
                        >
                          거절
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
            <h2 style={{ margin: 0, fontSize: '18px' }}>지출 기록</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={spendAmount}
                onChange={(e) => setSpendAmount(e.target.value)}
                placeholder="금액"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={spendCategory}
                onChange={(e) => setSpendCategory(e.target.value)}
                placeholder="카테고리 (예: 문구, 간식)"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={spendMemo}
                onChange={(e) => setSpendMemo(e.target.value)}
                placeholder="메모 (선택)"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <button
                onClick={async () => {
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
                    setError(err.message || '지출 기록 실패');
                  }
                }}
                style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#0ea5e9', color: '#fff', fontWeight: 700 }}
              >
                지출 기록
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>저금통 저축하기</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={saveAmount}
                onChange={(e) => setSaveAmount(e.target.value)}
                placeholder="저금통 저축 금액"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <input
                value={saveMemo}
                onChange={(e) => setSaveMemo(e.target.value)}
                placeholder="메모 (선택)"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <button
                onClick={async () => {
                  try {
                    await handleAction('/api/piggy-bank/save', { amount: saveAmount, memo: saveMemo });
                    setSaveAmount('');
                    setSaveMemo('');
                  } catch (err: any) {
                    setError(err.message || '저금통 저축 실패');
                  }
                }}
                style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#f97316', color: '#fff', fontWeight: 700 }}
              >
                저금통에 저축
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>저금통 개봉 요청</h2>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input
                type="number"
                value={openAmount}
                onChange={(e) => setOpenAmount(e.target.value)}
                placeholder="요청 금액"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <select
                value={openDestination}
                onChange={(e) => setOpenDestination(e.target.value as 'wallet' | 'cash')}
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              >
                <option value="wallet">용돈으로 적립</option>
                <option value="cash">현금 인출</option>
              </select>
              <input
                value={openReason}
                onChange={(e) => setOpenReason(e.target.value)}
                placeholder="사유 (선택)"
                style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '10px' }}
              />
              <button
                onClick={async () => {
                  try {
                    await handleAction('/api/piggy-bank/open-request', {
                      amount: openAmount,
                      reason: openReason,
                      destination: openDestination,
                    });
                    setOpenAmount('');
                    setOpenReason('');
                  } catch (err: any) {
                    setError(err.message || '요청 실패');
                  }
                }}
                style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700 }}
              >
                개봉 요청
              </button>
            </div>

            <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
              {requests.length === 0 && <p style={{ color: '#94a3b8' }}>요청 내역이 없습니다.</p>}
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
                      {req.destination === 'wallet' ? '용돈 적립' : '현금 인출'} · {req.status === 'approved' ? '승인됨' : req.status === 'rejected' ? '거절됨' : req.status}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{req.reason || '사유 없음'}</div>
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
        돌아가기
      </button>
    </div>
  );
}
