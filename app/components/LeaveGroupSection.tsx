'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useGroup } from '@/app/contexts/GroupContext';
import { writeStoredGroupId, sameGroupId } from '@/lib/group-id-resolve';
import { getAccountTranslation } from '@/lib/translations/account';
import { getGroupSelectorLabel } from '@/lib/group-display-name';
import { getCommonTranslation } from '@/lib/translations/common';
import { CURRENT_APP_ID } from '@/lib/apps';
import type { Group } from '@/types/db';

type MemberOption = { user_id: string; label: string };

/**
 * 계정 페이지 — 소유 그룹 삭제·소유권 이양 + (비소유) 현재 그룹 탈퇴.
 * 시스템 관리자 이양과 무관.
 */
export default function LeaveGroupSection() {
  const router = useRouter();
  const { lang } = useLanguage();
  const at = (key: Parameters<typeof getAccountTranslation>[1]) => getAccountTranslation(lang, key);
  const ct = (key: 'app_title') => getCommonTranslation(lang, key);
  const {
    currentGroupId,
    currentGroup,
    isOwner,
    groups,
    refreshGroups,
    setCurrentGroupId,
    loading,
  } = useGroup();
  const [userId, setUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [transferGroupId, setTransferGroupId] = useState<string | null>(null);
  const [transferMembers, setTransferMembers] = useState<MemberOption[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  const ownedGroups = useMemo(() => {
    if (!userId) return [] as Group[];
    return (groups || []).filter(
      (g) => typeof g.owner_id === 'string' && sameGroupId(g.owner_id, userId),
    );
  }, [groups, userId]);

  const afterGroupRemoved = async (removedId: string) => {
    const wasCurrent = Boolean(currentGroupId && sameGroupId(currentGroupId, removedId));
    await refreshGroups?.();
    // 다른 그룹 삭제: 현재 대시보드 유지 (리다이렉트 없음)
    if (!wasCurrent) return;
    // 현재 그룹 삭제/탈퇴: 남은 그룹이 있어도 자동 전환하지 않고 선택 화면으로
    // (refreshGroups가 다른 그룹을 골라 둘 수 있어 선택값을 다시 비움)
    setCurrentGroupId?.(null);
    writeStoredGroupId(null);
    router.push('/onboarding');
  };

  const openTransferPicker = async (group: Group) => {
    if (!userId) return;
    setTransferGroupId(group.id);
    setSelectedNewOwner('');
    setTransferMembers([]);
    setTransferLoading(true);
    try {
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', group.id)
        .eq('app_id', CURRENT_APP_ID);

      if (error) throw error;
      const otherIds = (memberships || [])
        .map((m) => m.user_id as string)
        .filter((id) => !sameGroupId(id, userId));

      if (otherIds.length === 0) {
        setTransferMembers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, email')
        .in('id', otherIds);

      const options: MemberOption[] = otherIds.map((id) => {
        const p = profiles?.find((row) => row.id === id);
        const label =
          (typeof p?.nickname === 'string' && p.nickname.trim()) ||
          (typeof p?.email === 'string' && p.email.trim()) ||
          id.slice(0, 8);
        return { user_id: id, label };
      });
      setTransferMembers(options);
    } catch (e) {
      console.warn('이양 멤버 목록 로드 실패:', e);
      setTransferMembers([]);
      alert(at('leave_transfer_failed'));
      setTransferGroupId(null);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleTransferOwnership = async (group: Group) => {
    if (!selectedNewOwner) return;
    const label = getGroupSelectorLabel(group, ct('app_title'));
    if (!confirm(at('leave_transfer_confirm').replace('{name}', label))) return;

    setBusyId(group.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(at('auth_fetch_failed'));
        return;
      }

      const res = await fetch('/api/groups/transfer-ownership', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId: group.id, newOwnerId: selectedNewOwner }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : at('leave_transfer_failed'));
        return;
      }

      alert(typeof json.message === 'string' ? json.message : at('leave_transfer_success'));
      setTransferGroupId(null);
      setSelectedNewOwner('');
      await refreshGroups?.();
    } catch (error: unknown) {
      console.error('소유권 이양 오류:', error);
      alert(error instanceof Error ? error.message : at('leave_transfer_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteOwnedGroup = async (group: Group) => {
    const label = getGroupSelectorLabel(group, ct('app_title'));
    if (!confirm(at('leave_delete_confirm').replace('{name}', label))) return;

    setBusyId(group.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(at('auth_fetch_failed'));
        return;
      }

      const res = await fetch('/api/groups/delete', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId: group.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : at('leave_delete_failed'));
        return;
      }

      alert(typeof json.message === 'string' ? json.message : at('leave_delete_success'));
      if (transferGroupId && sameGroupId(transferGroupId, group.id)) {
        setTransferGroupId(null);
      }
      await afterGroupRemoved(group.id);
    } catch (error: unknown) {
      console.error('그룹 삭제 오류:', error);
      alert(error instanceof Error ? error.message : at('leave_delete_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentGroupId) return;
    if (isOwner) {
      alert(at('leave_owner_blocked'));
      return;
    }
    if (!confirm(at('leave_confirm'))) return;

    setLeaveBusy(true);
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
        body: JSON.stringify({ group_id: currentGroupId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : at('leave_failed'));
        return;
      }

      alert(typeof json.message === 'string' ? json.message : at('leave_success'));
      await afterGroupRemoved(currentGroupId);
    } catch (error: unknown) {
      console.error('그룹 탈퇴 오류:', error);
      alert(error instanceof Error ? error.message : at('leave_failed'));
    } finally {
      setLeaveBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-sm text-slate-500">…</p>
      </section>
    );
  }

  const currentLabel =
    currentGroup != null
      ? getGroupSelectorLabel(currentGroup, ct('app_title'))
      : currentGroupId;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <h2 className="m-0 text-base font-bold text-amber-950">{at('leave_section_title')}</h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-950/80">{at('leave_section_hint')}</p>

      <div className="mt-4 rounded-xl border border-amber-200/80 bg-white/70 p-3">
        <h3 className="m-0 text-sm font-semibold text-slate-900">{at('leave_owned_title')}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{at('leave_owned_hint')}</p>
        {ownedGroups.length === 0 ? (
          <p className="mt-3 m-0 text-sm text-slate-500">{at('leave_owned_empty')}</p>
        ) : (
          <ul className="mt-3 m-0 list-none space-y-3 p-0">
            {ownedGroups.map((g) => {
              const label = getGroupSelectorLabel(g, ct('app_title'));
              const busy = busyId === g.id;
              const picking = transferGroupId != null && sameGroupId(transferGroupId, g.id);
              return (
                <li
                  key={g.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                      {label}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || busyId != null}
                        onClick={() => void openTransferPicker(g)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                        aria-label={at('leave_transfer_aria')}
                      >
                        {at('leave_transfer_btn')}
                      </button>
                      <button
                        type="button"
                        disabled={busy || busyId != null}
                        onClick={() => void handleDeleteOwnedGroup(g)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border-0 bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
                        aria-label={at('leave_delete_group_aria')}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                        {at('leave_delete_group_btn')}
                      </button>
                    </div>
                  </div>
                  {picking ? (
                    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                      <p className="m-0 text-xs font-medium text-slate-700">
                        {at('leave_transfer_pick')}
                      </p>
                      {transferLoading ? (
                        <p className="mt-2 m-0 text-xs text-slate-500">…</p>
                      ) : transferMembers.length === 0 ? (
                        <p className="mt-2 m-0 text-xs text-amber-900">
                          {at('leave_transfer_no_members')}
                        </p>
                      ) : (
                        <select
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800"
                          value={selectedNewOwner}
                          onChange={(e) => setSelectedNewOwner(e.target.value)}
                        >
                          <option value="">—</option>
                          {transferMembers.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            busy || !selectedNewOwner || transferMembers.length === 0
                          }
                          onClick={() => void handleTransferOwnership(g)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {at('leave_transfer_btn')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setTransferGroupId(null);
                            setSelectedNewOwner('');
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {at('leave_transfer_cancel')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-amber-200/70 pt-4">
        <p className="m-0 text-sm font-semibold text-slate-800">
          {at('leave_current_group')}: {currentLabel || '—'}
        </p>
        {!currentGroupId ? (
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">{at('leave_no_group')}</p>
        ) : isOwner ? (
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">{at('leave_owner_blocked')}</p>
        ) : (
          <button
            type="button"
            disabled={leaveBusy}
            onClick={() => void handleLeaveGroup()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border-0 bg-[rgba(139,69,19,0.95)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[rgba(139,69,19,1)] disabled:opacity-60"
            aria-label={at('leave_group_aria')}
          >
            {leaveBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {at('leave_group_btn')}
          </button>
        )}
      </div>
    </section>
  );
}
