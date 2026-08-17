'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { GlassSafeModal } from '@/app/components/GlassSafeModal';
import { supabase } from '@/lib/supabase';
import { getAdminTransferTranslation } from '@/lib/translations/adminTransfer';
import type { LangCode } from '@/lib/language-fonts';

export type SystemAdminTransferCandidate = {
  id: string;
  email: string | null;
  nickname: string | null;
};

type SystemAdminTransferModalProps = {
  open: boolean;
  lang: LangCode;
  candidates: SystemAdminTransferCandidate[];
  preselectedUserId?: string | null;
  intent: 'keep_account' | 'delete_account';
  onClose: () => void;
  onTransferred: () => void | Promise<void>;
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

function candidateLabel(user: SystemAdminTransferCandidate): string {
  if (user.nickname && user.email) return `${user.nickname} (${user.email})`;
  return user.nickname || user.email || user.id.slice(0, 8);
}

export function SystemAdminTransferModal({
  open,
  lang,
  candidates,
  preselectedUserId,
  intent,
  onClose,
  onTransferred,
}: SystemAdminTransferModalProps) {
  const t = useCallback(
    (key: Parameters<typeof getAdminTransferTranslation>[1]) => getAdminTransferTranslation(lang, key),
    [lang],
  );
  const [successorId, setSuccessorId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSuccessorId(preselectedUserId || '');
    setPassword('');
    setError(null);
    setSubmitting(false);
  }, [open, preselectedUserId]);

  const submit = async () => {
    if (!successorId) {
      setError(t('successor_required'));
      return;
    }
    if (!password) {
      setError(t('password_required'));
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
      const response = await fetch('/api/admin/system-admins/transfer', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          successor_user_id: successorId,
          password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || t('failed'));
      }
      setPassword('');
      await onTransferred();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassSafeModal open={open} onClose={onClose} maxWidthClass="max-w-[500px]">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-bold text-slate-800">
        <Shield className="h-6 w-6 text-purple-700" />
        {t('title')}
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-slate-500">
        {intent === 'delete_account' ? t('warning_delete') : t('warning_keep')}
      </p>
      {candidates.length === 0 ? (
        <>
          <p className="mb-5 text-sm text-red-600">{t('no_candidates')}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border-none bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
            >
              {t('cancel')}
            </button>
          </div>
        </>
      ) : (
        <form
          className="mb-0"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-600" htmlFor="sysadmin-successor">
            {t('successor_label')}
          </label>
          <select
            id="sysadmin-successor"
            value={successorId}
            onChange={(e) => setSuccessorId(e.target.value)}
            className="w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none"
          >
            <option value="">{t('successor_placeholder')}</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {candidateLabel(user)}
              </option>
            ))}
          </select>
        </div>
      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-slate-600" htmlFor="sysadmin-password">
          {t('password_label')}
        </label>
        <input
          id="sysadmin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('password_placeholder')}
          className="w-full rounded-lg border-2 border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none"
        />
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg border-none bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting || candidates.length === 0}
          className={`inline-flex items-center gap-2 rounded-lg border-none px-5 py-2.5 text-sm font-semibold text-white ${
            submitting || candidates.length === 0
              ? 'cursor-not-allowed bg-slate-400'
              : 'cursor-pointer bg-purple-700 hover:bg-purple-800'
          }`}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {intent === 'delete_account' ? t('submit_delete') : t('submit_keep')}
        </button>
      </div>
        </form>
      )}
    </GlassSafeModal>
  );
}
