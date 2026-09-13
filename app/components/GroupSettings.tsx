'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Copy,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Loader2,
  Mail,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getGroupSettingsTranslation, type GroupSettingsTranslations } from '@/lib/translations/groupSettings';
import { getCommonTranslation } from '@/lib/translations/common';
import {
  DISPLAY_NAME_PENDING_SENTINEL,
  getGroupDisplayNameRaw,
  getGroupSelectorLabel,
  isGroupDisplayNamePending,
} from '@/lib/group-display-name';
import type { TitleStyle } from '@/app/components/TitlePage';
import { resolveUiTheme, type UiTheme } from '@/lib/ui-theme';
import { writeStoredUiTheme } from '@/lib/preferences/ui-theme-cache';
import { refreshAuthBootstrapCache } from '@/lib/auth-bootstrap';
import { GROUP_EMAIL_INVITE_ERROR } from '@/lib/group-email-invite';

interface GroupSettingsProps {
  onClose: () => void;
  forceAdminAccess?: boolean;
}

const DEFAULT_TITLE_STYLE: TitleStyle = {
  content: 'Hearth: Family',
  color: '#9333ea',
  fontSize: 48,
  fontWeight: '700',
  letterSpacing: 0,
  fontFamily: 'Inter',
};

function parseTitleStyle(raw: unknown, fallbackContent: string): TitleStyle {
  if (raw && typeof raw === 'object' && 'content' in (raw as object)) {
    const o = raw as Record<string, unknown>;
    return {
      content: typeof o.content === 'string' ? o.content : fallbackContent,
      color: typeof o.color === 'string' ? o.color : DEFAULT_TITLE_STYLE.color,
      fontSize: typeof o.fontSize === 'number' ? o.fontSize : DEFAULT_TITLE_STYLE.fontSize,
      fontWeight: typeof o.fontWeight === 'string' ? o.fontWeight : DEFAULT_TITLE_STYLE.fontWeight,
      letterSpacing: typeof o.letterSpacing === 'number' ? o.letterSpacing : DEFAULT_TITLE_STYLE.letterSpacing,
      fontFamily: typeof o.fontFamily === 'string' ? o.fontFamily : DEFAULT_TITLE_STYLE.fontFamily,
    };
  }
  return { ...DEFAULT_TITLE_STYLE, content: fallbackContent };
}

const GroupSettings: React.FC<GroupSettingsProps> = ({ onClose, forceAdminAccess = false }) => {
  const { currentGroupId, currentGroup, userRole, isOwner, refreshGroups } = useGroup();
  const { lang } = useLanguage();
  const gst = (key: keyof GroupSettingsTranslations) => getGroupSettingsTranslation(lang, key);
  const ctApp = (key: 'close' | 'app_title') => getCommonTranslation(lang, key);
  const ct = (key: 'close') => getCommonTranslation(lang, key);
  const [groupName, setGroupName] = useState(() =>
    isGroupDisplayNamePending(currentGroup) ? '' : (getGroupDisplayNameRaw(currentGroup) ?? ''),
  );
  const [titleStyle, setTitleStyle] = useState<TitleStyle>(() =>
    parseTitleStyle(
      currentGroup?.title_style,
      getGroupDisplayNameRaw(currentGroup) ?? ctApp('app_title'),
    ),
  );
  const [uiTheme, setUiTheme] = useState<UiTheme>(() =>
    resolveUiTheme((currentGroup as { ui_theme?: unknown } | null)?.ui_theme)
  );
  const [inviteCode, setInviteCode] = useState(currentGroup?.invite_code || '');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [shortInviteCode, setShortInviteCode] = useState<string | null>(null);
  const [shortInviteExpiresAt, setShortInviteExpiresAt] = useState<string | null>(null);
  const [creatingShortInvite, setCreatingShortInvite] = useState(false);
  const [copiedShortInvite, setCopiedShortInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState<boolean>(false);
  const [checkingPermissions, setCheckingPermissions] = useState<boolean>(true);

  // ✅ SECURITY: 시스템 관리자 권한 확인 (시스템 관리자는 모든 그룹의 ADMIN 권한 자동 상속)
  useEffect(() => {
    const checkSystemAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsSystemAdmin(false);
          setCheckingPermissions(false);
          return;
        }

        const { data, error } = await supabase.rpc('is_system_admin', {
          user_id_param: user.id,
        });

        if (!error && data === true) {
          setIsSystemAdmin(true);
        }
      } catch (err) {
        console.error('시스템 관리자 권한 확인 중 오류:', err);
      } finally {
        setCheckingPermissions(false);
      }
    };

    checkSystemAdmin();
  }, []);

  // ✅ SECURITY: 권한 계층 로직 - 그룹 내 실제 역할에만 의존
  // 시스템 관리자 여부와 무관하게 해당 그룹에서 소유자 또는 ADMIN 역할이어야 함
  const isAdmin = forceAdminAccess || userRole === 'ADMIN' || isOwner;

  // currentGroup 변경 시 titleStyle 동기화 (문구·스타일 통합)
  useEffect(() => {
    setTitleStyle(parseTitleStyle(
      currentGroup?.title_style,
      getGroupDisplayNameRaw(currentGroup) ?? ctApp('app_title'),
    ));
  }, [currentGroup?.id, currentGroup?.family_name, currentGroup?.title_style, currentGroup?.name, currentGroup?.display_name_pending]);

  // currentGroup 변경 시 groupName, inviteCode 동기화
  useEffect(() => {
    if (currentGroup) {
      setGroupName(
        isGroupDisplayNamePending(currentGroup)
          ? ''
          : (getGroupDisplayNameRaw(currentGroup) ?? ''),
      );
      setInviteCode(currentGroup.invite_code || '');
      setUiTheme(resolveUiTheme((currentGroup as { ui_theme?: unknown }).ui_theme));
    }
  }, [currentGroup]);

  // 승인형 4자리 초대 코드 로드
  useEffect(() => {
    if (!currentGroupId || !isAdmin) {
      setShortInviteCode(null);
      setShortInviteExpiresAt(null);
      return;
    }
    let cancelled = false;
    const loadShortInvite = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch(
          `/api/group/short-invite-codes?groupId=${encodeURIComponent(currentGroupId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok || cancelled) return;
        const json = await res.json().catch(() => ({}));
        const data = json?.data;
        if (data?.code) {
          setShortInviteCode(String(data.code));
          setShortInviteExpiresAt(typeof data.expires_at === 'string' ? data.expires_at : null);
        } else {
          setShortInviteCode(null);
          setShortInviteExpiresAt(null);
        }
      } catch (err) {
        console.warn('short invite load:', err);
      }
    };
    void loadShortInvite();
    return () => {
      cancelled = true;
    };
  }, [currentGroupId, isAdmin]);

  // 설정 화면에서 선택한 테마를 즉시 미리보기로 반영하고, 닫히면 그룹 저장값으로 복원
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-ui-theme', uiTheme);
    return () => {
      const persistedTheme = resolveUiTheme((currentGroup as { ui_theme?: unknown } | null)?.ui_theme);
      document.documentElement.setAttribute('data-ui-theme', persistedTheme);
    };
  }, [uiTheme, currentGroup]);

  // 그룹 설정 저장
  const handleSave = async () => {
    if (!currentGroupId || !isAdmin) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 그룹 정보 업데이트
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      const trimmedName = groupName.trim();
      const currentDisplayName = getGroupDisplayNameRaw(currentGroup);

      if (trimmedName) {
        if (trimmedName !== currentDisplayName || isGroupDisplayNamePending(currentGroup)) {
          updates.name = trimmedName;
          updates.display_name_pending = false;
          updates.family_name = trimmedName;
        }
        updates.title_style = { ...titleStyle, content: trimmedName };
      } else if (!isGroupDisplayNamePending(currentGroup)) {
        updates.name = DISPLAY_NAME_PENDING_SENTINEL;
        updates.display_name_pending = true;
        updates.family_name = null;
        updates.title_style = { ...titleStyle, content: ctApp('app_title') };
      } else {
        updates.title_style = {
          ...titleStyle,
          content: ctApp('app_title'),
        };
      }
      updates.ui_theme = uiTheme;

      const { error: updateError } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', currentGroupId);

      if (updateError) throw updateError;

      // 미리보기가 아닌 저장 확정 시에만 캐시 (다음 새로고침 선적용)
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      writeStoredUiTheme(authUser?.id, currentGroupId, uiTheme);

      // bootstrap groupRows는 최대 24h 유지 → 테마 변경 후 낡은 kids 시드 방지
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token && authUser?.id) {
        await refreshAuthBootstrapCache(session.access_token, authUser.id);
      }

      setSuccess(gst('save_success'));
      
      // 그룹 목록 새로고침
      await refreshGroups();

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('그룹 설정 저장 오류:', err);
      setError(err.message || gst('save_failed'));
    } finally {
      setSaving(false);
    }
  };

  // 초대 코드 복사
  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setError(gst('copy_failed'));
    }
  };

  // 초대 링크 복사 (가입 + 그룹 가입 한 번에 가능한 URL)
  const handleCopyInviteLink = async () => {
    if (!inviteCode) return;

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${origin}/?invite=${encodeURIComponent(inviteCode)}`;
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('초대 링크 복사 실패:', err);
      setError(gst('copy_failed'));
    }
  };

  // 초대 코드 갱신
  const handleRefreshInviteCode = async () => {
    if (!currentGroupId || !isAdmin) return;

    setRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(gst('session_error'));
        setRefreshing(false);
        return;
      }
      const { data, error: refreshError } = await supabase.rpc('refresh_invite_code', {
        group_id_param: currentGroupId,
        expires_in_days: 30, // 30일 후 만료
      });

      if (refreshError) throw refreshError;

      setInviteCode(data);
      setSuccess(gst('refresh_success'));
      
      // 그룹 목록 새로고침
      await refreshGroups();

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('초대 코드 갱신 오류:', err);
      setError(err.message || gst('refresh_failed'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleEmailInvite = async () => {
    if (!currentGroupId || !isAdmin || inviting) return;
    const email = inviteEmail.trim();
    if (!email) {
      setError(gst('email_invite_invalid_email'));
      return;
    }

    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError(gst('session_error'));
        return;
      }

      const res = await fetch('/api/group/email-invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group_id: currentGroupId, email }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = typeof json.code === 'string' ? json.code : '';
        if (code === GROUP_EMAIL_INVITE_ERROR.USER_NOT_REGISTERED) {
          setError(gst('email_invite_user_not_registered'));
        } else if (code === GROUP_EMAIL_INVITE_ERROR.ALREADY_MEMBER) {
          setError(gst('email_invite_already_member'));
        } else if (code === GROUP_EMAIL_INVITE_ERROR.INVALID_EMAIL) {
          setError(gst('email_invite_invalid_email'));
        } else {
          setError(typeof json.error === 'string' ? json.error : gst('email_invite_failed'));
        }
        return;
      }

      setSuccess(typeof json.message === 'string' ? json.message : gst('email_invite_success'));
      setInviteEmail('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('이메일 초대 오류:', err);
      setError(gst('email_invite_failed'));
    } finally {
      setInviting(false);
    }
  };

  const handleCreateShortInvite = async () => {
    if (!currentGroupId || !isAdmin || creatingShortInvite) return;
    if (shortInviteCode) {
      const ok = window.confirm(gst('short_invite_replaced_warning'));
      if (!ok) return;
    }

    setCreatingShortInvite(true);
    setError(null);
    setSuccess(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError(gst('session_error'));
        return;
      }

      const res = await fetch('/api/group/short-invite-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group_id: currentGroupId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : gst('short_invite_create_failed'));
        return;
      }

      const data = json?.data;
      setShortInviteCode(data?.code ? String(data.code) : null);
      setShortInviteExpiresAt(typeof data?.expires_at === 'string' ? data.expires_at : null);
      setSuccess(gst('short_invite_created'));
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      console.error('short invite create:', err);
      setError(gst('short_invite_create_failed'));
    } finally {
      setCreatingShortInvite(false);
    }
  };

  const handleCopyShortInvite = async () => {
    if (!shortInviteCode) return;
    try {
      await navigator.clipboard.writeText(shortInviteCode);
      setCopiedShortInvite(true);
      setTimeout(() => setCopiedShortInvite(false), 2000);
    } catch (err) {
      console.error('short invite copy:', err);
      setError(gst('copy_failed'));
    }
  };

  if (!currentGroupId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>{gst('select_group_first')}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>{gst('admin_only')}</p>
        <button
          onClick={onClose}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
        >
          {ct('close')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      {/* 헤더 */}
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2 sm:mb-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-lg bg-purple-100 p-2">
            <Settings className="h-6 w-6 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{gst('group_settings_title')}</h2>
            <p className="truncate text-sm text-gray-500">
              {getGroupSelectorLabel(currentGroup, ctApp('app_title'))}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
          aria-label={ct('close')}
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="min-w-0 space-y-6">
        <div className="min-w-0 overflow-x-hidden">
          <table className="w-full table-fixed border-collapse">
            <tbody>
              <tr className="border-b border-slate-200">
                <th
                  className="w-[6.5rem] bg-slate-50 p-2 text-left text-sm font-semibold text-slate-600 sm:w-36 sm:p-3"
                >
                  {gst('group_name')}
                </th>
                <td className="min-w-0 p-2 sm:p-3">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setError(null);
                    }}
                    placeholder={gst('group_name_placeholder')}
                    className="w-full max-w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                    disabled={saving}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {gst('family_name_hint')}
                  </p>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <th
                  className="w-[6.5rem] bg-slate-50 p-2 text-left text-sm font-semibold text-slate-600 sm:w-36 sm:p-3"
                >
                  {gst('dashboard_theme_label')}
                </th>
                <td className="min-w-0 p-2 sm:p-3">
                  <div className="min-w-0 space-y-3">
                    <select
                      value={uiTheme}
                      onChange={(e) => setUiTheme(e.target.value as UiTheme)}
                      disabled={saving}
                      className="w-full max-w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 sm:max-w-xs"
                    >
                      <option value="default">{gst('theme_default_label')}</option>
                      <option value="kids_friendly">{gst('theme_kids_friendly_label')}</option>
                      <option value="highend_glass">{gst('theme_highend_glass_label')}</option>
                    </select>
                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
                      {/* Neo Brutal — 잉크 보더·하드 섀도·플랫 페이스 */}
                      <button
                        type="button"
                        onClick={() => setUiTheme('default')}
                        disabled={saving}
                        aria-pressed={uiTheme === 'default'}
                        className={`min-w-0 overflow-hidden rounded-xl border-2 p-0 text-left transition-[box-shadow,border-color] ${
                          uiTheme === 'default'
                            ? 'border-[#0a0a0a] shadow-[4px_4px_0_0_#0a0a0a]'
                            : 'border-slate-200 shadow-sm hover:border-slate-400'
                        }`}
                      >
                        <div className="bg-[#f4f4f0] bg-[repeating-linear-gradient(-45deg,#f4f4f0_0_23px,#0a0a0a_23px_40px)] p-3">
                          <div className="rounded-[4px] border-[3px] border-[#0a0a0a] bg-[#7dd3fc] p-2.5 shadow-[4px_4px_0_0_#0a0a0a]">
                            <p className="text-sm font-black tracking-tight text-[#0a0a0a]">
                              {gst('theme_default_label')}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-[#0a0a0a]/80">
                              {gst('theme_default_desc')}
                            </p>
                            <div className="mt-2.5 space-y-1.5">
                              <div className="h-2 w-[4.5rem] rounded-[2px] bg-[#0a0a0a]" />
                              <div className="h-1.5 w-full rounded-[2px] bg-[#0a0a0a]/25" />
                              <div className="h-1.5 w-3/4 rounded-[2px] bg-[#0a0a0a]/18" />
                            </div>
                            <div className="mt-2.5 flex gap-1.5" aria-hidden>
                              <span className="h-3.5 w-3.5 border-2 border-[#0a0a0a] bg-[#fce94f] shadow-[2px_2px_0_0_#0a0a0a]" />
                              <span className="h-3.5 w-3.5 border-2 border-[#0a0a0a] bg-[#f9a8d4] shadow-[2px_2px_0_0_#0a0a0a]" />
                              <span className="h-3.5 w-3.5 border-2 border-[#0a0a0a] bg-[#6ee7b7] shadow-[2px_2px_0_0_#0a0a0a]" />
                              <span className="h-3.5 w-3.5 border-2 border-[#0a0a0a] bg-[#fb923c] shadow-[2px_2px_0_0_#0a0a0a]" />
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Family Friendly — 컬러 셸 + 부드러운 불투명 카드 */}
                      <button
                        type="button"
                        onClick={() => setUiTheme('kids_friendly')}
                        disabled={saving}
                        aria-pressed={uiTheme === 'kids_friendly'}
                        className={`min-w-0 overflow-hidden rounded-xl border-2 p-0 text-left transition-[box-shadow,border-color] ${
                          uiTheme === 'kids_friendly'
                            ? 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]'
                            : 'border-slate-200 shadow-sm hover:border-amber-200'
                        }`}
                      >
                        <div className="bg-[radial-gradient(ellipse_90%_70%_at_8%_12%,rgba(34,211,238,0.55)_0%,transparent_58%),radial-gradient(ellipse_80%_60%_at_92%_8%,rgba(244,114,182,0.5)_0%,transparent_55%),radial-gradient(ellipse_70%_55%_at_78%_88%,rgba(251,146,60,0.42)_0%,transparent_52%),linear-gradient(160deg,#312e81_0%,#1e1b4b_38%,#0f172a_72%,#164e63_100%)] p-3">
                          <div className="relative overflow-hidden rounded-2xl bg-[rgba(255,251,235,0.97)] p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.18)] ring-1 ring-white/70">
                            {/* calendar / chat kids emoji accents — inside card */}
                            <img
                              src="/family-calendar/emojis/star.png"
                              alt=""
                              aria-hidden
                              className="pointer-events-none absolute left-2 top-2 z-[1] h-3.5 w-3.5 select-none opacity-90"
                            />
                            <img
                              src="/family-calendar/emojis/earth.png"
                              alt=""
                              aria-hidden
                              className="pointer-events-none absolute right-2 top-1.5 z-[1] h-5 w-5 select-none opacity-90"
                            />
                            <img
                              src="/family-chat/emojis/balloon.png"
                              alt=""
                              aria-hidden
                              className="pointer-events-none absolute bottom-2 right-2 z-[1] h-5 w-5 select-none opacity-90"
                            />
                            <img
                              src="/family-chat/emojis/rocket.png"
                              alt=""
                              aria-hidden
                              className="pointer-events-none absolute right-2 top-[42%] z-[1] h-5 w-5 -translate-y-1/2 rotate-12 select-none opacity-90"
                            />
                            <p className="relative z-[2] pr-6 text-sm font-semibold text-slate-800">
                              {gst('theme_kids_friendly_label')}
                            </p>
                            <p className="relative z-[2] mt-1 text-[11px] leading-snug text-slate-500">
                              {gst('theme_kids_friendly_desc')}
                            </p>
                            <div className="relative z-[2] mt-2.5 space-y-1.5">
                              <div className="h-2.5 w-[4.5rem] rounded-full bg-gradient-to-r from-rose-300 to-amber-300" />
                              <div className="h-1.5 w-full rounded-full bg-sky-200/90" />
                              <div className="h-1.5 w-3/4 rounded-full bg-violet-200/80" />
                            </div>
                            <div
                              className="relative z-[2] mt-2.5 flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#d4c8fc]/70 via-[#f3d0fe]/60 to-[#fecdd3]/70 px-2 py-1.5"
                              aria-hidden
                            >
                              <img
                                src="/family-calendar/emojis/palette.png"
                                alt=""
                                className="h-4 w-4 shrink-0 object-contain"
                              />
                              <img
                                src="/family-chat/emojis/cake.png"
                                alt=""
                                className="h-4 w-4 shrink-0 object-contain"
                              />
                              <div className="h-1.5 flex-1 rounded-full bg-white/85" />
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* High-end Glass — 인디고 셸 + 글래스 패널 */}
                      <button
                        type="button"
                        onClick={() => setUiTheme('highend_glass')}
                        disabled={saving}
                        aria-pressed={uiTheme === 'highend_glass'}
                        className={`min-w-0 overflow-hidden rounded-xl border-2 p-0 text-left transition-[box-shadow,border-color] ${
                          uiTheme === 'highend_glass'
                            ? 'border-cyan-300/80 shadow-[0_0_0_3px_rgba(165,243,252,0.28)]'
                            : 'border-slate-200 shadow-sm hover:border-indigo-300'
                        }`}
                      >
                        <div className="relative overflow-hidden bg-[radial-gradient(ellipse_85%_65%_at_12%_14%,rgba(129,140,248,0.28)_0%,transparent_58%),radial-gradient(ellipse_75%_55%_at_88%_12%,rgba(34,211,238,0.2)_0%,transparent_55%),radial-gradient(ellipse_70%_50%_at_68%_90%,rgba(167,139,250,0.22)_0%,transparent_52%),linear-gradient(165deg,#1e1b4b_0%,#151348_42%,#0f172a_100%)] p-3">
                          {/* soft orbs so translucency reads through the glass panel */}
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -left-4 top-2 h-16 w-16 rounded-full bg-indigo-400/35 blur-2xl"
                          />
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -right-2 bottom-1 h-14 w-14 rounded-full bg-cyan-400/30 blur-2xl"
                          />
                          <div className="relative rounded-xl border border-white/20 bg-white/[0.06] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(255,255,255,0.1),0_16px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
                            <p className="text-sm font-semibold text-white">
                              {gst('theme_highend_glass_label')}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-white/70">
                              {gst('theme_highend_glass_desc')}
                            </p>
                            <div className="mt-2.5 space-y-1.5">
                              <div className="h-2 w-[4.5rem] rounded-md bg-cyan-200/60" />
                              <div className="h-6 w-full rounded-lg border border-white/15 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-sm" />
                              <div className="h-4 w-3/4 rounded-lg border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-sm" />
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {gst('dashboard_theme_hint')}
                    </p>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <th
                  className="w-[6.5rem] bg-slate-50 p-2 text-left text-sm font-semibold text-slate-600 align-top sm:w-36 sm:p-3"
                >
                  {gst('invite_code')}
                </th>
                <td className="min-w-0 p-2 sm:p-3">
                  <div className="flex min-w-0 flex-col gap-4">
                    {/* 복사 버튼 + 안내 (다른 버튼들과 왼쪽 정렬) */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleCopyInviteCode}
                        className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg border-none bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                        aria-label={gst('invite_copy_aria')}
                      >
                        {copied ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            {gst('copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            {gst('copy_btn')}
                          </>
                        )}
                      </button>
                      <p className="m-0 text-xs text-slate-500">
                        {gst('invite_share_hint')}
                      </p>
                    </div>
                    {/* 초대 코드 입력창 */}
                    <div className="flex flex-wrap items-center">
                      <input
                        type="text"
                        value={inviteCode}
                        readOnly
                        className="w-full max-w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-mono text-base tracking-[0.12em] sm:max-w-xs"
                      />
                    </div>
                    {/* 초대 링크 복사 + 안내 */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleCopyInviteLink}
                        className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg border-none bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                        aria-label={gst('invite_link_copy_aria')}
                      >
                        {copiedLink ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            {gst('copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            {gst('invite_link_copy_btn')}
                          </>
                        )}
                      </button>
                      <p className="m-0 text-xs font-medium text-amber-700">
                        {gst('invite_only_family_hint')}
                      </p>
                    </div>
                    {/* 갱신 + 안내 */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleRefreshInviteCode}
                        disabled={refreshing}
                        className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg border-none bg-violet-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={gst('invite_refresh_aria')}
                      >
                        {refreshing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {gst('refresh_btn')}
                      </button>
                      <p className="m-0 text-xs font-medium text-purple-600">
                        {gst('invite_refresh_hint')}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <th
                  className="w-[6.5rem] bg-slate-50 p-2 text-left text-sm font-semibold text-slate-600 align-top sm:w-36 sm:p-3"
                >
                  {gst('short_invite_label')}
                </th>
                <td className="min-w-0 p-2 sm:p-3">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => void handleCreateShortInvite()}
                        disabled={creatingShortInvite}
                        className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg border-none bg-amber-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={gst('short_invite_create_btn')}
                      >
                        {creatingShortInvite ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {creatingShortInvite
                          ? gst('short_invite_creating')
                          : gst('short_invite_create_btn')}
                      </button>
                      <p className="m-0 text-xs text-slate-500">{gst('short_invite_hint')}</p>
                    </div>
                    {shortInviteCode ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={shortInviteCode}
                          readOnly
                          className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-mono text-lg tracking-[0.2em]"
                          aria-label={gst('short_invite_label')}
                        />
                        <button
                          type="button"
                          onClick={() => void handleCopyShortInvite()}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-blue-700"
                        >
                          {copiedShortInvite ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              {gst('copied')}
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              {gst('short_invite_copy_btn')}
                            </>
                          )}
                        </button>
                        {shortInviteExpiresAt ? (
                          <p className="m-0 text-xs text-slate-500">
                            {gst('short_invite_expires')}:{' '}
                            {new Date(shortInviteExpiresAt).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="m-0 text-xs font-medium text-slate-500">
                        {gst('short_invite_none')}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <th
                  className="w-[6.5rem] bg-slate-50 p-2 text-left text-sm font-semibold text-slate-600 align-top sm:w-36 sm:p-3"
                >
                  {gst('email_invite_label')}
                </th>
                <td className="min-w-0 p-2 sm:p-3">
                  <div className="flex max-w-full min-w-0 flex-col gap-2 sm:max-w-md">
                    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => {
                          setInviteEmail(e.target.value);
                          setError(null);
                        }}
                        placeholder={gst('email_invite_placeholder')}
                        disabled={inviting}
                        className="min-w-0 w-full flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                        autoComplete="email"
                      />
                      <button
                        type="button"
                        onClick={() => void handleEmailInvite()}
                        disabled={inviting || !inviteEmail.trim()}
                        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {inviting ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Mail className="h-4 w-4" aria-hidden />
                        )}
                        {inviting ? gst('email_invite_sending') : gst('email_invite_btn')}
                      </button>
                    </div>
                    <p className="m-0 text-xs text-slate-500">{gst('email_invite_hint')}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 성공 메시지 */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
            disabled={saving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {gst('saving')}
              </>
            ) : (
              gst('save_btn')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupSettings;

