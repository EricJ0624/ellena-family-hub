'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { intlLocaleForLang } from '@/lib/language-fonts';
import { getDashboardTranslation, type DashboardTranslations } from '@/lib/translations/dashboard';
import { getCommonTranslation, type CommonTranslations } from '@/lib/translations/common';
import {
  markMemberTicketsSeen,
  removeMemberTicketFromSeen,
  type MemberSupportTicketRow,
} from '@/lib/member-support';
import { parseMemberSupportMessageThread } from '@/lib/member-support-ticket-thread';
import { GroupRequiredRouteGuard } from '@/app/components/GroupRequiredRouteGuard';

function MemberSupportPageContent() {
  const router = useRouter();
  const {
    currentGroupId,
    loading: groupLoading,
    userRole,
    isOwner,
  } = useGroup();

  const { lang } = useLanguage();
  const dt = (key: keyof DashboardTranslations) =>
    getDashboardTranslation(lang, key);
  const ct = (key: keyof CommonTranslations) => getCommonTranslation(lang, key);

  const [isMounted, setIsMounted] = useState(false);
  const [authOk, setAuthOk] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [adminResolved, setAdminResolved] = useState(false);

  const [tickets, setTickets] = useState<MemberSupportTicketRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [followUpTicketId, setFollowUpTicketId] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const isGroupAdmin =
    (userRole === 'ADMIN' || isOwner) && currentGroupId !== null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = `${getDashboardTranslation(lang, 'member_support_title')} · ${getCommonTranslation(lang, 'app_title')}`;
  }, [lang]);

  useEffect(() => {
    if (!isMounted) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/');
        return;
      }
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.replace('/');
        return;
      }
      setUserId(user.id);
      setAuthOk(true);
    })();
  }, [isMounted, router]);

  useEffect(() => {
    if (!authOk || !userId) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('is_system_admin', {
          user_id_param: userId,
        });
        if (error) {
          setIsSystemAdmin(false);
        } else {
          setIsSystemAdmin(data === true);
        }
      } catch {
        setIsSystemAdmin(false);
      } finally {
        setAdminResolved(true);
      }
    })();
  }, [authOk, userId]);

  useEffect(() => {
    if (!adminResolved) return;
    if (isSystemAdmin || isGroupAdmin) {
      router.replace('/dashboard');
    }
  }, [adminResolved, isSystemAdmin, isGroupAdmin, router]);

  const loadTickets = useCallback(async () => {
    if (!currentGroupId || !userId) return;
    if (isSystemAdmin || isGroupAdmin) return;
    setListLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `/api/support-tickets?group_id=${encodeURIComponent(currentGroupId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      if (!res.ok) return;
      setTickets(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error('멤버 문의 목록 로드 오류:', e);
    } finally {
      setListLoading(false);
    }
  }, [currentGroupId, userId, isSystemAdmin, isGroupAdmin]);

  useEffect(() => {
    if (!authOk || !adminResolved) return;
    if (isSystemAdmin || isGroupAdmin) return;
    loadTickets();
  }, [authOk, adminResolved, isSystemAdmin, isGroupAdmin, loadTickets]);

  useEffect(() => {
    if (!userId || tickets.length === 0) return;
    const answeredIds = tickets
      .filter((t) => t.answer && String(t.answer).trim() !== '')
      .map((t) => t.id);
    if (answeredIds.length) markMemberTicketsSeen(userId, answeredIds);
  }, [userId, tickets]);

  const sortedTickets = [...tickets].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleSubmit = async () => {
    if (!currentGroupId) return;
    if (!title.trim() || !content.trim()) {
      alert(dt('member_support_alert_fill'));
      return;
    }
    setSubmitLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(dt('member_support_alert_auth'));
        return;
      }
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group_id: currentGroupId,
          title: title.trim(),
          content: content.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || dt('member_support_alert_submit_failed'));
      alert(dt('member_support_alert_registered'));
      setTitle('');
      setContent('');
      await loadTickets();
    } catch (e: unknown) {
      console.error('멤버 문의 작성 오류:', e);
      alert(e instanceof Error ? e.message : dt('member_support_alert_submit_failed'));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleFollowUpSubmit = async () => {
    if (!currentGroupId || !followUpTicketId) return;
    const text = followUpText.trim();
    if (!text) {
      alert(dt('member_support_alert_fill'));
      return;
    }
    setFollowUpLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(dt('member_support_alert_auth'));
        return;
      }
      const res = await fetch('/api/support-tickets', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: followUpTicketId,
          group_id: currentGroupId,
          follow_up: text,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : dt('member_support_follow_up_error')
        );
      }
      alert(dt('member_support_follow_up_success'));
      setFollowUpTicketId(null);
      setFollowUpText('');
      await loadTickets();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : dt('member_support_follow_up_error'));
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!currentGroupId || !userId) return;
    if (!confirm(dt('member_support_delete_confirm'))) return;
    setDeletingId(ticketId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(dt('member_support_alert_auth'));
        return;
      }
      const res = await fetch(
        `/api/support-tickets?id=${encodeURIComponent(ticketId)}&group_id=${encodeURIComponent(currentGroupId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(
          typeof json.error === 'string' ? json.error : dt('member_support_delete_failed')
        );
        return;
      }
      removeMemberTicketFromSeen(userId, ticketId);
      setTickets((prev) => prev.filter((x) => x.id !== ticketId));
    } catch (e) {
      console.error('멤버 문의 삭제 오류:', e);
      alert(dt('member_support_delete_failed'));
    } finally {
      setDeletingId(null);
    }
  };

  if (!isMounted) return null;

  if (!authOk || !adminResolved) {
    return (
      <div className="app-container px-4 py-6">
        <p className="text-sm text-slate-500">{dt('member_support_loading_page')}</p>
      </div>
    );
  }

  if (isSystemAdmin || isGroupAdmin) {
    return null;
  }

  const waitingGroup = groupLoading && !currentGroupId;

  return (
    <div className="app-container px-4 pb-[120px] pt-4">
      <div className="mb-5">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-blue-600 no-underline"
        >
          {dt('member_support_back_dashboard')}
        </Link>
      </div>

      <h1 className="mb-2 mt-0 text-[22px] font-bold text-slate-800">
        {dt('member_support_title')}
      </h1>
      <p className="mb-6 mt-0 text-[13px] text-slate-500">
        {dt('member_support_intro')}
      </p>

      {waitingGroup ? (
        <p className="text-sm text-slate-500">{dt('member_support_loading_group')}</p>
      ) : !currentGroupId ? (
        <p className="text-sm text-slate-500">
          {dt('member_support_no_group')}
        </p>
      ) : (
        <>
          <section className="mb-7">
            <h2 className="mb-3 mt-0 text-base font-semibold text-slate-800">
              {dt('member_support_my_requests')}
            </h2>
            {listLoading ? (
              <p className="text-sm text-slate-500">{dt('member_support_loading_list')}</p>
            ) : sortedTickets.length === 0 ? (
              <p className="m-0 text-sm text-slate-500">
                {dt('member_support_empty_list')}
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {sortedTickets.map((t) => {
                  const hasFirstAnswer =
                    t.answer != null && String(t.answer).trim() !== '';
                  const isPending = t.status === 'pending';
                  const showFollowUpBtn =
                    hasFirstAnswer &&
                    (t.status === 'answered' || t.status === 'closed');
                  const thread = parseMemberSupportMessageThread(t.message_thread);
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="text-[15px] font-bold text-slate-800">
                          {t.title}
                        </div>
                        <span
                          className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold ${
                            isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isPending
                            ? dt('member_support_status_pending')
                            : dt('member_support_status_answered')}
                        </span>
                      </div>
                      <div className="mb-2 text-xs text-slate-400">
                        {new Date(t.created_at).toLocaleString(intlLocaleForLang(lang))}
                      </div>
                      <div
                        className={`whitespace-pre-wrap text-[13px] text-slate-600 ${hasFirstAnswer ? 'mb-3' : 'mb-0'}`}
                      >
                        {t.content}
                      </div>
                      {hasFirstAnswer && (
                        <div
                          className="whitespace-pre-wrap rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800"
                        >
                          <strong className="mb-1.5 block">
                            {dt('member_support_admin_reply')}
                          </strong>
                          {t.answer}
                          {t.answered_at && (
                            <div className="mt-2 text-[11px] text-emerald-600">
                              {dt('member_support_answered_at_prefix')}{' '}
                              {new Date(t.answered_at).toLocaleString(intlLocaleForLang(lang))}
                            </div>
                          )}
                        </div>
                      )}
                      {thread.map((entry, idx) => (
                        <div
                          key={`${entry.created_at}-${idx}`}
                          className={`mt-2.5 whitespace-pre-wrap rounded-[10px] border p-3 text-[13px] ${
                            entry.role === 'member'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          <strong className="mb-1.5 block">
                            {entry.role === 'member'
                              ? dt('member_support_thread_extra')
                              : dt('member_support_admin_reply')}
                          </strong>
                          {entry.body}
                          <div className="mt-2 text-[11px] opacity-85">
                            {new Date(entry.created_at).toLocaleString(intlLocaleForLang(lang))}
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                        {showFollowUpBtn && (
                          <button
                            type="button"
                            onClick={() => {
                              setFollowUpTicketId(t.id);
                              setFollowUpText('');
                            }}
                            className="cursor-pointer rounded-lg border-none bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            {dt('member_support_follow_up')}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          onClick={() => void handleDeleteTicket(t.id)}
                          className={`rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ${
                            deletingId === t.id ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'
                          }`}
                        >
                          {deletingId === t.id ? dt('member_support_deleting') : ct('delete')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border-t border-slate-200 pt-6">
            <h2 className="mb-3.5 mt-0 text-base font-semibold text-slate-800">
              {dt('member_support_new_request')}
            </h2>
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                  {dt('member_support_field_title')}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={dt('member_support_field_title_ph')}
                  maxLength={100}
                  className="w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                  {dt('member_support_field_content')}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={dt('member_support_field_content_ph')}
                  maxLength={1000}
                  rows={6}
                  className="min-h-[140px] w-full resize-y box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitLoading}
                className={`rounded-[10px] border-none bg-orange-500 px-4 py-3 text-[15px] font-bold text-white ${
                  submitLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'
                }`}
              >
                {submitLoading ? dt('member_support_submitting') : dt('member_support_submit')}
              </button>
            </div>
          </section>

          {followUpTicketId && (
            <div
              className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 p-4"
              onClick={() => {
                if (followUpLoading) return;
                setFollowUpTicketId(null);
                setFollowUpText('');
              }}
            >
              <div
                className="w-full max-w-[480px] box-border rounded-xl bg-white p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="mb-3 mt-0 text-[17px] font-bold text-slate-800">
                  {dt('member_support_follow_up')}
                </h3>
                <textarea
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  placeholder={dt('member_support_follow_up_placeholder')}
                  rows={5}
                  maxLength={2000}
                  className="mb-3.5 w-full box-border resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={followUpLoading}
                    onClick={() => {
                      setFollowUpTicketId(null);
                      setFollowUpText('');
                    }}
                    className="rounded-lg border-none bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed"
                  >
                    {ct('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={followUpLoading}
                    onClick={() => void handleFollowUpSubmit()}
                    className={`rounded-lg border-none bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white ${
                      followUpLoading ? 'cursor-not-allowed opacity-75' : 'cursor-pointer opacity-100'
                    }`}
                  >
                    {followUpLoading ? dt('member_support_submitting') : dt('member_support_follow_up_submit')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MemberSupportPage() {
  return (
    <GroupRequiredRouteGuard>
      <MemberSupportPageContent />
    </GroupRequiredRouteGuard>
  );
}
