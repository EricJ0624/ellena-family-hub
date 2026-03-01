'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Loader2, Plus, UserPlus, X, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getOnboardingTranslation, type OnboardingTranslations } from '@/lib/translations/onboarding';
import { getCommonTranslation } from '@/lib/translations/common';
import { getMemberManagementTranslation } from '@/lib/translations/memberManagement';
import type { LangCode } from '@/lib/language-fonts';

const GroupSelector: React.FC = () => {
  const { groups, currentGroupId, currentGroup, loading, setCurrentGroupId, refreshGroups } = useGroup();
  const { lang } = useLanguage();
  const ot = (key: keyof OnboardingTranslations) => getOnboardingTranslation(lang, key);
  const ct = (key: 'loading' | 'close' | 'cancel' | 'save') => getCommonTranslation(lang, key);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPreferredLanguage, setGroupPreferredLanguage] = useState<LangCode>('ko');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createFamilyRole, setCreateFamilyRole] = useState<'' | 'mom' | 'dad'>('');
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [joinFamilyRole, setJoinFamilyRole] = useState<'' | 'son' | 'daughter' | 'other'>('');
  const [showJoinFamilyRoleModal, setShowJoinFamilyRoleModal] = useState(false);

  const mmt = (key: keyof import('@/lib/translations/memberManagement').MemberManagementTranslations) =>
    getMemberManagementTranslation(lang, key);

  // 그룹 생성
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError(ot('error_group_name_required'));
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(ot('error_login_required'));
        setCreating(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(ot('error_login_required'));
      }

      // 초대 코드 생성 (RPC)
      const { data: inviteCodeData, error: codeError } = await supabase.rpc('generate_invite_code');
      if (codeError || !inviteCodeData) {
        throw new Error(ot('error_invite_code_failed'));
      }

      // 그룹 생성 (RPC 함수 사용)
      const { data: groupId, error: createError } = await supabase.rpc('create_group', {
        group_name: groupName.trim(),
        invite_code_param: inviteCodeData,
        owner_id_param: user.id,
      });

      if (createError) throw createError;

      // 생성된 그룹 정보 조회
      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (fetchError) throw fetchError;

      await supabase.from('groups').update({ preferred_language: groupPreferredLanguage }).eq('id', groupId);

      // 그룹 생성자(소유자) 가족 표시 설정 (아빠/엄마)
      if (createFamilyRole && user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch('/api/groups/members/family-role', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({ targetUserId: user.id, groupId: data.id, familyRole: createFamilyRole }),
            });
            if (!res.ok) {
              const err = await res.json();
              console.warn('가족 표시 저장 실패:', err?.error);
            }
          } catch (e) {
            console.warn('가족 표시 저장 실패:', e);
          }
        }
      }

      setSuccess(ot('success_created'));
      setGroupName('');
      setCreateFamilyRole('');
      
      // 그룹 목록 새로고침
      await refreshGroups();
      
      // 새로 생성된 그룹으로 전환
      setCurrentGroupId(data.id);
      
      setTimeout(() => {
        setShowCreateModal(false);
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error('그룹 생성 오류:', err);
      setError(err.message || ot('error_create_failed'));
    } finally {
      setCreating(false);
    }
  };

  // 초대 코드로 가입
  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      setError(ot('error_invite_required'));
      return;
    }

    setJoining(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: joinedGroupIdData, error: joinError } = await supabase.rpc('join_group_by_invite_code', {
        invite_code_param: inviteCode.trim(),
      });

      if (joinError) throw joinError;

      setInviteCode('');
      setSuccess(ot('success_joined'));
      setShowJoinModal(false);

      // 그룹 목록 새로고침
      await refreshGroups();

      // 가입한 그룹 ID 저장 후 가족 표시 선택 모달 표시 (일반 멤버: 아들/딸/기타)
      if (joinedGroupIdData) {
        setJoinedGroupId(joinedGroupIdData);
        setJoinFamilyRole('');
        setShowJoinFamilyRoleModal(true);
        setCurrentGroupId(joinedGroupIdData);
      }
    } catch (err: any) {
      console.error('그룹 가입 오류:', err);
      setError(err.message || ot('error_join_failed'));
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">{ct('loading')}</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <>
        <div className="space-y-2">
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 text-center">
            {ot('no_groups')}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setError(null);
                setSuccess(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              aria-label={ot('create_group')}
            >
              <Plus className="w-4 h-4" />
              {ot('create_group')}
            </button>
            <button
              onClick={() => {
                setShowJoinModal(true);
                setError(null);
                setSuccess(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              aria-label={ot('join_invite')}
            >
              <UserPlus className="w-4 h-4" />
              {ot('join_invite')}
            </button>
          </div>
        </div>

        {/* 그룹 생성 모달 */}
        <AnimatePresence>
          {showCreateModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName('');
                  setError(null);
                  setSuccess(null);
                }}
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{ot('create_group')}</h3>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setGroupName('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label={ct('close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        그룹 이름
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => {
                          setGroupName(e.target.value);
                          setError(null);
                        }}
                        placeholder={ot('group_name_placeholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={creating}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !creating) {
                            handleCreateGroup();
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {ot('display_language')}
                      </label>
                      <select
                        value={groupPreferredLanguage}
                        onChange={(e) => setGroupPreferredLanguage(e.target.value as LangCode)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={creating}
                      >
                        <option value="ko">한국어</option>
                        <option value="en">English</option>
                        <option value="ja">日本語</option>
                        <option value="zh-CN">简体中文</option>
                        <option value="zh-TW">繁體中文</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {mmt('family_role_label')}
                      </label>
                      <select
                        value={createFamilyRole}
                        onChange={(e) => setCreateFamilyRole((e.target.value || '') as '' | 'mom' | 'dad')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={creating}
                      >
                        <option value="">{mmt('family_role_none')}</option>
                        <option value="mom">{mmt('family_role_mom')}</option>
                        <option value="dad">{mmt('family_role_dad')}</option>
                      </select>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {success && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{success}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowCreateModal(false);
                          setGroupName('');
                          setError(null);
                          setSuccess(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={creating}
                      >
                        {ct('cancel')}
                      </button>
                      <button
                        onClick={handleCreateGroup}
                        disabled={creating || !groupName.trim()}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {ot('creating')}
                          </>
                        ) : (
                          ot('create_short')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 초대 코드 입력 모달 */}
        <AnimatePresence>
          {showJoinModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => {
                  setShowJoinModal(false);
                  setInviteCode('');
                  setError(null);
                  setSuccess(null);
                }}
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{ot('join_invite')}</h3>
                    <button
                      onClick={() => {
                        setShowJoinModal(false);
                        setInviteCode('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label={ct('close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {ot('invite_code')}
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
                          setError(null);
                        }}
                        placeholder={ot('invite_placeholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center text-lg tracking-wider"
                        disabled={joining}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !joining) {
                            handleJoinGroup();
                          }
                        }}
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {success && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{success}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowJoinModal(false);
                          setInviteCode('');
                          setError(null);
                          setSuccess(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={joining}
                      >
                        {ct('cancel')}
                      </button>
                      <button
                        onClick={handleJoinGroup}
                        disabled={joining || !inviteCode.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {joining ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {ot('joining')}
                          </>
                        ) : (
                          ot('join_short')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 가입 후 가족 표시 선택 모달 (일반 멤버: 아들/딸/기타) */}
        <AnimatePresence>
          {showJoinFamilyRoleModal && joinedGroupId && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => {
                  setShowJoinFamilyRoleModal(false);
                  setJoinedGroupId(null);
                  setJoinFamilyRole('');
                }}
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{mmt('family_role_label')}</h3>
                    <button
                      onClick={() => {
                        setShowJoinFamilyRoleModal(false);
                        setJoinedGroupId(null);
                        setJoinFamilyRole('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label={ct('close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">가족에서 나를 어떻게 표시할까요? (선택사항)</p>
                  <div className="space-y-4">
                    <select
                      value={joinFamilyRole}
                      onChange={(e) => setJoinFamilyRole((e.target.value || '') as '' | 'son' | 'daughter' | 'other')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">{mmt('family_role_none')}</option>
                      <option value="son">{mmt('family_role_son')}</option>
                      <option value="daughter">{mmt('family_role_daughter')}</option>
                      <option value="other">{mmt('family_role_other')}</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowJoinFamilyRoleModal(false);
                          setJoinedGroupId(null);
                          setJoinFamilyRole('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        {lang === 'ko' ? '건너뛰기' : 'Skip'}
                      </button>
                      <button
                        onClick={async () => {
                          const { data: { user } } = await supabase.auth.getUser();
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!user || !session?.access_token || !joinedGroupId) {
                            setShowJoinFamilyRoleModal(false);
                            setJoinedGroupId(null);
                            return;
                          }
                          if (joinFamilyRole) {
                            try {
                              const res = await fetch('/api/groups/members/family-role', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                body: JSON.stringify({ targetUserId: user.id, groupId: joinedGroupId, familyRole: joinFamilyRole }),
                              });
                              if (!res.ok) console.warn('가족 표시 저장 실패');
                            } catch (e) {
                              console.warn('가족 표시 저장 실패', e);
                            }
                          }
                          setShowJoinFamilyRoleModal(false);
                          setJoinedGroupId(null);
                          setJoinFamilyRole('');
                          await refreshGroups();
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {ct('save')}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full"
        aria-label={ot('select_group')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Users className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-left font-medium text-gray-900">
          {currentGroup?.name || ot('select_group')}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto"
              role="listbox"
            >
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    setCurrentGroupId(group.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    currentGroupId === group.id ? 'bg-purple-50 text-purple-900' : ''
                  }`}
                  role="option"
                  aria-selected={currentGroupId === group.id}
                >
                  <div className="font-medium">{group.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 font-mono">
                      {group.invite_code}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(group.invite_code).then(() => {
                          // 간단한 피드백 (선택사항)
                        }).catch(console.error);
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      aria-label={ot('copy_title')}
                      title={ot('copy_title')}
                    >
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                </button>
              ))}
              <div className="border-t border-gray-200 p-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowCreateModal(true);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors"
aria-label={ot('create_group')}
                  >
                    <Plus className="w-4 h-4" />
                  {ot('create_group')}
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowJoinModal(true);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors mt-1"
                  aria-label={ot('join_invite')}
                >
                  <UserPlus className="w-4 h-4" />
                  {ot('join_invite')}
                </button>
              </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>

        {/* 그룹 생성 모달 (그룹이 있을 때도 사용) */}
        <AnimatePresence>
          {showCreateModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName('');
                  setError(null);
                  setSuccess(null);
                }}
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{ot('create_group')}</h3>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setGroupName('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label={ct('close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        그룹 이름
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => {
                          setGroupName(e.target.value);
                          setError(null);
                        }}
                        placeholder={ot('group_name_placeholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={creating}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !creating) {
                            handleCreateGroup();
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {ot('display_language')}
                      </label>
                      <select
                        value={groupPreferredLanguage}
                        onChange={(e) => setGroupPreferredLanguage(e.target.value as LangCode)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={creating}
                      >
                        <option value="ko">한국어</option>
                        <option value="en">English</option>
                        <option value="ja">日本語</option>
                        <option value="zh-CN">简体中文</option>
                        <option value="zh-TW">繁體中文</option>
                      </select>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {success && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{success}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowCreateModal(false);
                          setGroupName('');
                          setError(null);
                          setSuccess(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={creating}
                      >
                        {ct('cancel')}
                      </button>
                      <button
                        onClick={handleCreateGroup}
                        disabled={creating || !groupName.trim()}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {ot('creating')}
                          </>
                        ) : (
                          ot('create_short')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 초대 코드 입력 모달 (그룹이 있을 때도 사용) */}
        <AnimatePresence>
          {showJoinModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => {
                  setShowJoinModal(false);
                  setInviteCode('');
                  setError(null);
                  setSuccess(null);
                }}
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{ot('join_invite')}</h3>
                    <button
                      onClick={() => {
                        setShowJoinModal(false);
                        setInviteCode('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label={ct('close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {ot('invite_code')}
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
                          setError(null);
                        }}
                        placeholder={ot('invite_placeholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center text-lg tracking-wider"
                        disabled={joining}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !joining) {
                            handleJoinGroup();
                          }
                        }}
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {success && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{success}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowJoinModal(false);
                          setInviteCode('');
                          setError(null);
                          setSuccess(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={joining}
                      >
                        {ct('cancel')}
                      </button>
                      <button
                        onClick={handleJoinGroup}
                        disabled={joining || !inviteCode.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {joining ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {ot('joining')}
                          </>
                        ) : (
                          ot('join_short')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
    </div>
  );
};

export default GroupSelector;

