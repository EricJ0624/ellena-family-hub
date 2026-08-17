'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAccountSuspendNoticeTranslation } from '@/lib/translations/accountSuspend';
import { getGroupDisplayNameRaw } from '@/lib/group-display-name';
import { intlLocaleForLang } from '@/lib/language-fonts';
import { loadUserGroupAccess } from '@/lib/account-suspend-access';
import { MESSAGE_MAX_LENGTH } from '@/lib/admin-suspend';
import { isValidUUID } from '@/lib/validation';

type NoticeMessage = {
  id: string;
  body: string;
  created_at: string;
  author_kind: string;
  author_id: string;
};

type NoticeThread = {
  threadId: string;
  groupId: string;
  groupName: string;
  messages: NoticeMessage[];
};

const POLL_MS = 12000;

export default function SuspendedNoticePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-slate-50">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
        </div>
      }
    >
      <SuspendedNoticeContent />
    </Suspense>
  );
}

function messageAuthorLabel(
  message: NoticeMessage,
  currentUserId: string | null,
  t: (key: Parameters<typeof getAccountSuspendNoticeTranslation>[1]) => string,
): string {
  if (message.author_kind === 'system_admin') return t('from_admin');
  if (currentUserId && message.author_id.toLowerCase() === currentUserId.toLowerCase()) {
    return t('from_member');
  }
  return t('from_member_other');
}

function SuspendedNoticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = (key: Parameters<typeof getAccountSuspendNoticeTranslation>[1]) =>
    getAccountSuspendNoticeTranslation(lang, key);
  const locale = intlLocaleForLang(lang);

  const groupFromQuery = searchParams.get('group')?.trim() || null;
  const focusGroupId = groupFromQuery && isValidUUID(groupFromQuery) ? groupFromQuery : null;

  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<NoticeThread[]>([]);
  const [accessibleGroupId, setAccessibleGroupId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const sendingIdRef = useRef<string | null>(null);

  const loadNotice = useCallback(
    async (mode: 'full' | 'silent') => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace('/');
        return;
      }

      const [{ data: adminFlag }, access] = await Promise.all([
        supabase.rpc('is_system_admin', { user_id_param: user.id }),
        loadUserGroupAccess(supabase, user.id),
      ]);
      setIsAdmin(Boolean(adminFlag));
      setAccessibleGroupId(access.accessibleGroupIds[0] ?? null);
      setCurrentUserId(user.id);

      const targetGroupIds = focusGroupId ? [focusGroupId.toLowerCase()] : access.suspendedGroupIds;
      if (focusGroupId && !access.suspendedGroupIds.includes(focusGroupId.toLowerCase())) {
        if (access.accessibleGroupIds.includes(focusGroupId.toLowerCase())) {
          router.replace(`/dashboard?openGroup=${encodeURIComponent(focusGroupId)}`);
        } else if (access.accessibleGroupIds[0]) {
          router.replace(`/dashboard?openGroup=${encodeURIComponent(access.accessibleGroupIds[0])}`);
        } else {
          router.replace('/suspended');
        }
        return;
      }
      if (targetGroupIds.length === 0) {
        if (access.accessibleGroupIds[0]) {
          router.replace(`/dashboard?openGroup=${encodeURIComponent(access.accessibleGroupIds[0])}`);
        } else if (Boolean(adminFlag) && access.groupIds.length === 0) {
          router.replace('/admin');
        } else if (access.groupIds.length === 0) {
          router.replace('/onboarding');
        } else if (mode === 'full') {
          setLoading(false);
        }
        return;
      }

      const client = supabase as typeof supabase;
      const { data: susRows } = await client
        .from('account_suspensions' as never)
        .select('thread_id, group_id')
        .eq('is_active', true)
        .in('group_id', targetGroupIds);

      const seenThreadIds = new Set<string>();
      const uniqueRows: Array<{ thread_id: string; group_id: string }> = [];
      for (const row of (susRows || []) as Array<{ thread_id: string; group_id: string }>) {
        const threadId = String(row.thread_id);
        if (seenThreadIds.has(threadId)) continue;
        seenThreadIds.add(threadId);
        uniqueRows.push({ thread_id: threadId, group_id: String(row.group_id) });
      }

      const threadIds = uniqueRows.map((row) => row.thread_id);
      const groupIds = [...new Set(uniqueRows.map((row) => row.group_id))];

      const [{ data: groups }, { data: aliveThreads }, { data: messages }] = await Promise.all([
        groupIds.length
          ? client.from('groups').select('id, name, family_name, display_name_pending, title_style').in('id', groupIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
        threadIds.length
          ? client
              .from('moderation_threads' as never)
              .select('id')
              .in('id', threadIds)
              .is('deleted_at', null)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
        threadIds.length
          ? client
              .from('moderation_messages' as never)
              .select('id, thread_id, body, created_at, author_kind, author_id')
              .in('thread_id', threadIds)
              .is('deleted_at', null)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      ]);
      const aliveThreadIds = new Set(
        ((aliveThreads || []) as Array<{ id: string }>).map((row) => String(row.id)),
      );

      const groupNameById = new Map<string, string>();
      for (const group of groups || []) {
        const g = group as {
          id: string;
          name?: string;
          family_name?: string;
          display_name_pending?: boolean;
          title_style?: unknown;
        };
        groupNameById.set(String(g.id), getGroupDisplayNameRaw(g) || String(g.id).slice(0, 8));
      }

      const messagesByThread = new Map<string, NoticeMessage[]>();
      for (const row of (messages || []) as Array<{
        id: string;
        thread_id: string;
        body: string;
        created_at: string;
        author_kind: string;
        author_id: string;
      }>) {
        const list = messagesByThread.get(String(row.thread_id)) || [];
        list.push({
          id: String(row.id),
          body: String(row.body),
          created_at: String(row.created_at),
          author_kind: String(row.author_kind),
          author_id: String(row.author_id),
        });
        messagesByThread.set(String(row.thread_id), list);
      }

      const nextThreads: NoticeThread[] = uniqueRows
        .filter((row) => aliveThreadIds.has(row.thread_id))
        .map((row) => ({
          threadId: row.thread_id,
          groupId: row.group_id,
          groupName: groupNameById.get(row.group_id) || row.group_id.slice(0, 8),
          messages: messagesByThread.get(row.thread_id) || [],
        }));

      setThreads((prev) => {
        if (sendingIdRef.current) {
          const prevById = new Map(prev.flatMap((thread) => thread.messages.map((msg) => [msg.id, msg] as const)));
          return nextThreads.map((thread) => {
            const merged = new Map<string, NoticeMessage>();
            for (const msg of thread.messages) merged.set(msg.id, msg);
            const previous = prev.find((item) => item.threadId === thread.threadId);
            for (const msg of previous?.messages || []) {
              if (!merged.has(msg.id) && prevById.has(msg.id)) merged.set(msg.id, msg);
            }
            return {
              ...thread,
              messages: Array.from(merged.values()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
            };
          });
        }
        return nextThreads;
      });
      if (mode === 'full') setLoading(false);
    },
    [focusGroupId, router],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadNotice('full');
      } catch (error) {
        console.error('정지 안내 조회 오류:', error);
        if (!cancelled) setLoading(false);
      }
    })();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void loadNotice('silent');
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadNotice('silent');
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadNotice]);

  const heading = useMemo(() => {
    if (threads.length === 1) return threads[0].groupName;
    return t('title');
  }, [t, threads]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const sendReply = async (threadId: string) => {
    const message = (drafts[threadId] || '').trim();
    if (!message) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setReplyError(t('reply_failed'));
      return;
    }
    sendingIdRef.current = threadId;
    setSendingId(threadId);
    setReplyError(null);
    try {
      const response = await fetch('/api/moderation/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threadId, message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || t('reply_failed'));
      }
      const saved = result.data as
        | { id: string; body: string; createdAt: string; authorKind: string; authorId?: string }
        | undefined;
      if (saved) {
        setThreads((prev) =>
          prev.map((thread) =>
            thread.threadId === threadId
              ? {
                  ...thread,
                  messages: thread.messages.some((msg) => msg.id === saved.id)
                    ? thread.messages
                    : [
                        ...thread.messages,
                        {
                          id: saved.id,
                          body: saved.body,
                          created_at: saved.createdAt,
                          author_kind: saved.authorKind,
                          author_id: saved.authorId || currentUserId || '',
                        },
                      ],
                }
              : thread,
          ),
        );
      }
      setDrafts((prev) => ({ ...prev, [threadId]: '' }));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : t('reply_failed'));
    } finally {
      sendingIdRef.current = null;
      setSendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-slate-800">{t('title')}</h1>
        <p className="mb-4 text-sm text-slate-500">{t('intro')}</p>
        {threads.length === 1 && (
          <p className="mb-3 text-sm font-semibold text-slate-700">{heading}</p>
        )}
        <div className="mb-6 flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="text-sm text-slate-500">{t('no_message')}</p>
          ) : (
            threads.map((thread) => (
              <section key={thread.threadId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                {threads.length > 1 && (
                  <h2 className="mb-2 text-sm font-semibold text-slate-800">{thread.groupName}</h2>
                )}
                {thread.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('no_message')}</p>
                ) : (
                  <ul className="mb-3 flex list-none flex-col gap-3 p-0">
                    {thread.messages.map((message) => (
                      <li key={message.id} className="text-sm text-slate-700">
                        <p className="mb-1 text-xs font-semibold text-slate-500">
                          {messageAuthorLabel(message, currentUserId, t)}
                        </p>
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(message.created_at).toLocaleString(locale)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor={`reply-${thread.threadId}`}>
                  {t('reply_label')}
                </label>
                <textarea
                  id={`reply-${thread.threadId}`}
                  value={drafts[thread.threadId] || ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [thread.threadId]: e.target.value }))}
                  placeholder={t('reply_placeholder')}
                  maxLength={MESSAGE_MAX_LENGTH}
                  className="mb-2 min-h-[88px] w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                />
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs text-slate-400">
                    {(drafts[thread.threadId] || '').trim().length}/{MESSAGE_MAX_LENGTH}
                  </span>
                  <button
                    type="button"
                    disabled={sendingId === thread.threadId || !(drafts[thread.threadId] || '').trim()}
                    onClick={() => void sendReply(thread.threadId)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border-none px-3 py-1.5 text-sm font-semibold text-white ${
                      sendingId === thread.threadId || !(drafts[thread.threadId] || '').trim()
                        ? 'cursor-not-allowed bg-slate-400'
                        : 'cursor-pointer bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {sendingId === thread.threadId && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('send')}
                  </button>
                </div>
              </section>
            ))
          )}
        </div>
        {replyError && <p className="mb-3 text-sm text-red-600">{replyError}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {accessibleGroupId && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard?openGroup=${encodeURIComponent(accessibleGroupId)}`)}
              className="cursor-pointer rounded-lg border-none bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {t('other_group')}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {t('go_admin')}
            </button>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
          >
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
