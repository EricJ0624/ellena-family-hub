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
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
              {currentGroup?.name || gst('group_settings_title')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={ct('close')}
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-6">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    width: '160px',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  {gst('group_name')}
                </th>
                <td style={{ padding: '12px' }}>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setError(null);
                    }}
                    placeholder={gst('group_name_placeholder')}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                    disabled={saving}
                  />
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    width: '160px',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  {gst('dashboard_title_label')}
                </th>
                <td style={{ padding: '12px' }}>
                  <input
                    type="text"
                    value={titleStyle.content ?? ''}
                    onChange={(e) => setTitleStyle((prev) => ({ ...prev, content: e.target.value }))}
                    disabled={saving}
                    placeholder={gst('dashboard_title_placeholder')}
                    style={{
                      width: '100%',
                      maxWidth: '320px',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#1e293b',
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    {gst('dashboard_title_hint')}
                  </p>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    width: '160px',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  {gst('display_language')}
                </th>
                <td style={{ padding: '12px' }}>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as LangCode)}
                    disabled={saving}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      minWidth: '160px',
                    }}
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="zh-CN">简体中文</option>
                    <option value="zh-TW">繁體中文</option>
                  </select>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    {gst('language_hint')}
                  </p>
                </td>
              </tr>
              <tr>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  {gst('invite_code')}
                </th>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={inviteCode}
                      readOnly
                      style={{
                        minWidth: '220px',
                        padding: '10px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        textAlign: 'center',
                        fontSize: '16px',
                        letterSpacing: '0.12em',
                        flex: 1,
                      }}
                    />
                    <button
                      onClick={handleCopyInviteCode}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
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
                    <button
                      onClick={handleRefreshInviteCode}
                      disabled={refreshing}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: refreshing ? 0.6 : 1,
                      }}
                      aria-label={gst('invite_refresh_aria')}
                    >
                      {refreshing ? (
                        <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <RefreshCw style={{ width: '16px', height: '16px' }} />
                      )}
                      {gst('refresh_btn')}
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    초대 코드를 복사하여 가족 구성원에게 공유하세요.
                  </p>
                  <p style={{ fontSize: '12px', color: '#9333ea', marginTop: '6px', fontWeight: 500 }}>
                    {gst('invite_refresh_hint')}
                  </p>
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !groupName.trim()}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

