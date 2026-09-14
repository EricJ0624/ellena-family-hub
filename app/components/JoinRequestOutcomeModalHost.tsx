'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import {
  JOIN_REQUEST_PENDING_EVENT,
  type JoinRequestPendingDetail,
} from '@/lib/notifications/join-request-events';
import { parseJoinResolvedStatus } from '@/lib/notifications/join-request-client';

type Outcome = {
  requestId: string;
  groupId: string;
  groupName: string | null;
  status: 'approved' | 'rejected';
  notificationId?: string | null;
};

function ackKey(requestId: string) {
  return `join-outcome-acked:${requestId}`;
}

function isAcked(requestId: string) {
  try {
    return sessionStorage.getItem(ackKey(requestId)) === '1';
  } catch {
    return false;
  }
}

function markAcked(requestId: string) {
  try {
    sessionStorage.setItem(ackKey(requestId), '1');
  } catch {
    // ignore
  }
}

function copy(lang: string) {
  if (lang === 'ko') {
    return {
      approvedTitle: '가입이 승인되었습니다',
      approvedBody: '그룹에 가입되었습니다. 확인을 누르면 대시보드로 이동합니다.',
      rejectedTitle: '가입이 거절되었습니다',
      rejectedBody: '그룹 가입 요청이 거절되었습니다.',
      confirm: '확인',
      waitingHint: '관리자 승인 대기 중…',
    };
  }
  return {
    approvedTitle: 'Join approved',
    approvedBody: 'You have joined the group. Tap OK to open the dashboard.',
    rejectedTitle: 'Join rejected',
    rejectedBody: 'Your join request was rejected.',
    confirm: 'OK',
    waitingHint: 'Waiting for admin approval…',
  };
}

type Props = {
  userId: string | null;
};

/** 가입 요청자용: 승인/거절 결과 팝업 */
export default function JoinRequestOutcomeModalHost({ userId }: Props) {
  const { lang } = useLanguage();
  const t = copy(lang);
  const router = useRouter();
  const pathname = usePathname();
  const { setCurrentGroupId, refreshGroups } = useGroup();

  const [mounted, setMounted] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const outcomeRef = useRef<Outcome | null>(null);

  useEffect(() => {
    outcomeRef.current = outcome;
  }, [outcome]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    tokenRef.current = session?.access_token ?? null;
    return tokenRef.current;
  }, []);

  const showOutcome = useCallback((next: Outcome) => {
    if (isAcked(next.requestId)) return;
    setWaiting(false);
    setOutcome((prev) => {
      if (prev?.requestId === next.requestId && prev.status === next.status) return prev;
      return next;
    });
  }, []);

  const refreshMine = useCallback(async () => {
    if (!userId) return;
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/group/join-requests/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const data = json.data || {};

      const pending = Array.isArray(data.pending) ? data.pending : [];
      if (!outcomeRef.current) {
        setWaiting(pending.length > 0);
      }

      const unread = Array.isArray(data.unreadResolvedNotifications)
        ? data.unreadResolvedNotifications
        : [];
      for (const n of unread) {
        const status = parseJoinResolvedStatus(n.payload);
        const requestId =
          (typeof n.entity_id === 'string' && n.entity_id) ||
          (typeof n.payload?.requestId === 'string' && n.payload.requestId) ||
          '';
        if (!status || !requestId || typeof n.group_id !== 'string') continue;
        showOutcome({
          requestId,
          groupId: n.group_id,
          groupName: typeof n.group_name === 'string' ? n.group_name : null,
          status,
          notificationId: typeof n.id === 'string' ? n.id : null,
        });
        return;
      }

      const recent = Array.isArray(data.recentResolved) ? data.recentResolved : [];
      for (const row of recent) {
        if (row.status !== 'approved' && row.status !== 'rejected') continue;
        if (typeof row.id !== 'string' || typeof row.group_id !== 'string') continue;
        if (isAcked(row.id)) continue;
        const resolvedAt = row.resolved_at ? Date.parse(row.resolved_at) : 0;
        if (resolvedAt && Date.now() - resolvedAt < 2 * 60 * 60 * 1000) {
          showOutcome({
            requestId: row.id,
            groupId: row.group_id,
            groupName: typeof row.group_name === 'string' ? row.group_name : null,
            status: row.status,
            notificationId: null,
          });
          break;
        }
      }
    } catch (err) {
      console.warn('join outcome refresh:', err);
    }
  }, [userId, getToken, showOutcome]);

  useEffect(() => {
    tokenRef.current = null;
    setOutcome(null);
    setWaiting(false);
    if (userId) void refreshMine();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps -- remount on user change only

  useEffect(() => {
    if (!userId) return;
    const onPending = (event: Event) => {
      const detail = (event as CustomEvent<JoinRequestPendingDetail>).detail;
      if (!detail?.requestId) return;
      setWaiting(true);
    };
    window.addEventListener(JOIN_REQUEST_PENDING_EVENT, onPending);
    return () => window.removeEventListener(JOIN_REQUEST_PENDING_EVENT, onPending);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`join_outcome_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_join_requests',
          filter: `requester_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new || {}) as {
            id?: string;
            group_id?: string;
            status?: string;
          };
          if (!row.id || !row.group_id) return;
          if (row.status === 'pending') {
            setWaiting(true);
            return;
          }
          if (row.status === 'approved' || row.status === 'rejected') {
            showOutcome({
              requestId: row.id,
              groupId: row.group_id,
              groupName: null,
              status: row.status,
              notificationId: null,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as {
            id?: string;
            event_type?: string;
            group_id?: string;
            entity_id?: string | null;
            payload?: { status?: string; requestId?: string };
          };
          if (n.event_type !== 'GROUP_JOIN_RESOLVED' || !n.group_id) return;
          const status = parseJoinResolvedStatus(n.payload);
          const requestId =
            (typeof n.entity_id === 'string' && n.entity_id) ||
            (typeof n.payload?.requestId === 'string' && n.payload.requestId) ||
            '';
          if (!status || !requestId) return;
          showOutcome({
            requestId,
            groupId: n.group_id,
            groupName: null,
            status,
            notificationId: typeof n.id === 'string' ? n.id : null,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, showOutcome]);

  const confirm = async () => {
    if (!outcome || confirming) return;
    setConfirming(true);
    try {
      const token = await getToken();
      markAcked(outcome.requestId);

      if (token && outcome.notificationId) {
        void fetch('/api/notifications', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId: outcome.groupId,
            ids: [outcome.notificationId],
          }),
        });
      } else if (token) {
        void fetch('/api/notifications', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId: outcome.groupId,
            entityIds: [outcome.requestId],
            eventType: 'GROUP_JOIN_RESOLVED',
          }),
        });
      }

      if (outcome.status === 'approved') {
        try {
          await refreshGroups();
        } catch {
          // ignore
        }
        setCurrentGroupId(outcome.groupId);
        setOutcome(null);
        if (pathname !== '/dashboard') {
          router.push('/dashboard');
        }
      } else {
        setOutcome(null);
      }
    } finally {
      setConfirming(false);
    }
  };

  if (!mounted || !userId) return null;

  if (outcome) {
    const approved = outcome.status === 'approved';
    return createPortal(
      <div className="fixed inset-0 z-[1210] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40" aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-outcome-title"
          className="relative z-[1211] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        >
          <div className="mb-3 flex items-center gap-2">
            {approved ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="h-6 w-6 text-rose-600" aria-hidden />
            )}
            <h2 id="join-outcome-title" className="m-0 text-base font-bold text-slate-900">
              {approved ? t.approvedTitle : t.rejectedTitle}
            </h2>
          </div>
          {outcome.groupName ? (
            <p className="m-0 mb-2 text-sm font-medium text-slate-700">{outcome.groupName}</p>
          ) : null}
          <p className="m-0 text-sm text-slate-600">
            {approved ? t.approvedBody : t.rejectedBody}
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={confirming}
              onClick={() => void confirm()}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                approved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'
              }`}
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.confirm}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (waiting && (pathname?.startsWith('/onboarding') || pathname === '/')) {
    return createPortal(
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[1100] -translate-x-1/2">
        <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm">
          {t.waitingHint}
        </div>
      </div>,
      document.body,
    );
  }

  return null;
}
