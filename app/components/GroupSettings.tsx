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
import { GROUP_EMAIL_INVITE_ERROR } from '@/lib/group-email-invite';

interface GroupSettingsProps {
  onClose: () => void;
  forceAdminAccess?: boolean;
}

const DEFAULT_TITLE_STYLE: TitleStyle = {
  content: 'Hearth: Family Haven',
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
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{gst('group_settings_title')}</h2>
            <p className="text-sm text-gray-500">
              {getGroupSelectorLabel(currentGroup, ctApp('app_title'))}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
          aria-label={ct('close')}
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-slate-200">
                <th
                  className="w-40 bg-slate-50 p-3 text-left text-sm font-semibold text-slate-600"
                >
                  {gst('group_name')}
                </th>
                <td className="p-3">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setError(null);
                    }}
                    placeholder={gst('group_name_placeholder')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                    disabled={saving}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {gst('family_name_hint')}
                  </p>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <th
                  className="w-40 bg-slate-50 p-3 text-left text-sm font-semibold text-slate-600"
                >
                  {gst('dashboard_theme_label')}
                </th>
                <td className="p-3">
                  <div className="space-y-3">
                    <select
                      value={uiTheme}
                      onChange={(e) => setUiTheme(e.target.value as UiTheme)}
                      disabled={saving}
                      className="min-w-48 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                    >
                      <option value="default">{gst('theme_default_label')}</option>
                      <option value="kids_friendly">{gst('theme_kids_friendly_label')}</option>
                      <option value="highend_glass">{gst('theme_highend_glass_label')}</option>
                    </select>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setUiTheme('default')}
                        disabled={saving}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          uiTheme === 'default'
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-800">{gst('theme_default_label')}</p>
                        <p className="mt-1 text-xs text-slate-500">{gst('theme_default_desc')}</p>
                        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 p-2">
                          <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                            <div className="h-2 w-16 rounded bg-sky-300/80" />
                            <div className="mt-2 h-1.5 w-24 rounded bg-slate-300/80" />
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUiTheme('kids_friendly')}
                        disabled={saving}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          uiTheme === 'kids_friendly'
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-800">{gst('theme_kids_friendly_label')}</p>
                        <p className="mt-1 text-xs text-slate-500">{gst('theme_kids_friendly_desc')}</p>
                        <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-br from-amber-100 via-sky-100 to-rose-100 p-2">
                          <div className="rounded-md border-2 border-amber-300/80 bg-amber-50 p-2 shadow-sm">
                            <div className="h-2 w-16 rounded bg-rose-300" />
                            <div className="mt-2 h-1.5 w-24 rounded bg-sky-300/90" />
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUiTheme('highend_glass')}
                        disabled={saving}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          uiTheme === 'highend_glass'
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-800">{gst('theme_highend_glass_label')}</p>
                        <p className="mt-1 text-xs text-slate-500">{gst('theme_highend_glass_desc')}</p>
                        <div className="mt-3 overflow-hidden rounded-lg border border-white/80 bg-gradient-to-br from-indigo-900 via-fuchsia-800 to-cyan-700 p-2">
                          <div className="rounded-md border border-white/40 bg-white/20 p-2 shadow-[0_12px_24px_rgba(15,23,42,0.35)] backdrop-blur-[12px]">
                            <div className="h-2 w-16 rounded bg-white/80" />
                            <div className="mt-2 h-1.5 w-24 rounded bg-white/50" />
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
              <tr>
                <th
                  className="bg-slate-50 p-3 text-left text-sm font-semibold text-slate-600"
                >
                  {gst('invite_code')}
                </th>
                <td className="p-3">
                  <div className="flex flex-col gap-4">
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
                        className="max-w-full min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-mono text-base tracking-[0.12em]"
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
              <tr>
                <th
                  className="bg-slate-50 p-3 text-left text-sm font-semibold text-slate-600 align-top"
                >
                  {gst('email_invite_label')}
                </th>
                <td className="p-3">
                  <div className="flex flex-col gap-2 max-w-md">
                    <div className="flex flex-wrap items-stretch gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => {
                          setInviteEmail(e.target.value);
                          setError(null);
                        }}
                        placeholder={gst('email_invite_placeholder')}
                        disabled={inviting}
                        className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                        autoComplete="email"
                      />
                      <button
                        type="button"
                        onClick={() => void handleEmailInvite()}
                        disabled={inviting || !inviteEmail.trim()}
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
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

