'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ModerationThreadDetail } from '@/lib/moderation-query';
import { MESSAGE_MAX_LENGTH } from '@/lib/admin-suspend';
import { getAdminModerationTranslation } from '@/lib/translations/adminModeration';
import { getAccountSuspendNoticeTranslation } from '@/lib/translations/accountSuspend';
import { intlLocaleForLang, type LangCode } from '@/lib/language-fonts';

type AdminModerationInboxProps = {
  lang: LangCode;
};

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

export function AdminModerationInbox({ lang }: AdminModerationInboxProps) {
  const t = useCallback(
    (key: Parameters<typeof getAdminModerationTranslation>[1]) => getAdminModerationTranslation(lang, key),
    [lang],
  );
  const nt = useCallback(
    (key: Parameters<typeof getAccountSuspendNoticeTranslation>[1]) =>
      getAccountSuspendNoticeTranslation(lang, key),
    [lang],
  );
  const locale = intlLocaleForLang(lang);

  const [threads, setThreads] = useState<ModerationThreadDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    const headers = await authHeaders();
    if (!headers) return;
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/admin/moderation/threads', { headers });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((result as { error?: string }).error || t('failed'));
      setThreads(Array.isArray(result.data) ? result.data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load(true);
    }, 12000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const send = async (threadId: string) => {
    const message = (drafts[threadId] || '').trim();
    if (!message) return;
    const headers = await authHeaders();
    if (!headers) {
      setError(t('failed'));
      return;
    }
    setSendingId(threadId);
    setError(null);
    try {
      const response = await fetch('/api/moderation/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({ threadId, message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((result as { error?: string }).error || t('failed'));
      setDrafts((prev) => ({ ...prev, [threadId]: '' }));
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed'));
    } finally {
      setSendingId(null);
    }
  };

  const removeThread = async (threadId: string) => {
    if (!window.confirm(t('confirm_delete_thread'))) return;
    const headers = await authHeaders();
    if (!headers) {
      setError(t('delete_failed'));
      return;
    }
    setDeletingId(threadId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/moderation/threads?threadId=${encodeURIComponent(threadId)}`, {
        method: 'DELETE',
        headers,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((result as { error?: string }).error || t('delete_failed'));
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('delete_failed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-800">{t('title')}</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <div className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto">
          {threads.map((thread) => (
            <section key={thread.threadId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-slate-800">{thread.groupName}</span>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  {thread.scope === 'group' ? t('scope_group') : t('scope_user')}
                </span>
                {thread.userLabel && <span className="text-slate-500">{thread.userLabel}</span>}
                <button
                  type="button"
                  disabled={deletingId === thread.threadId}
                  onClick={() => void removeThread(thread.threadId)}
                  className="ml-auto rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('delete_thread')}
                </button>
              </div>
              <ul className="mb-3 flex list-none flex-col gap-2 p-0">
                {thread.messages.map((message) => (
                  <li key={message.id} className="text-sm text-slate-700">
                    <span className="mr-2 text-xs font-semibold text-slate-500">
                      {message.authorKind === 'system_admin' ? nt('from_admin') : t('scope_user')}
                    </span>
                    <span className="whitespace-pre-wrap">{message.body}</span>
                    <div className="text-xs text-slate-400">
                      {new Date(message.createdAt).toLocaleString(locale)}
                    </div>
                  </li>
                ))}
              </ul>
              <textarea
                value={drafts[thread.threadId] || ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [thread.threadId]: e.target.value }))}
                placeholder={t('reply_placeholder')}
                maxLength={MESSAGE_MAX_LENGTH}
                className="mb-2 min-h-[72px] w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
              />
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-slate-400">
                  {(drafts[thread.threadId] || '').trim().length}/{MESSAGE_MAX_LENGTH}
                </span>
                <button
                  type="button"
                  disabled={sendingId === thread.threadId || !(drafts[thread.threadId] || '').trim()}
                  onClick={() => void send(thread.threadId)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border-none px-3 py-1.5 text-sm font-semibold text-white ${
                    sendingId === thread.threadId || !(drafts[thread.threadId] || '').trim()
                      ? 'cursor-not-allowed bg-slate-400'
                      : 'cursor-pointer bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {sendingId === thread.threadId && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('send')}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
