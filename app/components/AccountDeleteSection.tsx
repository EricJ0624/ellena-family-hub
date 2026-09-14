'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAccountTranslation } from '@/lib/translations/account';
import { getOnboardingTranslation } from '@/lib/translations/onboarding';
import { getCommonTranslation } from '@/lib/translations/common';
import { SystemAdminTransferModal } from '@/app/components/admin/SystemAdminTransferModal';

type UserRow = { id: string; email: string; nickname: string | null };

/** 계정 단위 회원 탈퇴 (그룹 대시보드가 아닌 /account 에서 사용) */
export default function AccountDeleteSection() {
  const router = useRouter();
  const { lang } = useLanguage();
  const at = (key: Parameters<typeof getAccountTranslation>[1]) => getAccountTranslation(lang, key);
  const ct = (key: 'member') => getCommonTranslation(lang, key);
  const [busy, setBusy] = useState(false);
  const [showSuccessorModal, setShowSuccessorModal] = useState(false);
  const [candidates, setCandidates] = useState<UserRow[]>([]);

  const finishDelete = async () => {
    alert(at('delete_success'));
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleDeleteAccount = async (confirmGroupDeletion = false) => {
    if (!confirmGroupDeletion) {
      if (!confirm(at('delete_confirm_1'))) return;
      if (!confirm(at('delete_confirm_2'))) return;
    }

    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(at('auth_fetch_failed'));
        return;
      }

      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm_group_deletion: confirmGroupDeletion }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.error === 'ADMIN_ACCOUNT' && result.isSystemAdmin) {
          alert(typeof result.message === 'string' ? result.message : at('delete_failed'));
          const usersResponse = await fetch('/api/admin/users/list', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });
          if (usersResponse.ok) {
            const usersResult = await usersResponse.json();
            if (usersResult.success && usersResult.data) {
              const {
                data: { user: currentUser },
              } = await supabase.auth.getUser();
              const otherUsers = (usersResult.data as UserRow[]).filter(
                (u) => u.id !== currentUser?.id,
              );
              setCandidates(otherUsers);
              setShowSuccessorModal(true);
            }
          }
          return;
        }

        if (result.error === 'GROUP_OWNER_CONFIRMATION_REQUIRED' && result.requireConfirmation) {
          const ownedGroups = Array.isArray(result.ownedGroups) ? result.ownedGroups : [];
          const memberSuffix = getOnboardingTranslation(lang, 'member_count_suffix');
          const groupInfo = ownedGroups
            .map(
              (g: { name?: string; memberCount?: number }) =>
                `• ${g.name ?? ''} (${ct('member')} ${g.memberCount ?? 0}${memberSuffix})`,
            )
            .join('\n');
          const warningMessage = `${at('delete_warning_owner_title')}\n\n${at('delete_warning_owner_groups')}\n${groupInfo}\n\n${at('delete_warning_owner_deleted')}\n\n${at('delete_warning_owner_final')}`;
          if (confirm(warningMessage)) {
            await handleDeleteAccount(true);
          }
          return;
        }

        throw new Error(typeof result.error === 'string' ? result.error : at('delete_failed'));
      }

      await finishDelete();
    } catch (error: unknown) {
      console.error('회원탈퇴 오류:', error);
      alert(error instanceof Error ? error.message : at('delete_error'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAfterAdminTransfer = async () => {
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(at('delete_transfer_auth_failed'));
        return;
      }

      const deleteResponse = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      const deleteResult = await deleteResponse.json().catch(() => ({}));
      if (!deleteResponse.ok) {
        throw new Error(
          typeof deleteResult.error === 'string' ? deleteResult.error : at('delete_failed'),
        );
      }
      await finishDelete();
    } catch (error: unknown) {
      console.error('후임자 지정 후 탈퇴 오류:', error);
      alert(error instanceof Error ? error.message : at('delete_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
        <h2 className="m-0 text-base font-bold text-rose-900">{at('delete_section_title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-rose-800/90">{at('delete_section_hint')}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDeleteAccount()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border-0 bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
          aria-label={at('delete_account_aria')}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {at('delete_account_btn')}
        </button>
      </section>

      <SystemAdminTransferModal
        open={showSuccessorModal}
        lang={lang}
        candidates={candidates}
        intent="delete_account"
        onClose={() => setShowSuccessorModal(false)}
        onTransferred={async () => {
          setShowSuccessorModal(false);
          await handleDeleteAfterAdminTransfer();
        }}
      />
    </>
  );
}
