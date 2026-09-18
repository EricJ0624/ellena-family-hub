'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import {
  type NotifiableWidgetKey,
  type NotificationRow,
} from '@/lib/notifications/types';
import {
  GROUP_JOIN_RESOLVED_EVENT,
  type GroupJoinResolvedDetail,
} from '@/lib/notifications/join-request-events';
import { syncAfterAdminJoinResolve } from '@/lib/notifications/join-request-client';
import {
  DEFAULT_FIRST_ALERT_MODE,
  DEFAULT_SUBSEQUENT_ALERT_MODE,
  normalizeAlertPreferences,
  NOTIFIABLE_WIDGET_LABELS,
  NOTIFICATION_ALERT_PREFS_UPDATED_EVENT,
  resolveAlertMode,
  type NotificationAlertPreferences,
} from '@/lib/notifications/alert-modes';
import {
  playForegroundAlertFeedback,
  unlockAlertAudio,
} from '@/lib/notifications/alert-feedback';

interface NotificationCenterProps {
  groupId: string | null;
  userId: string;
  lang?: string;
}

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

/** 알림 목록·배지. 설정(하쓰/위젯)은 내 계정 모달에서 관리 */
export default function NotificationCenter({ groupId, userId }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertPrefs, setAlertPrefs] = useState<NotificationAlertPreferences>({
    first_mode: DEFAULT_FIRST_ALERT_MODE,
    subsequent_mode: DEFAULT_SUBSEQUENT_ALERT_MODE,
  });
  const [loading, setLoading] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const unreadCountRef = useRef(0);
  const alertPrefsRef = useRef(alertPrefs);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    alertPrefsRef.current = alertPrefs;
  }, [alertPrefs]);

  const loadList = useCallback(async () => {
    if (!groupId) return;
    const headers = await authHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`/api/notifications?groupId=${encodeURIComponent(groupId)}&limit=40`, {
        headers,
      });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data || []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch (e) {
      console.warn('[NotificationCenter] list 실패:', e);
    }
  }, [groupId]);

  const loadAlertPrefs = useCallback(async () => {
    if (!groupId) return;
    const headers = await authHeaders();
    if (!headers) return;
    try {
      const res = await fetch(
        `/api/notifications/preferences?groupId=${encodeURIComponent(groupId)}`,
        { headers },
      );
      if (!res.ok) return;
      const json = await res.json();
      setAlertPrefs(normalizeAlertPreferences(json.alertPreferences));
    } catch (e) {
      console.warn('[NotificationCenter] alert prefs 실패:', e);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !userId) return;
    void loadList();
    void loadAlertPrefs();
  }, [groupId, userId, loadList, loadAlertPrefs]);

  useEffect(() => {
    const onPrefsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<NotificationAlertPreferences>).detail;
      if (!detail) return;
      setAlertPrefs(normalizeAlertPreferences(detail));
    };
    window.addEventListener(NOTIFICATION_ALERT_PREFS_UPDATED_EVENT, onPrefsUpdated);
    return () => window.removeEventListener(NOTIFICATION_ALERT_PREFS_UPDATED_EVENT, onPrefsUpdated);
  }, []);

  useEffect(() => {
    const onResolved = (event: Event) => {
      const detail = (event as CustomEvent<GroupJoinResolvedDetail>).detail;
      if (!detail || detail.groupId !== groupId) return;

      setItems((prev) => {
        let unreadRemoved = 0;
        const next = prev.filter((n) => {
          const matchesRequest =
            n.entity_id === detail.requestId ||
            (typeof n.payload?.requestId === 'string' &&
              n.payload.requestId === detail.requestId);
          const isJoinNotif =
            n.event_type === 'GROUP_JOIN_REQUEST' || n.event_type === 'GROUP_JOIN_RESOLVED';
          if (!(matchesRequest && isJoinNotif)) return true;
          if (n.event_type === 'GROUP_JOIN_REQUEST' && !n.read_at) unreadRemoved += 1;
          return false;
        });
        if (unreadRemoved > 0) {
          queueMicrotask(() => {
            setUnreadCount((c) => Math.max(0, c - unreadRemoved));
          });
        }
        return next;
      });
    };
    window.addEventListener(GROUP_JOIN_RESOLVED_EVENT, onResolved);
    return () => window.removeEventListener(GROUP_JOIN_RESOLVED_EVENT, onResolved);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !userId) return;

    const channel = supabase
      .channel(`notifications:${userId}:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          if (row.group_id !== groupId) return;
          const isFirst = unreadCountRef.current === 0;
          const mode = resolveAlertMode(isFirst, alertPrefsRef.current);
          playForegroundAlertFeedback(mode);
          setItems((prev) => [row, ...prev].slice(0, 40));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, userId]);

  useLayoutEffect(() => {
    if (!open || !bellRef.current) {
      setPanelPos(null);
      return;
    }
    const update = () => {
      const rect = bellRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const markAllRead = async () => {
    if (!groupId) return;
    const headers = await authHeaders();
    if (!headers) return;
    setLoading(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ groupId, markAll: true }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const openItem = async (item: NotificationRow) => {
    if (!groupId) return;
    const headers = await authHeaders();
    if (headers && !item.read_at) {
      void fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ groupId, ids: [item.id] }),
      });
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (item.url) {
      window.location.assign(item.url);
    }
  };

  const approveJoinRequest = async (item: NotificationRow, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const requestId =
      (typeof item.payload?.requestId === 'string' && item.payload.requestId) ||
      item.entity_id;
    if (!requestId || !groupId) return;

    const headers = await authHeaders();
    if (!headers) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    setApprovingId(item.id);
    try {
      const res = await fetch(`/api/group/join-requests/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
        headers,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : '승인에 실패했습니다.');
        return;
      }
      await syncAfterAdminJoinResolve({
        accessToken: token,
        groupId,
        requestId,
        status: 'approved',
      });
      setItems((prev) =>
        prev.filter((n) => {
          const matches =
            n.entity_id === requestId ||
            (typeof n.payload?.requestId === 'string' && n.payload.requestId === requestId);
          return !(
            matches &&
            (n.event_type === 'GROUP_JOIN_REQUEST' || n.event_type === 'GROUP_JOIN_RESOLVED')
          );
        }),
      );
      if (!item.read_at) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('approve join from notification:', err);
      alert('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setApprovingId(null);
    }
  };

  if (!groupId) return null;

  // 미확인 알림이 있을 때만 벨 표시 (패널 연 동안은 유지)
  const hasUnread = unreadCount > 0;
  if (!hasUnread && !open) return null;

  const panel =
    open && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[1100] cursor-default bg-transparent"
              aria-label="알림 닫기"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-[1101] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{ top: panelPos.top, right: panelPos.right }}
              role="dialog"
              aria-label="알림"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-xs font-semibold text-slate-800">알림</span>
                <button
                  type="button"
                  disabled={loading || unreadCount === 0}
                  onClick={() => void markAllRead()}
                  className="text-xs font-medium text-blue-600 disabled:opacity-40"
                >
                  모두 읽음
                </button>
              </div>
              <p className="border-b border-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
                소리·위젯 설정은 닉네임 → 내 계정에서 변경할 수 있습니다.
              </p>
              <ul className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-slate-400">알림이 없습니다</li>
                ) : (
                  items.map((item) => {
                    const canApproveJoin =
                      item.event_type === 'GROUP_JOIN_REQUEST' &&
                      item.payload?.action === 'approve_join' &&
                      (typeof item.payload?.requestId === 'string' || !!item.entity_id) &&
                      item.payload?.status !== 'approved';

                    return (
                      <li key={item.id}>
                        <div
                          className={`flex w-full flex-col gap-1.5 border-b border-slate-50 px-3 py-2.5 text-left ${
                            item.read_at ? 'opacity-70' : 'bg-sky-50/60'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => void openItem(item)}
                            className="flex w-full flex-col gap-0.5 text-left hover:opacity-90"
                          >
                            <span className="text-[11px] font-medium text-slate-500">
                              {NOTIFIABLE_WIDGET_LABELS[item.widget_key as NotifiableWidgetKey] ||
                                item.widget_key}
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              {item.title}
                            </span>
                            <span className="line-clamp-2 text-xs text-slate-600">{item.body}</span>
                          </button>
                          {canApproveJoin ? (
                            <button
                              type="button"
                              disabled={approvingId === item.id}
                              onClick={(e) => void approveJoinRequest(item, e)}
                              className="self-start rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {approvingId === item.id ? '처리 중…' : '승인'}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="relative shrink-0" data-notification-center>
      <button
        ref={bellRef}
        type="button"
        data-notification-bell
        onClick={() => {
          unlockAlertAudio();
          setOpen((v) => !v);
        }}
        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        aria-label="알림"
        aria-expanded={open}
      >
        <span aria-hidden className="text-base">
          🔔
        </span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
