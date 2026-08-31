'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import type { PendingGroupEmailInvite } from '@/lib/group-email-invite';
import {
  formatGroupEmailInviteText,
  getGroupEmailInviteTranslation,
  type GroupEmailInviteTranslations,
} from '@/lib/translations/groupEmailInvite';
import { dashboardHrefWithOpenGroup, writeStoredGroupId } from '@/lib/group-id-resolve';
import { refreshAuthBootstrapCache } from '@/lib/auth-bootstrap';
import { GROUP_SUSPENDED_CODE, suspendedPath } from '@/lib/account-suspend-access';

function shouldSkipPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === '/') return true;
  if (pathname.startsWith('/auth')) return true;
  return false;
}

type GroupEmailInviteHostProps = {
  userId: string | null;
};

export function GroupEmailInviteHost({ userId }: GroupEmailInviteHostProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLanguage();
  const { setCurrentGroupId, refreshGroups } = useGroup();
  const [queue, setQueue] = useState<PendingGroupEmailInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = (key: keyof GroupEmailInviteTranslations) =>
    getGroupEmailInviteTranslation(lang, key);

  const currentInvite = queue[0] ?? null;

  const loadInvites = useCallback(async () => {
    if (!userId) {
      setQueue([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setQueue([]);
        return;
      }
      const res = await fetch('/api/group/email-invites/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQueue([]);
        return;
      }
      setQueue(Array.isArray(json.invites) ? json.invites : []);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || shouldSkipPath(pathname)) {
      setQueue([]);
      return;
    }
    void loadInvites();
  }, [userId, pathname, loadInvites]);

  const advanceQueue = () => {
    setQueue((prev) => prev.slice(1));
  };

  const handleReject = async () => {
    if (!currentInvite || acting) return;
    setActing(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('no session');
      const res = await fetch(`/api/group/email-invites/${encodeURIComponent(currentInvite.id)}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || t('reject_failed'));
      }
      advanceQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reject_failed'));
    } finally {
      setActing(false);
    }
  };

  const handleAccept = async () => {
    if (!currentInvite || acting) return;
    setActing(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('no session');
      const res = await fetch(`/api/group/email-invites/${encodeURIComponent(currentInvite.id)}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === GROUP_SUSPENDED_CODE) {
          setError(t('suspended_group'));
          advanceQueue();
          router.push(suspendedPath(currentInvite.group_id));
          return;
        }
        if (res.status === 410) {
          setError(t('expired'));
          advanceQueue();
          return;
        }
        throw new Error(json.error || t('accept_failed'));
      }
      const groupId = typeof json.group_id === 'string' ? json.group_id : currentInvite.group_id;
      writeStoredGroupId(groupId);
      setCurrentGroupId(groupId);
      await refreshGroups();
      if (token && userId) {
        await refreshAuthBootstrapCache(token, userId);
      }
      advanceQueue();
      router.push(dashboardHrefWithOpenGroup(groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('accept_failed'));
    } finally {
      setActing(false);
    }
  };

  if (!userId || shouldSkipPath(pathname) || loading || !currentInvite) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-email-invite-title"
        className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-xl"
      >
        <h2 id="group-email-invite-title" className="m-0 text-lg font-bold text-slate-800">
          {t('modal_title')}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {formatGroupEmailInviteText(t('modal_body'), { group: currentInvite.group_name })}
        </p>
        {currentInvite.invited_by_name ? (
          <p className="mt-1 text-xs text-slate-500">
            {formatGroupEmailInviteText(t('modal_invited_by'), { name: currentInvite.invited_by_name })}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={acting}
            onClick={() => void handleReject()}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {acting ? t('rejecting') : t('reject_btn')}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => void handleAccept()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {acting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('accepting')}
              </>
            ) : (
              t('accept_btn')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
