'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GlassSafeModal } from '@/app/components/GlassSafeModal';
import { supabase } from '@/lib/supabase';
import { getAdminTranslation } from '@/lib/translations/admin';
import { getAdminTransferTranslation } from '@/lib/translations/adminTransfer';
import type { LangCode } from '@/lib/language-fonts';

export type AdminForceLeaveTarget = {
  userId: string;
  displayName: string;
};

type AdminForceLeaveModalProps = {
  lang: LangCode;
  target: AdminForceLeaveTarget | null;
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

export function AdminForceLeaveModal({ lang, target, onClose, onApplied }: AdminForceLeaveModalProps) {
  const at = useCallback(
    (key: Parameters<typeof getAdminTranslation>[1]) => getAdminTranslation(lang, key),
    [lang],
  );
  const pt = useCallback(
    (key: Parameters<typeof getAdminTransferTranslation>[1]) => getAdminTransferTranslation(lang, key),
    [lang],
  );
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setPassword('');
    setError(null);
    setSubmitting(false);
  }, [target]);

  const submit = async () => {
    if (!target) return;
    if (!password) {
      setError(pt('password_required'));
      return;
    }
    const headers = await authHeaders();
    if (!headers) {
      setError(at('error_auth'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users/delete', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          userId: target.userId,
          password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || at('error_force_leave'));
      }
      setPassword('');
      onApplied();
      onClose();
      window.alert(at('force_leave_done').replace(/\$\{name\}/g, target.displayName));
    } catch (err) {
      setError(err instanceof Error ? err.message : at('error_force_leave_msg'));
    } finally {
      setSubmitting(false);
    }
  };

  const warning = target
    ? at('confirm_force_leave_warning').replace(/\$\{name\}/g, target.displayName)
    : '';

  return (
    <GlassSafeModal open={target !== null} onClose={onClose} maxWidthClass="max-w-[500px]">
      {target && (
        <form
          className="mb-0"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h3 className="mb-2 text-xl font-semibold text-slate-800">{at('force_leave_btn')}</h3>
          <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-slate-500">{warning}</p>
          <label className="mb-2 block text-sm font-semibold text-slate-600" htmlFor="force-leave-password">
            {pt('password_label')}
          </label>
          <input
            id="force-leave-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={pt('password_placeholder')}
            className="mb-4 w-full rounded-lg border-2 border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none"
          />
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
            >
              {pt('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 rounded-lg border-none px-4 py-2 text-sm font-semibold text-white ${
                submitting ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {at('force_leave_btn')}
            </button>
          </div>
        </form>
      )}
    </GlassSafeModal>
  );
}
