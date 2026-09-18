'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useGroup } from '@/app/contexts/GroupContext';
import { writeStoredGroupId } from '@/lib/group-id-resolve';
import { getAccountTranslation } from '@/lib/translations/account';

/**
 * 현재 선택 그룹에서만 나가기 (계정 유지).
 * group_id는 GroupContext의 currentGroupId만 사용 → /api/groups/leave 가 멤버십·app_id 재검증.
 */
export default function LeaveGroupSection() {
  const router = useRouter();
  const { lang } = useLanguage();
  const at = (key: Parameters<typeof getAccountTranslation>[1]) => getAccountTranslation(lang, key);
  const {
    currentGroupId,
    currentGroup,
    isOwner,
    groups,
    refreshGroups,
    setCurrentGroupId,
    loading,
  } = useGroup();
  const [busy, setBusy] = useState(false);

  const handleLeaveGroup = async () => {
    if (!currentGroupId) return;
    if (isOwner) {
      alert(at('leave_owner_blocked'));
      return;
    }
    if (!confirm(at('leave_confirm'))) return;

    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(at('auth_fetch_failed'));
        return;
      }

      const res = await fetch('/api/groups/leave', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        // 현재 그룹만 — 클라이언트가 임의 타 그룹 id를 넣어도 API가 memberships로 차단
        body: JSON.stringify({ group_id: currentGroupId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : at('leave_failed'));
        return;
      }

      alert(typeof json.message === 'string' ? json.message : at('leave_success'));

      const leftId = currentGroupId;
      const remaining = (groups || []).filter(
        (g) => String(g.id).toLowerCase() !== String(leftId).toLowerCase(),
      );
      await refreshGroups?.();
      if (remaining.length > 0) {
        const nextId = String(remaining[0].id);
        setCurrentGroupId?.(nextId);
        writeStoredGroupId(nextId);
        router.push('/dashboard');
      } else {
        setCurrentGroupId?.(null);
        writeStoredGroupId(null);
        router.push('/onboarding');
      }
    } catch (error: unknown) {
      console.error('그룹 탈퇴 오류:', error);
      alert(error instanceof Error ? error.message : at('leave_failed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-sm text-slate-500">…</p>
      </section>
    );
  }

  if (!currentGroupId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 text-base font-bold text-slate-900">{at('leave_section_title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{at('leave_no_group')}</p>
      </section>
    );
  }

  const groupLabel = currentGroup?.name?.trim() || currentGroupId;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <h2 className="m-0 text-base font-bold text-amber-950">{at('leave_section_title')}</h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-950/80">{at('leave_section_hint')}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">
        {at('leave_current_group')}: {groupLabel}
      </p>
      {isOwner ? (
        <p className="mt-3 text-sm leading-relaxed text-amber-900/90">{at('leave_owner_blocked')}</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleLeaveGroup()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border-0 bg-[rgba(139,69,19,0.95)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[rgba(139,69,19,1)] disabled:opacity-60"
          aria-label={at('leave_group_aria')}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {at('leave_group_btn')}
        </button>
      )}
    </section>
  );
}
