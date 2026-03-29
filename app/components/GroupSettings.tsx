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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getGroupSettingsTranslation, type GroupSettingsTranslations } from '@/lib/translations/groupSettings';
import { getCommonTranslation } from '@/lib/translations/common';
import { ThemePicker } from '@/app/components/ThemePicker';
import type { TitleStyle } from '@/app/components/TitlePage';
import type { LangCode } from '@/lib/language-fonts';

interface GroupSettingsProps {
  onClose: () => void;
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

const GroupSettings: React.FC<GroupSettingsProps> = ({ onClose }) => {
  const { currentGroupId, currentGroup, userRole, isOwner, refreshGroups } = useGroup();
  const { lang } = useLanguage();
  const gst = (key: keyof GroupSettingsTranslations) => getGroupSettingsTranslation(lang, key);
  const ct = (key: 'close') => getCommonTranslation(lang, key);
  const [groupName, setGroupName] = useState(currentGroup?.name || '');
  const [titleStyle, setTitleStyle] = useState<TitleStyle>(() =>
    parseTitleStyle(currentGroup?.title_style, currentGroup?.family_name ?? 'Hearth: Family Haven')
  );
  const [preferredLanguage, setPreferredLanguage] = useState<LangCode>(() => {
    const v = (currentGroup as { preferred_language?: string } | null)?.preferred_language;
    if (v === 'ko' || v === 'en' || v === 'ja' || v === 'zh-CN' || v === 'zh-TW') return v;
    return 'ko';
  });
  const [inviteCode, setInviteCode] = useState(currentGroup?.invite_code || '');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
  const isAdmin = userRole === 'ADMIN' || isOwner;

  // currentGroup 변경 시 titleStyle 동기화 (문구·스타일 통합)
  useEffect(() => {
    setTitleStyle(parseTitleStyle(
      currentGroup?.title_style,
      currentGroup?.family_name ?? 'Hearth: Family Haven'
    ));
  }, [currentGroup?.id, currentGroup?.family_name, currentGroup?.title_style]);

  // currentGroup 변경 시 groupName, inviteCode, preferredLanguage 동기화
  useEffect(() => {
    if (currentGroup) {
      setGroupName(currentGroup.name || '');
      setInviteCode(currentGroup.invite_code || '');
      const v = (currentGroup as { preferred_language?: string }).preferred_language;
      if (v === 'ko' || v === 'en' || v === 'ja' || v === 'zh-CN' || v === 'zh-TW') setPreferredLanguage(v);
    }
  }, [currentGroup]);

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

      if (groupName.trim() !== currentGroup?.name) {
        updates.name = groupName.trim();
      }

      // 문구·스타일 통합: title_style.content를 family_name과 동기화
      updates.family_name = titleStyle.content?.trim() || null;
      updates.title_style = titleStyle;
      updates.preferred_language = preferredLanguage;

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

  if (!currentGroupId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/80" />
        <p>{gst('select_group_first')}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/80" />
        <p>{gst('admin_only')}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
        >
          {ct('close')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 text-foreground">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary/15 rounded-lg shrink-0">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-foreground">{gst('group_settings_title')}</h2>
            <p className="text-sm text-muted-foreground">
              {currentGroup?.name || gst('group_settings_title')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          <ThemePicker className="flex-wrap justify-end" />
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label={ct('close')}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-border">
                <th className="p-3 text-left text-sm font-semibold text-muted-foreground w-40 bg-muted align-top">
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
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                    disabled={saving}
                  />
                </td>
              </tr>
              <tr className="border-b border-border">
                <th className="p-3 text-left text-sm font-semibold text-muted-foreground w-40 bg-muted align-top">
                  {gst('dashboard_title_label')}
                </th>
                <td className="p-3">
                  <input
                    type="text"
                    value={titleStyle.content ?? ''}
                    onChange={(e) => setTitleStyle((prev) => ({ ...prev, content: e.target.value }))}
                    disabled={saving}
                    placeholder={gst('dashboard_title_placeholder')}
                    className="w-full max-w-[320px] px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {gst('dashboard_title_hint')}
                  </p>
                </td>
              </tr>
              <tr className="border-b border-border">
                <th className="p-3 text-left text-sm font-semibold text-muted-foreground w-40 bg-muted align-top">
                  {gst('display_language')}
                </th>
                <td className="p-3">
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as LangCode)}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm min-w-[160px]"
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="zh-CN">简体中文</option>
                    <option value="zh-TW">繁體中文</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {gst('language_hint')}
                  </p>
                </td>
              </tr>
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-muted-foreground bg-muted align-top">
                  {gst('invite_code')}
                </th>
                <td className="p-3">
                  <div className="flex flex-col gap-4">
                    {/* 복사 버튼 + 안내 (다른 버튼들과 왼쪽 정렬) */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleCopyInviteCode}
                        className="inline-flex items-center gap-1.5 self-start px-3 py-2 rounded-lg text-[13px] font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                        aria-label={gst('invite_copy_aria')}
                      >
                        {copied ? (
                          <>
                            <CheckCircle style={{ width: '16px', height: '16px' }} />
                            {gst('copied')}
                          </>
                        ) : (
                          <>
                            <Copy style={{ width: '16px', height: '16px' }} />
                            {gst('copy_btn')}
                          </>
                        )}
                      </button>
                      <p className="text-xs text-muted-foreground m-0">
                        {gst('invite_share_hint')}
                      </p>
                    </div>
                    {/* 초대 코드 입력창 */}
                    <div className="flex items-center flex-wrap">
                      <input
                        type="text"
                        value={inviteCode}
                        readOnly
                        className="min-w-[220px] max-w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground font-mono text-center text-base tracking-wider"
                      />
                    </div>
                    {/* 초대 링크 복사 + 안내 */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleCopyInviteLink}
                        className="inline-flex items-center gap-1.5 self-start px-3 py-2 rounded-lg text-[13px] font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                        aria-label={gst('invite_link_copy_aria')}
                      >
                        {copiedLink ? (
                          <>
                            <CheckCircle style={{ width: '16px', height: '16px' }} />
                            {gst('copied')}
                          </>
                        ) : (
                          <>
                            <Copy style={{ width: '16px', height: '16px' }} />
                            {gst('invite_link_copy_btn')}
                          </>
                        )}
                      </button>
                      <p className="text-xs text-primary m-0 font-medium">
                        {gst('invite_only_family_hint')}
                      </p>
                    </div>
                    {/* 갱신 + 안내 */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleRefreshInviteCode}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 self-start px-3 py-2 rounded-lg text-[13px] font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
                        aria-label={gst('invite_refresh_aria')}
                      >
                        {refreshing ? (
                          <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <RefreshCw style={{ width: '16px', height: '16px' }} />
                        )}
                        {gst('refresh_btn')}
                      </button>
                      <p className="text-xs text-primary m-0 font-medium">
                        {gst('invite_refresh_hint')}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 성공 메시지 */}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/10 text-sm text-primary">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
            disabled={saving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !groupName.trim()}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

