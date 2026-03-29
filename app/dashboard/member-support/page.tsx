'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import type { LangCode } from '@/lib/language-fonts';
import { getDashboardTranslation, type DashboardTranslations } from '@/lib/translations/dashboard';
import { getCommonTranslation, type CommonTranslations } from '@/lib/translations/common';
import {
  markMemberTicketsSeen,
  removeMemberTicketFromSeen,
  type MemberSupportTicketRow,
} from '@/lib/member-support';
import { parseMemberSupportMessageThread } from '@/lib/member-support-ticket-thread';

function dateLocaleForLang(lang: LangCode): string {
  const map: Record<LangCode, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
  };
  return map[lang];
}

export default function MemberSupportPage() {
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
      <div className="app-container" style={{ padding: '24px 16px' }}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>{dt('member_support_loading_page')}</p>
      </div>
    );
  }

  if (isSystemAdmin || isGroupAdmin) {
    return null;
  }

  const waitingGroup = groupLoading && !currentGroupId;

  return (
    <div className="app-container" style={{ padding: '16px 16px 120px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/dashboard"
          style={{
            fontSize: '14px',
            color: '#2563eb',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          {dt('member_support_back_dashboard')}
        </Link>
      </div>

      <h1
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#1e293b',
          margin: '0 0 8px 0',
        }}
      >
        {dt('member_support_title')}
      </h1>
      <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b' }}>
        {dt('member_support_intro')}
      </p>

      {waitingGroup ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>{dt('member_support_loading_group')}</p>
      ) : !currentGroupId ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          {dt('member_support_no_group')}
        </p>
      ) : (
        <>
          <section style={{ marginBottom: '28px' }}>
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#1e293b',
                margin: '0 0 12px 0',
              }}
            >
              {dt('member_support_my_requests')}
            </h2>
            {listLoading ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>{dt('member_support_loading_list')}</p>
            ) : sortedTickets.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                {dt('member_support_empty_list')}
              </p>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
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
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#1e293b',
                          }}
                        >
                          {t.title}
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            whiteSpace: 'nowrap',
                            backgroundColor: isPending ? '#fef3c7' : '#d1fae5',
                            color: isPending ? '#92400e' : '#065f46',
                          }}
                        >
                          {isPending
                            ? dt('member_support_status_pending')
                            : dt('member_support_status_answered')}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#94a3b8',
                          marginBottom: '8px',
                        }}
                      >
                        {new Date(t.created_at).toLocaleString(dateLocaleForLang(lang))}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#475569',
                          whiteSpace: 'pre-wrap',
                          marginBottom: hasFirstAnswer ? '12px' : 0,
                        }}
                      >
                        {t.content}
                      </div>
                      {hasFirstAnswer && (
                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#ecfdf5',
                            borderRadius: '10px',
                            border: '1px solid #a7f3d0',
                            fontSize: '13px',
                            color: '#065f46',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <strong
                            style={{ display: 'block', marginBottom: '6px' }}
                          >
                            {dt('member_support_admin_reply')}
                          </strong>
                          {t.answer}
                          {t.answered_at && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#059669',
                                marginTop: '8px',
                              }}
                            >
                              {dt('member_support_answered_at_prefix')}{' '}
                              {new Date(t.answered_at).toLocaleString(dateLocaleForLang(lang))}
                            </div>
                          )}
                        </div>
                      )}
                      {thread.map((entry, idx) => (
                        <div
                          key={`${entry.created_at}-${idx}`}
                          style={{
                            marginTop: '10px',
                            padding: '12px',
                            backgroundColor:
                              entry.role === 'member' ? '#fffbeb' : '#ecfdf5',
                            borderRadius: '10px',
                            border:
                              entry.role === 'member'
                                ? '1px solid #fde68a'
                                : '1px solid #a7f3d0',
                            fontSize: '13px',
                            color: entry.role === 'member' ? '#92400e' : '#065f46',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <strong style={{ display: 'block', marginBottom: '6px' }}>
                            {entry.role === 'member'
                              ? dt('member_support_thread_extra')
                              : dt('member_support_admin_reply')}
                          </strong>
                          {entry.body}
                          <div
                            style={{
                              fontSize: '11px',
                              opacity: 0.85,
                              marginTop: '8px',
                            }}
                          >
                            {new Date(entry.created_at).toLocaleString(dateLocaleForLang(lang))}
                          </div>
                        </div>
                      ))}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid #e2e8f0',
                        }}
                      >
                        {showFollowUpBtn && (
                          <button
                            type="button"
                            onClick={() => {
                              setFollowUpTicketId(t.id);
                              setFollowUpText('');
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#fff',
                              backgroundColor: '#0ea5e9',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            {dt('member_support_follow_up')}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          onClick={() => void handleDeleteTicket(t.id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#b91c1c',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            cursor: deletingId === t.id ? 'not-allowed' : 'pointer',
                            opacity: deletingId === t.id ? 0.7 : 1,
                          }}
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

          <section
            style={{
              borderTop: '1px solid #e2e8f0',
              paddingTop: '24px',
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#1e293b',
                margin: '0 0 14px 0',
              }}
            >
              {dt('member_support_new_request')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: '6px',
                  }}
                >
                  {dt('member_support_field_title')}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={dt('member_support_field_title_ph')}
                  maxLength={100}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: '6px',
                  }}
                >
                  {dt('member_support_field_content')}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={dt('member_support_field_content_ph')}
                  maxLength={1000}
                  rows={6}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    resize: 'vertical',
                    minHeight: '140px',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitLoading}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f97316',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: submitLoading ? 'not-allowed' : 'pointer',
                  opacity: submitLoading ? 0.7 : 1,
                }}
              >
                {submitLoading ? dt('member_support_submitting') : dt('member_support_submit')}
              </button>
            </div>
          </section>

          {followUpTicketId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1200,
                padding: '16px',
              }}
              onClick={() => {
                if (followUpLoading) return;
                setFollowUpTicketId(null);
                setFollowUpText('');
              }}
            >
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  padding: '20px',
                  width: '100%',
                  maxWidth: '480px',
                  boxSizing: 'border-box',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#1e293b',
                    margin: '0 0 12px 0',
                  }}
                >
                  {dt('member_support_follow_up')}
                </h3>
                <textarea
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  placeholder={dt('member_support_follow_up_placeholder')}
                  rows={5}
                  maxLength={2000}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    resize: 'vertical',
                    marginBottom: '14px',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={followUpLoading}
                    onClick={() => {
                      setFollowUpTicketId(null);
                      setFollowUpText('');
                    }}
                    style={{
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#475569',
                      backgroundColor: '#e2e8f0',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: followUpLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {ct('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={followUpLoading}
                    onClick={() => void handleFollowUpSubmit()}
                    style={{
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: '#0ea5e9',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: followUpLoading ? 'not-allowed' : 'pointer',
                      opacity: followUpLoading ? 0.75 : 1,
                    }}
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
