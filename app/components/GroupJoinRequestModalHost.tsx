'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getMemberManagementTranslation } from '@/lib/translations/memberManagement';
import { getCommonTranslation } from '@/lib/translations/common';
import { syncAfterAdminJoinResolve } from '@/lib/notifications/join-request-client';

type PendingJoin = {
  id: string;
  requester_user_id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;
};

function pendingSignature(rows: PendingJoin[]): string {
  return rows
    .map((r) => r.id)
    .sort()
    .join('|');
}

type Props = {
  groupId: string | null;
  /** groupId만 있으면 조기 조회(비관리자 403은 내부에서 무시) */
  enabled: boolean;
};

/** 대시보드: 관리자용 가입 승인 대기 팝업 */
export default function GroupJoinRequestModalHost({ groupId, enabled }: Props) {
  const { lang } = useLanguage();
  const mmt = (key: Parameters<typeof getMemberManagementTranslation>[1]) =>
    getMemberManagementTranslation(lang, key);
  const ct = (key: 'close') => getCommonTranslation(lang, key);

  const [pending, setPending] = useState<PendingJoin[]>([]);
  const [open, setOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());
  const loadGenRef = useRef(0);
  const notAdminRef = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    notAdminRef.current = false;
    dismissedRef.current = new Set();
    sessionTokenRef.current = null;
  }, [groupId]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (sessionTokenRef.current) return sessionTokenRef.current;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    sessionTokenRef.current = token;
    return token;
  }, []);

  const applyPending = useCallback((rows: PendingJoin[]) => {
    const visible = rows.filter((r) => !dismissedRef.current.has(r.id));
    setPending((prev) => {
      if (pendingSignature(prev) === pendingSignature(visible)) return prev;
      return visible;
    });
    setOpen(visible.length > 0);
  }, []);

  const loadPending = useCallback(async () => {
    if (!groupId || !enabled || notAdminRef.current) {
      if (!groupId || !enabled) {
        setPending([]);
        setOpen(false);
      }
      return;
    }
    const gen = ++loadGenRef.current;
    try {
      let token = await getAccessToken();
      if (!token) return;

      let res = await fetch(
        `/api/group/join-requests?groupId=${encodeURIComponent(groupId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.status === 401) {
        sessionTokenRef.current = null;
        const {
          data: { session },
        } = await supabase.auth.refreshSession();
        token = session?.access_token ?? null;
        sessionTokenRef.current = token;
        if (!token) return;
        res = await fetch(
          `/api/group/join-requests?groupId=${encodeURIComponent(groupId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }

      if (gen !== loadGenRef.current) return;

      if (res.status === 401 || res.status === 403) {
        notAdminRef.current = true;
        setPending([]);
        setOpen(false);
        return;
      }

      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const rows = Array.isArray(json.data) ? (json.data as PendingJoin[]) : [];
      applyPending(rows);
    } catch (err) {
      console.warn('join request modal load:', err);
    }
  }, [groupId, enabled, applyPending, getAccessToken]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!groupId || !enabled) return;

    const channel = supabase
      .channel(`dashboard_join_requests_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_join_requests',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          if (!notAdminRef.current) void loadPending();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, enabled, loadPending]);

  const dismissVisible = () => {
    for (const row of pending) {
      dismissedRef.current.add(row.id);
    }
    setOpen(false);
    setPending([]);
  };

  const resolve = async (requestId: string, action: 'approve' | 'reject') => {
    if (!groupId || resolvingId) return;
    setResolvingId(requestId);
    try {
      const token = await getAccessToken();
      if (!token) {
        alert(mmt('session_expired'));
        return;
      }
      const res = await fetch(
        `/api/group/join-requests/${encodeURIComponent(requestId)}/${action}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : mmt('pending_join_failed'));
        return;
      }
      dismissedRef.current.add(requestId);
      setPending((prev) => {
        const next = prev.filter((r) => r.id !== requestId);
        if (next.length === 0) setOpen(false);
        return next;
      });
      void syncAfterAdminJoinResolve({
        accessToken: token,
        groupId,
        requestId,
        status: action === 'approve' ? 'approved' : 'rejected',
      });
    } catch (err) {
      console.error('join request modal resolve:', err);
      alert(mmt('pending_join_failed'));
    } finally {
      setResolvingId(null);
    }
  };

  if (!mounted || !enabled || !open || pending.length === 0) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-900/40"
        aria-label={ct('close')}
        onClick={dismissVisible}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-join-request-modal-title"
        className="relative z-[1201] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2
                id="group-join-request-modal-title"
                className="m-0 text-base font-bold text-slate-900"
              >
                {mmt('pending_join_title')}
                {pending.length > 0 ? ` (${pending.length})` : ''}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissVisible}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={ct('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="m-0 flex max-h-72 list-none flex-col gap-2 overflow-y-auto p-0">
          {pending.map((req) => (
            <li
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5"
            >
              <div className="min-w-0 text-sm text-slate-800">
                <div className="font-semibold">
                  {req.nickname || req.email || req.requester_user_id.slice(0, 8)}
                </div>
                {req.email && req.nickname ? (
                  <div className="truncate text-xs text-slate-500">{req.email}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!!resolvingId}
                  onClick={() => void resolve(req.id, 'approve')}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {resolvingId === req.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {mmt('pending_join_approve')}
                </button>
                <button
                  type="button"
                  disabled={!!resolvingId}
                  onClick={() => void resolve(req.id, 'reject')}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {mmt('pending_join_reject')}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={dismissVisible}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            {ct('close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
