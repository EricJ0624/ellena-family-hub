'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserX, Settings, X, Crown, User, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import type { MembershipRole } from '@/types/db';

interface MemberInfo {
  user_id: string;
  role: MembershipRole;
  joined_at: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

interface MemberManagementProps {
  onClose?: () => void;
}

const MemberManagement: React.FC<MemberManagementProps> = ({ onClose }) => {
  const { currentGroupId, currentGroup, userRole, isOwner, refreshMemberships } = useGroup();
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showConfirmRemove, setShowConfirmRemove] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isAdmin = userRole === 'ADMIN' || isOwner;

  // 현재 사용자 ID 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  // 멤버 목록 로드
  const loadMembers = useCallback(async () => {
    if (!currentGroupId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 그룹 멤버 조회 (뷰 사용 또는 직접 조인)
      const { data: membershipData, error: membershipError } = await supabase
        .from('memberships')
        .select('user_id, role, joined_at')
        .eq('group_id', currentGroupId)
        .order('joined_at', { ascending: true });

      if (membershipError) throw membershipError;

      if (!membershipData || membershipData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // 프로필 정보 조회
      const userIds = membershipData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, nickname, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.warn('프로필 조회 실패:', profilesError);
      }

      // 멤버 정보 결합
      const memberList: MemberInfo[] = membershipData.map((membership) => {
        const profile = profilesData?.find(p => p.id === membership.user_id);
        return {
          user_id: membership.user_id,
          role: membership.role as MembershipRole,
          joined_at: membership.joined_at,
          email: profile?.email || null,
          nickname: profile?.nickname || null,
          avatar_url: profile?.avatar_url || null,
        };
      });

      setMembers(memberList);
    } catch (err: any) {
      console.error('멤버 목록 로드 실패:', err);
      setError(err.message || '멤버 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [currentGroupId]);

  // 멤버 추방
  const handleRemoveMember = useCallback(async (memberUserId: string) => {
    if (!currentGroupId || !isAdmin) return;

    try {
      setRemovingUserId(memberUserId);

      // 본인은 추방 불가
      if (currentUserId && currentUserId === memberUserId) {
        alert('자신을 추방할 수 없습니다.');
        setRemovingUserId(null);
        setShowConfirmRemove(null);
        return;
      }

      // 소유자는 추방 불가
      if (currentGroup?.owner_id === memberUserId) {
        alert('그룹 소유자는 추방할 수 없습니다.');
        setRemovingUserId(null);
        setShowConfirmRemove(null);
        return;
      }

      const { error: removeError } = await supabase
        .from('memberships')
        .delete()
        .eq('user_id', memberUserId)
        .eq('group_id', currentGroupId);

      if (removeError) throw removeError;

      // 멤버 목록 새로고침
      await loadMembers();
      await refreshMemberships();

      setShowConfirmRemove(null);
    } catch (err: any) {
      console.error('멤버 추방 실패:', err);
      alert(err.message || '멤버 추방에 실패했습니다.');
    } finally {
      setRemovingUserId(null);
    }
  }, [currentGroupId, isAdmin, currentGroup, currentUserId, loadMembers, refreshMemberships]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Realtime 구독 (멤버 변경 감지)
  useEffect(() => {
    if (!currentGroupId) return;

    const channel = supabase
      .channel(`memberships_${currentGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memberships',
          filter: `group_id=eq.${currentGroupId}`,
        },
        () => {
          loadMembers();
          refreshMemberships();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentGroupId, loadMembers, refreshMemberships]);

  if (!currentGroupId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>그룹을 선택해주세요.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {currentGroup?.name || '가족 멤버'}
            </h2>
            <p className="text-sm text-gray-500">
              총 {members.length}명의 멤버
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* 권한 안내 */}
      <div
        className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">현재 권한: {isAdmin ? '관리자' : '멤버'}</p>
            <p>
              {isAdmin
                ? '관리자는 멤버를 추방하고 그룹 설정을 변경할 수 있습니다.'
                : '멤버는 목록을 조회할 수 있습니다.'}
            </p>
          </div>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <span className="ml-3 text-gray-600">멤버 목록을 불러오는 중...</span>
        </div>
      )}

      {/* 에러 상태 */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 멤버 목록 */}
      {!loading && !error && (
        <div className="space-y-3">
          <AnimatePresence>
            {members.map((member, index) => {
              const isCurrentUser = currentUserId === member.user_id;
              const canRemove = isAdmin && !isCurrentUser && member.user_id !== currentGroup?.owner_id;

              return (
                <motion.div
                  key={member.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* 아바타 */}
                    <div className="relative">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.nickname || member.email || '멤버'}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                          {(member.nickname || member.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {member.role === 'ADMIN' && (
                        <div
                          className="absolute -top-1 -right-1 p-1 bg-yellow-400 rounded-full"
                          aria-label="관리자"
                        >
                          <Crown className="w-3 h-3 text-yellow-900" />
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">
                          {member.nickname || member.email || '이름 없음'}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-gray-500">(나)</span>
                          )}
                        </p>
                        {member.user_id === currentGroup?.owner_id && (
                          <span
                            className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full"
                            aria-label="그룹 소유자"
                          >
                            소유자
                          </span>
                        )}
                        {member.role === 'ADMIN' && member.user_id !== currentGroup?.owner_id && (
                          <span
                            className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full"
                            aria-label="관리자"
                          >
                            관리자
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{member.email}</p>
                      <p className="text-xs text-gray-400">
                        가입일: {new Date(member.joined_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  {canRemove && (
                    <div className="flex items-center gap-2">
                      {showConfirmRemove === member.user_id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            disabled={removingUserId === member.user_id}
                            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label={`${member.nickname || member.email} 추방 확인`}
                          >
                            {removingUserId === member.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '확인'
                            )}
                          </button>
                          <button
                            onClick={() => setShowConfirmRemove(null)}
                            className="px-3 py-1.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            aria-label="취소"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowConfirmRemove(member.user_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label={`${member.nickname || member.email} 추방`}
                        >
                          <UserX className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {members.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>멤버가 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 관리자 액션 버튼 */}
      {isAdmin && (
        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            aria-label="그룹 설정"
          >
            <Settings className="w-5 h-5" />
            그룹 설정
          </button>
        </div>
      )}
    </div>
  );
};

export default MemberManagement;

