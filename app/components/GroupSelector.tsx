'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Loader2, Plus, UserPlus, X, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';

const GroupSelector: React.FC = () => {
  const { groups, currentGroupId, currentGroup, loading, setCurrentGroupId, refreshGroups } = useGroup();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 그룹 생성
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('그룹 이름을 입력해주세요.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      // 그룹 생성 (초대 코드는 트리거에서 자동 생성)
      const { data, error: createError } = await supabase
        .from('groups')
        .insert({
          name: groupName.trim(),
          owner_id: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // 소유자를 ADMIN으로 추가 (트리거에서 자동 추가되지만 명시적으로 추가)
      const { error: membershipError } = await supabase
        .from('memberships')
        .insert({
          user_id: user.id,
          group_id: data.id,
          role: 'ADMIN',
        });

      if (membershipError && membershipError.code !== '23505') {
        // 중복 오류는 무시 (트리거에서 이미 추가됨)
        throw membershipError;
      }

      setSuccess('그룹이 생성되었습니다!');
      setGroupName('');
      
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
      setError(err.message || '그룹 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  // 초대 코드로 가입
  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      setError('초대 코드를 입력해주세요.');
      return;
    }

    setJoining(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: joinError } = await supabase.rpc('join_group_by_invite_code', {
        invite_code_param: inviteCode.trim(),
      });

      if (joinError) throw joinError;

      setSuccess('그룹에 가입되었습니다!');
      setInviteCode('');
      
      // 그룹 목록 새로고침
      await refreshGroups();
      
      // 가입한 그룹으로 전환
      if (data) {
        setCurrentGroupId(data);
      }
      
      setTimeout(() => {
        setShowJoinModal(false);
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error('그룹 가입 오류:', err);
      setError(err.message || '그룹 가입에 실패했습니다.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">로딩 중...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <>
        <div className="space-y-2">
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 text-center">
            가입한 그룹이 없습니다.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setError(null);
                setSuccess(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              aria-label="그룹 생성"
            >
              <Plus className="w-4 h-4" />
              그룹 생성
            </button>
            <button
              onClick={() => {
                setShowJoinModal(true);
                setError(null);
                setSuccess(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              aria-label="초대 코드로 가입"
            >
              <UserPlus className="w-4 h-4" />
              초대 코드로 가입
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
                    <h3 className="text-lg font-semibold text-gray-900">새 그룹 생성</h3>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setGroupName('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="닫기"
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
                        placeholder="예: 우리 가족"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={creating}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !creating) {
                            handleCreateGroup();
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
                          setShowCreateModal(false);
                          setGroupName('');
                          setError(null);
                          setSuccess(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={creating}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleCreateGroup}
                        disabled={creating || !groupName.trim()}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          '생성'
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
                    <h3 className="text-lg font-semibold text-gray-900">초대 코드로 가입</h3>
                    <button
                      onClick={() => {
                        setShowJoinModal(false);
                        setInviteCode('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="닫기"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        초대 코드
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
                          setError(null);
                        }}
                        placeholder="초대 코드를 입력하세요"
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
                        취소
                      </button>
                      <button
                        onClick={handleJoinGroup}
                        disabled={joining || !inviteCode.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {joining ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            가입 중...
                          </>
                        ) : (
                          '가입'
                        )}
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
        aria-label="그룹 선택"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Users className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-left font-medium text-gray-900">
          {currentGroup?.name || '그룹 선택'}
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
                      aria-label="초대 코드 복사"
                      title="초대 코드 복사"
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
                  aria-label="그룹 생성"
                >
                  <Plus className="w-4 h-4" />
                  새 그룹 생성
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowJoinModal(true);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors mt-1"
                  aria-label="초대 코드로 가입"
                >
                  <UserPlus className="w-4 h-4" />
                  초대 코드로 가입
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
                    <h3 className="text-lg font-semibold text-gray-900">새 그룹 생성</h3>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setGroupName('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="닫기"
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
                        placeholder="예: 우리 가족"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={creating}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !creating) {
                            handleCreateGroup();
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
                          setShowCreateModal(false);
                          setGroupName('');
                          setError(null);
                          setSuccess(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={creating}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleCreateGroup}
                        disabled={creating || !groupName.trim()}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          '생성'
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
                    <h3 className="text-lg font-semibold text-gray-900">초대 코드로 가입</h3>
                    <button
                      onClick={() => {
                        setShowJoinModal(false);
                        setInviteCode('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="닫기"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        초대 코드
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
                          setError(null);
                        }}
                        placeholder="초대 코드를 입력하세요"
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
                        취소
                      </button>
                      <button
                        onClick={handleJoinGroup}
                        disabled={joining || !inviteCode.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {joining ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            가입 중...
                          </>
                        ) : (
                          '가입'
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

