'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GlassSafeModal } from '@/app/components/GlassSafeModal';
import { supabase } from '@/lib/supabase';
import {
  MESSAGE_MAX_LENGTH,
  type SuspendAction,
  type UserGroupSuspendRow,
} from '@/lib/admin-suspend';
import { getAdminSuspendTranslation } from '@/lib/translations/adminSuspend';
import { getAdminTransferTranslation } from '@/lib/translations/adminTransfer';
import type { LangCode } from '@/lib/language-fonts';

export type AdminSuspendTarget =
  | { kind: 'user'; userId: string; displayName: string; currentlySuspended: boolean }
  | { kind: 'group'; groupId: string; groupName: string; currentlySuspended: boolean };

type AdminSuspendModalsProps = {
  lang: LangCode;
  target: AdminSuspendTarget | null;
  onClose: () => void;
  onApplied: () => void;
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

export function AdminSuspendModals({ lang, target, onClose, onApplied }: AdminSuspendModalsProps) {
  const t = useCallback(
    (key: Parameters<typeof getAdminSuspendTranslation>[1]) => getAdminSuspendTranslation(lang, key),
    [lang],
  );
  const pt = useCallback(
    (key: Parameters<typeof getAdminTransferTranslation>[1]) => getAdminTransferTranslation(lang, key),
    [lang],
  );

  const [action, setAction] = useState<SuspendAction>('suspend');
  const [groups, setGroups] = useState<UserGroupSuspendRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setGroups([]);
      setSelectedIds([]);
      setMessage('');
      setPassword('');
      setError(null);
      setAction('suspend');
      return;
    }

    setMessage('');
    setPassword('');
    setError(null);
    if (target.kind === 'group') {
      setAction(target.currentlySuspended ? 'unsuspend' : 'suspend');
      setSelectedIds([target.groupId]);
      setGroups([]);
      return;
    }

    setAction(target.currentlySuspended ? 'unsuspend' : 'suspend');
    setSelectedIds([]);
    let cancelled = false;
    setLoadingGroups(true);
    void (async () => {
      const headers = await authHeaders();
      if (!headers) {
        if (!cancelled) {
          setError(t('load_groups_failed'));
          setLoadingGroups(false);
        }
        return;
      }
      try {
        const response = await fetch(`/api/admin/suspend/user-groups?user_id=${encodeURIComponent(target.userId)}`, {
          headers,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((result as { error?: string }).error || t('load_groups_failed'));
        }
        const rows = Array.isArray(result.data) ? (result.data as UserGroupSuspendRow[]) : [];
        if (!cancelled) {
          setGroups(rows);
          setSelectedIds(
            target.currentlySuspended
              ? rows.filter((row) => row.userSuspended).map((row) => row.groupId)
              : rows.filter((row) => !row.groupSuspended).map((row) => row.groupId),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('load_groups_failed'));
          setGroups([]);
        }
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target, t]);

  const selectableIds = useMemo(() => {
    if (!target || target.kind !== 'user') return [];
    if (action === 'unsuspend') {
      return groups.filter((row) => row.userSuspended).map((row) => row.groupId);
    }
    return groups.filter((row) => !row.groupSuspended).map((row) => row.groupId);
  }, [action, groups, target]);

  const title = !target
    ? ''
    : target.kind === 'group'
      ? action === 'unsuspend'
        ? t('group_modal_title_unsuspend')
        : t('group_modal_title_suspend')
      : t('user_modal_title');

  const canSubmit =
    !submitting &&
    password.length > 0 &&
    message.trim().length >= 1 &&
    message.trim().length <= MESSAGE_MAX_LENGTH &&
    selectedIds.length > 0;

  const toggleId = (groupId: string) => {
    setSelectedIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  const submit = async () => {
    if (!target) return;
    const trimmed = message.trim();
    if (trimmed.length < 1 || trimmed.length > MESSAGE_MAX_LENGTH) {
      setError(t('message_required'));
      return;
    }
    if (selectedIds.length === 0) {
      setError(t('none_selected'));
      return;
    }
    if (!password) {
      setError(pt('password_required'));
      return;
    }

    const headers = await authHeaders();
    if (!headers) {
      setError(t('failed'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/suspend', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          scope: target.kind === 'group' ? 'group' : 'user_in_group',
          userId: target.kind === 'user' ? target.userId : undefined,
          groupIds: selectedIds,
          message: trimmed,
          password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || t('failed'));
      }
      onApplied();
      onClose();
      window.alert(t('done'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassSafeModal open={target !== null} onClose={onClose}>
      {target && (
        <>
          <h3 className="mb-1 text-xl font-semibold text-slate-800">{title}</h3>
          <p className="mb-4 text-sm text-slate-500">
            {target.kind === 'user' ? target.displayName : target.groupName}
          </p>

          {target.kind === 'user' && (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-700">{t('choose_action')}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAction('suspend');
                    setSelectedIds(groups.filter((row) => !row.groupSuspended).map((row) => row.groupId));
                  }}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    action === 'suspend'
                      ? 'border-orange-300 bg-orange-100 text-orange-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {t('suspend_btn')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAction('unsuspend');
                    setSelectedIds(groups.filter((row) => row.userSuspended).map((row) => row.groupId));
                  }}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    action === 'unsuspend'
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {t('unsuspend_btn')}
                </button>
              </div>

              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{t('select_groups')}</p>
                {selectableIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(selectedIds.length === selectableIds.length ? [] : selectableIds)
                    }
                    className="cursor-pointer border-none bg-transparent text-xs font-semibold text-purple-700"
                  >
                    {t('select_all')}
                  </button>
                )}
              </div>
              {loadingGroups ? (
                <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : groups.length === 0 ? (
                <p className="mb-4 text-sm text-slate-500">{t('no_groups')}</p>
              ) : (
                <ul className="mb-4 max-h-48 list-none overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {groups.map((row) => {
                    const disabled =
                      action === 'unsuspend' ? !row.userSuspended : row.groupSuspended;
                    return (
                      <li key={row.groupId} className="flex items-start gap-2 rounded-md px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="mt-1"
                          disabled={disabled}
                          checked={selectedIds.includes(row.groupId)}
                          onChange={() => toggleId(row.groupId)}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800">
                            {row.groupName.trim() || t('name_pending')}
                          </div>
                          {row.groupSuspended && (
                            <div className="text-xs text-amber-700">{t('already_group_suspended')}</div>
                          )}
                          {row.userSuspended && !row.groupSuspended && (
                            <div className="text-xs text-red-700">{t('badge_suspended')}</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="admin-suspend-message">
            {t('message_label')}
          </label>
          <textarea
            id="admin-suspend-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={action === 'unsuspend' ? t('message_placeholder_unsuspend') : t('message_placeholder_suspend')}
            maxLength={MESSAGE_MAX_LENGTH}
            className="mb-1 min-h-[120px] w-full rounded-lg border border-slate-200 p-3 text-sm"
          />
          <p className="mb-4 text-right text-xs text-slate-400">
            {message.trim().length}/{MESSAGE_MAX_LENGTH}
          </p>

          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="admin-suspend-password">
            {pt('password_label')}
          </label>
          <input
            id="admin-suspend-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={pt('password_placeholder')}
            className="mb-4 w-full rounded-lg border border-slate-200 p-3 text-sm"
          />

          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
              className={`inline-flex items-center gap-1.5 rounded-lg border-none px-4 py-2 text-sm font-semibold text-white ${
                canSubmit ? 'cursor-pointer bg-orange-600 hover:bg-orange-700' : 'cursor-not-allowed bg-slate-400'
              }`}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('confirm')}
            </button>
          </div>
        </>
      )}
    </GlassSafeModal>
  );
}
