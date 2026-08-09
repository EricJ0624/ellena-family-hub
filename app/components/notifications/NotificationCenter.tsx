'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import {
  NOTIFIABLE_WIDGET_KEYS,
  type NotifiableWidgetKey,
  type NotificationRow,
} from '@/lib/notifications/types';

const WIDGET_LABELS: Record<NotifiableWidgetKey, string> = {
  tasks: '가족 임무',
  calendar: '가족 일정',
  chat: '가족 채팅',
  location: '가족 위치',
  travel: '여행 플래너',
  piggy: '저금통',
  games: '가족 게임',
};

interface PrefRow {
  widget_key: NotifiableWidgetKey;
  push_enabled: boolean;
  inapp_enabled: boolean;
}

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

export default function NotificationCenter({ groupId, userId }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'list' | 'settings'>('list');
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState<PrefRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

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

  const loadPrefs = useCallback(async () => {
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
      setPrefs(json.data || []);
    } catch (e) {
      console.warn('[NotificationCenter] prefs 실패:', e);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !userId) return;
    void loadList();
  }, [groupId, userId, loadList]);

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
          setItems((prev) => [row, ...prev].slice(0, 40));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, userId]);

  useEffect(() => {
    if (open && tab === 'settings') void loadPrefs();
  }, [open, tab, loadPrefs]);

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

  const togglePref = (widgetKey: NotifiableWidgetKey, field: 'push_enabled' | 'inapp_enabled') => {
    setPrefs((prev) => {
      const existing = prev.find((p) => p.widget_key === widgetKey);
      if (existing) {
        return prev.map((p) =>
          p.widget_key === widgetKey ? { ...p, [field]: !p[field] } : p,
        );
      }
      const base: PrefRow = {
        widget_key: widgetKey,
        push_enabled: true,
        inapp_enabled: true,
      };
      return [...prev, { ...base, [field]: false }];
    });
  };

  const savePrefs = async () => {
    if (!groupId) return;
    const headers = await authHeaders();
    if (!headers) return;
    setSaving(true);
    try {
      const merged = NOTIFIABLE_WIDGET_KEYS.map((key) => {
        const found = prefs.find((p) => p.widget_key === key);
        return {
          widget_key: key,
          push_enabled: found ? found.push_enabled !== false : true,
          inapp_enabled: found ? found.inapp_enabled !== false : true,
        };
      });
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ groupId, preferences: merged }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert('알림 설정 저장 실패: ' + text);
        return;
      }
      setPrefs(merged);
    } finally {
      setSaving(false);
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
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      tab === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                    onClick={() => setTab('list')}
                  >
                    알림
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      tab === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                    onClick={() => setTab('settings')}
                  >
                    설정
                  </button>
                </div>
                {tab === 'list' && (
                  <button
                    type="button"
                    disabled={loading || unreadCount === 0}
                    onClick={() => void markAllRead()}
                    className="text-xs font-medium text-blue-600 disabled:opacity-40"
                  >
                    모두 읽음
                  </button>
                )}
              </div>

              {tab === 'list' ? (
                <ul className="max-h-80 overflow-y-auto">
                  {items.length === 0 ? (
                    <li className="px-3 py-8 text-center text-sm text-slate-400">알림이 없습니다</li>
                  ) : (
                    items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void openItem(item)}
                          className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 ${
                            item.read_at ? 'opacity-70' : 'bg-sky-50/60'
                          }`}
                        >
                          <span className="text-[11px] font-medium text-slate-500">
                            {WIDGET_LABELS[item.widget_key as NotifiableWidgetKey] || item.widget_key}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                          <span className="line-clamp-2 text-xs text-slate-600">{item.body}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <div className="max-h-80 overflow-y-auto px-3 py-2">
                  <p className="mb-2 text-[11px] text-slate-500">
                    위젯별로 푸시/앱 알림을 끌 수 있습니다. 앨범·여행 다이어리는 알림 대상이 아닙니다.
                  </p>
                  <ul className="space-y-2">
                    {NOTIFIABLE_WIDGET_KEYS.map((key) => {
                      const pref = prefs.find((p) => p.widget_key === key) || {
                        widget_key: key,
                        push_enabled: true,
                        inapp_enabled: true,
                      };
                      return (
                        <li key={key} className="rounded-lg border border-slate-100 px-2.5 py-2">
                          <div className="mb-1.5 text-xs font-semibold text-slate-800">
                            {WIDGET_LABELS[key]}
                          </div>
                          <div className="flex gap-3 text-[11px] text-slate-600">
                            <label className="inline-flex cursor-pointer items-center gap-1">
                              <input
                                type="checkbox"
                                checked={pref.push_enabled}
                                onChange={() => togglePref(key, 'push_enabled')}
                              />
                              푸시
                            </label>
                            <label className="inline-flex cursor-pointer items-center gap-1">
                              <input
                                type="checkbox"
                                checked={pref.inapp_enabled}
                                onChange={() => togglePref(key, 'inapp_enabled')}
                              />
                              앱 안
                            </label>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void savePrefs()}
                    className="mt-3 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? '저장 중…' : '설정 저장'}
                  </button>
                </div>
              )}
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
        onClick={() => setOpen((v) => !v)}
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
