'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserX, Settings, X, Crown, User, Loader2, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import type { MembershipRole } from '@/types/db';
import GroupSettings from './GroupSettings';

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
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState<boolean>(false);

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

  // 멤버 역할 변경
  const handleUpdateRole = useCallback(async (memberUserId: string, newRole: MembershipRole) => {
    if (!currentGroupId || !isAdmin) return;

    try {
      setUpdatingRoleUserId(memberUserId);

      // 본인은 역할 변경 불가
      if (currentUserId && currentUserId === memberUserId) {
        alert('자기 자신의 역할은 변경할 수 없습니다.');
        setUpdatingRoleUserId(null);
        return;
      }

      // 소유자는 역할 변경 불가
      if (currentGroup?.owner_id === memberUserId) {
        alert('그룹 소유자의 역할은 변경할 수 없습니다.');
        setUpdatingRoleUserId(null);
        return;
      }

      // 현재 사용자 인증 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        setUpdatingRoleUserId(null);
        return;
      }

      // API 호출
      const response = await fetch('/api/groups/members/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: memberUserId,
          groupId: currentGroupId,
          newRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '역할 변경에 실패했습니다.');
      }

      alert(data.message || `멤버 역할이 ${newRole === 'ADMIN' ? '관리자' : '멤버'}로 변경되었습니다.`);

      // 멤버 목록 새로고침
      await loadMembers();
      await refreshMemberships();
    } catch (err: any) {
      console.error('역할 변경 실패:', err);
      alert(err.message || '역할 변경에 실패했습니다.');
    } finally {
      setUpdatingRoleUserId(null);
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
    <div className="w-full max-w-5xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {currentGroup?.name || '가족 멤버'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">총 {members.length}명</span>
                <span className="text-xs font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                  {isAdmin ? '관리자 권한' : '멤버 권한'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowGroupSettings(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                aria-label="그룹 설정"
              >
                <Settings className="w-4 h-4" />
                그룹 설정
              </button>
            )}
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
        </div>

        {/* 권한 안내 */}
        <div
          className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl"
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                    이메일
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                    닉네임
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                    역할
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                    가입일
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => {
                  const isCurrentUser = currentUserId === member.user_id;
                  const isOwner = member.user_id === currentGroup?.owner_id;
                  const canRemove = isAdmin && !isCurrentUser && !isOwner;
                  const canChangeRole = isAdmin && !isCurrentUser && !isOwner;
                  const isUpdatingRole = updatingRoleUserId === member.user_id;
                  const roleLabel = isOwner ? '소유자' : member.role === 'ADMIN' ? '관리자' : '멤버';

                  return (
                    <motion.tr
                      key={member.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: '12px', fontSize: '14px', color: '#1e293b' }}>
                        {member.email || '-'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#1e293b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{member.nickname || '-'}</span>
                          {isCurrentUser && <span style={{ fontSize: '12px', color: '#64748b' }}>(나)</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#1e293b' }}>
                        {roleLabel}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#64748b' }}>
                        {new Date(member.joined_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {(canRemove || canChangeRole) && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            {canChangeRole && (
                              <>
                                {member.role === 'MEMBER' ? (
                                  <button
                                    onClick={() => {
                                      if (confirm(`${member.nickname || member.email}님을 관리자로 승격시키시겠습니까?`)) {
                                        handleUpdateRole(member.user_id, 'ADMIN');
                                      }
                                    }}
                                    disabled={isUpdatingRole || removingUserId === member.user_id}
                                    style={{
                                      padding: '6px',
                                      color: '#7c3aed',
                                      backgroundColor: 'transparent',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    aria-label={`${member.nickname || member.email} 관리자로 승격`}
                                    title="관리자로 승격"
                                  >
                                    {isUpdatingRole ? (
                                      <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                      <Shield style={{ width: '18px', height: '18px' }} />
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (confirm(`${member.nickname || member.email}님의 관리자 권한을 일반 멤버로 변경하시겠습니까?`)) {
                                        handleUpdateRole(member.user_id, 'MEMBER');
                                      }
                                    }}
                                    disabled={isUpdatingRole || removingUserId === member.user_id}
                                    style={{
                                      padding: '6px',
                                      color: '#475569',
                                      backgroundColor: 'transparent',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    aria-label={`${member.nickname || member.email} 일반 멤버로 변경`}
                                    title="일반 멤버로 변경"
                                  >
                                    {isUpdatingRole ? (
                                      <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                      <User style={{ width: '18px', height: '18px' }} />
                                    )}
                                  </button>
                                )}
                              </>
                            )}
                            {canRemove && (
                              <>
                                {showConfirmRemove === member.user_id ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                      onClick={() => handleRemoveMember(member.user_id)}
                                      disabled={removingUserId === member.user_id || isUpdatingRole}
                                      style={{
                                        padding: '6px 10px',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                      aria-label={`${member.nickname || member.email} 추방 확인`}
                                    >
                                      {removingUserId === member.user_id ? (
                                        <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                                      ) : (
                                        '확인'
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setShowConfirmRemove(null)}
                                      style={{
                                        padding: '6px 10px',
                                        backgroundColor: '#e2e8f0',
                                        color: '#334155',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                      aria-label="취소"
                                    >
                                      취소
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowConfirmRemove(member.user_id)}
                                    disabled={isUpdatingRole}
                                    style={{
                                      padding: '6px',
                                      color: '#dc2626',
                                      backgroundColor: 'transparent',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    aria-label={`${member.nickname || member.email} 추방`}
                                  >
                                    <UserX style={{ width: '18px', height: '18px' }} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}

                {members.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      멤버가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 그룹 설정 모달 */}
        <AnimatePresence>
          {showGroupSettings && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowGroupSettings(false)}
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
                  <GroupSettings onClose={() => setShowGroupSettings(false)} />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MemberManagement;

