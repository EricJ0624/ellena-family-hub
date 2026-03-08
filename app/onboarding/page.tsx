'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, Loader2, AlertCircle, CheckCircle, Copy, X, ArrowRight } from 'lucide-react';
import type { LangCode } from '@/lib/language-fonts';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useGroup } from '@/app/contexts/GroupContext';
import { getOnboardingTranslation, type OnboardingTranslations } from '@/lib/translations/onboarding';
import { getMemberManagementTranslation } from '@/lib/translations/memberManagement';
import { getCommonTranslation } from '@/lib/translations/common';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

interface GroupPreview {
  id: string;
  name: string;
  member_count: number;
  invite_code: string;
}

interface UserGroup {
  id: string;
  name: string;
  invite_code: string;
  is_owner: boolean;
  role: 'ADMIN' | 'MEMBER';
}

export default function OnboardingPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const { setCurrentGroupId } = useGroup();
  const ot = (key: keyof OnboardingTranslations) => getOnboardingTranslation(lang, key);
  const mmt = (key: keyof import('@/lib/translations/memberManagement').MemberManagementTranslations) =>
    getMemberManagementTranslation(lang, key);
  const ct = (key: 'save' | 'close' | 'cancel' | 'skip') => getCommonTranslation(lang, key);
  const [fromAdmin, setFromAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'select' | 'create' | 'join' | 'choose-group'>('select');
  const [nickname, setNickname] = useState('');
  
  // 그룹 생성 관련 상태
  const [groupName, setGroupName] = useState('');
  const [groupPreferredLanguage, setGroupPreferredLanguage] = useState<LangCode>('ko');
  const [creating, setCreating] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [inviteCodeConfirmed, setInviteCodeConfirmed] = useState(false);
  
  const [createFamilyRole, setCreateFamilyRole] = useState<'' | 'mom' | 'dad'>('');
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [joinFamilyRole, setJoinFamilyRole] = useState<'' | 'son' | 'daughter' | 'other'>('');
  const [showJoinFamilyRoleModal, setShowJoinFamilyRoleModal] = useState(false);

  // 초대 코드 가입 관련 상태
  const [inviteCode, setInviteCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [joining, setJoining] = useState(false);
  const [groupPreview, setGroupPreview] = useState<GroupPreview | null>(null);
  
  // 사용자 그룹 목록 (로그인 시 선택용)
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  
  // 에러 및 성공 메시지
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 가입 버튼 연타 방지 (가입 성공 후 두 번째 요청이 'Already a member'로 에러 뜨는 것 방지)
  const joinInProgressRef = useRef(false);

  // 초기화: 사용자 정보 및 그룹 확인
  useEffect(() => {
    const initialize = async () => {
      try {
        const fromAdminParam =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('from') === 'admin'
            : false;
        setFromAdmin(fromAdminParam);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/');
          return;
        }

        // 시스템 관리자 확인
        const { data: isAdmin } = await supabase.rpc('is_system_admin', {
          user_id_param: user.id,
        });

        // 사용자의 모든 그룹 조회
        const { data: memberships } = await supabase
          .from('memberships')
          .select('group_id, role, groups(id, name, invite_code, owner_id)')
          .eq('user_id', user.id);

        // 그룹 소유자 확인
        const { data: ownedGroups } = await supabase
          .from('groups')
          .select('id, name, invite_code, owner_id')
          .eq('owner_id', user.id);

        // 모든 그룹 합치기 (중복 제거)
        const allGroups: UserGroup[] = [];
        const groupIds = new Set<string>();

        // 소유한 그룹 추가
        if (ownedGroups) {
          ownedGroups.forEach((group: any) => {
            if (!groupIds.has(group.id)) {
              groupIds.add(group.id);
              allGroups.push({
                id: group.id,
                name: group.name,
                invite_code: group.invite_code,
                is_owner: true,
                role: 'ADMIN',
              });
            }
          });
        }

        // 멤버십 그룹 추가
        if (memberships) {
          memberships.forEach((membership: any) => {
            const group = membership.groups;
            if (group && !groupIds.has(group.id)) {
              groupIds.add(group.id);
              allGroups.push({
                id: group.id,
                name: group.name,
                invite_code: group.invite_code,
                is_owner: group.owner_id === user.id,
                role: membership.role,
              });
            }
          });
        }

        if (allGroups.length > 0 && !fromAdminParam) {
          // 그룹이 있으면 선택 화면 표시 (1개여도 선택 화면 표시)
          setUserGroups(allGroups);
          setStep('choose-group');
          setLoading(false);
          return;
        }

        // 시스템 관리자이고 그룹이 없으면 관리자 페이지로
        // 단, 관리자 페이지에서 온보딩으로 들어온 경우는 허용
        if (isAdmin && !fromAdminParam) {
          router.push('/admin');
          return;
        }

        // 프로필에서 닉네임 가져오기
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single();

        if (profile?.nickname) {
          setNickname(profile.nickname);
          setGroupName(`${profile.nickname}의 가족`);
        } else {
          const emailNickname = user.email?.split('@')[0] || '사용자';
          setNickname(emailNickname);
          setGroupName(`${emailNickname}의 가족`);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('온보딩 초기화 오류:', err);
        setError(ot('error_init'));
        setLoading(false);
      }
    };

    initialize();
  }, [router]);

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
        router.push('/');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(ot('error_login_required'));
      }

      // 디버깅: PostgreSQL 세션에서 auth.uid() 값 확인
      const { data: debugUid, error: debugError } = await supabase.rpc('debug_get_auth_uid');
      console.log('🔍 [DEBUG] PostgreSQL 세션에서 auth.uid():', debugUid);
      console.log('🔍 [DEBUG] 클라이언트에서 user.id:', user.id);
      if (debugError) {
        console.error('🔍 [DEBUG] auth.uid() 조회 오류:', debugError);
      }
      if (!debugUid) {
        console.error('🔍 [DEBUG] ⚠️ auth.uid()가 NULL입니다! 이것이 RLS 실패의 원인일 수 있습니다.');
      }

      // 초대 코드 생성 (RPC 함수 호출)
      const { data: inviteCodeData, error: codeError } = await supabase.rpc('generate_invite_code');
      if (codeError) {
        console.error('초대 코드 생성 오류:', codeError);
        throw new Error(ot('error_invite_code_failed'));
      }

      const inviteCode = inviteCodeData || '';
      if (!inviteCode) {
        throw new Error(ot('error_invite_code_failed'));
      }

      // 그룹 생성 (RPC 함수 사용)
      const { data: groupId, error: createError } = await supabase.rpc('create_group', {
        group_name: groupName.trim(),
        invite_code_param: inviteCode,
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

      // 그룹 표시 언어 설정
      await supabase.from('groups').update({ preferred_language: groupPreferredLanguage }).eq('id', data.id);

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
            if (!res.ok) console.warn('가족 표시 저장 실패');
          } catch (e) {
            console.warn('가족 표시 저장 실패', e);
          }
        }
      }

      // 생성된 그룹 정보 설정
      setCreatedGroupId(data.id);
      setCreatedInviteCode(inviteCode); // 생성된 초대 코드 사용
      setSuccess(ot('success_created'));
      setCreateFamilyRole('');
      
      // 초대코드를 확인한 후에만 대시보드로 이동하도록 함
    } catch (err: any) {
      console.error('그룹 생성 오류:', err);
      setError(err.message || ot('error_create_failed'));
    } finally {
      setCreating(false);
    }
  };

  // 초대 코드 검증 (비멤버는 groups RLS로 읽을 수 없으므로 서버 API 사용, service role로 RLS 우회)
  const handleVerifyInviteCode = async () => {
    if (!inviteCode.trim()) {
      setError(ot('error_invite_required'));
      return;
    }

    setVerifying(true);
    setError(null);
    setGroupPreview(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(ot('error_login_required'));
        setVerifying(false);
        return;
      }

      const res = await fetch('/api/group/preview-by-invite-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.id) {
        throw new Error(data.error || ot('error_invalid_invite'));
      }

      setGroupPreview({
        id: data.id,
        name: data.name,
        member_count: data.member_count ?? 0,
        invite_code: data.invite_code,
      });

      setSuccess(ot('success_found'));
    } catch (err: any) {
      console.error('초대 코드 검증 오류:', err);
      setError(err.message || ot('error_verify_failed'));
      setGroupPreview(null);
    } finally {
      setVerifying(false);
    }
  };

  // 초대 코드로 가입
  const handleJoinGroup = async () => {
    if (!groupPreview) {
      setError(ot('error_group_check'));
      return;
    }
    // 연타 방지: 이미 가입 요청 중이면 무시 (두 번째 요청이 'Already a member' 에러로 뜨는 것 방지)
    if (joinInProgressRef.current) return;
    joinInProgressRef.current = true;

    setJoining(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: joinedGroupIdData, error: joinError } = await supabase.rpc('join_group_by_invite_code', {
        invite_code_param: groupPreview.invite_code,
      });

      if (joinError) throw joinError;

      setSuccess(ot('success_joined'));
      const groupId = joinedGroupIdData ?? groupPreview.id;
      if (groupId) {
        setJoinedGroupId(groupId);
        setJoinFamilyRole('');
        setCurrentGroupId(groupId);
        setShowJoinFamilyRoleModal(true);
      } else {
        setTimeout(() => router.push('/dashboard'), 1500);
      }
    } catch (err: any) {
      const msg = err?.message ?? '';
      const isAlreadyMember = msg.includes('Already a member of this group') || msg.includes('이미 해당 그룹의 멤버');
      if (isAlreadyMember && groupPreview?.id) {
        // 이미 가입된 멤버 → 역할 선택 없이 해당 그룹으로 대시보드 이동
        setError(null);
        setCurrentGroupId(groupPreview.id);
        router.push('/dashboard');
      } else {
        console.error('그룹 가입 오류:', err);
        setError(msg || ot('error_join_failed'));
      }
    } finally {
      setJoining(false);
      joinInProgressRef.current = false;
    }
  };

  // 초대 코드 복사
  const handleCopyInviteCode = async () => {
    if (createdInviteCode) {
      try {
        await navigator.clipboard.writeText(createdInviteCode);
        setSuccess(ot('success_copied'));
        setTimeout(() => setSuccess(null), 2000);
      } catch (err) {
        setError(ot('error_copy_failed'));
      }
    }
  };

  // 초대코드 확인 완료 처리 (그룹 생성 후)
  const handleConfirmInviteCode = () => {
    setInviteCodeConfirmed(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 300);
  };

  // 대시보드로 이동 (그룹 생성 완료 후)
  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite', color: '#667eea' }} />
          <p style={{ color: '#64748b', fontSize: '16px' }}>{ot('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 배경 장식 요소 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-15%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(118, 75, 162, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%)',
        zIndex: 0
      }} />

      <div style={{
        width: '100%',
        maxWidth: '480px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* 선택 단계 */}
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* 헤더 */}
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ fontSize: '80px', marginBottom: '20px' }}>🏠</div>
                <h1 style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  color: '#1a202c',
                  margin: '0 0 12px 0',
                  letterSpacing: '-1px',
                }}>
                  {ot('title')}
                </h1>
                <p style={{
                  fontSize: '16px',
                  color: '#64748b',
                  fontWeight: '500',
                  lineHeight: '1.6',
                  margin: 0,
                }}>
                  {ot('subtitle')}
                </p>
              </div>

              {/* 선택 카드 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '24px',
              }}>
                {/* 그룹 생성 카드 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('create')}
                  style={{
                    padding: '32px 24px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏠</div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1a202c',
                    margin: '0 0 8px 0',
                  }}>
                    {ot('create_group')}
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    margin: 0,
                    lineHeight: '1.5',
                  }}>
                    {ot('first_member')}
                  </p>
                </motion.button>

                {/* 초대 코드 가입 카드 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('join')}
                  style={{
                    padding: '32px 24px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1a202c',
                    margin: '0 0 8px 0',
                  }}>
                    {ot('join_invite')}
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    margin: 0,
                    lineHeight: '1.5',
                  }}>
                    {ot('already_family')}
                  </p>
                </motion.button>
              </div>

              {/* 진행 표시 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '12px',
                fontSize: '14px',
                color: '#64748b',
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#667eea',
                }} />
                <span>1 / 2</span>
              </div>
            </motion.div>
          )}

          {/* 그룹 생성 단계 */}
          {step === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              }}>
                {/* 헤더 */}
                <div style={{ marginBottom: '24px' }}>
                  <button
                    onClick={() => {
                      setStep('select');
                      setError(null);
                      setSuccess(null);
                      setCreatedGroupId(null);
                      setCreatedInviteCode(null);
                    }}
                    style={{
                      padding: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#64748b',
                      fontSize: '14px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
                    {ot('back')}
                  </button>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#1a202c',
                    margin: '0 0 8px 0',
                  }}>
                    {ot('create_group')}
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    margin: 0,
                  }}>
                    가족 그룹의 이름을 입력해주세요
                  </p>
                </div>

                {/* 그룹 생성 완료 화면 */}
                {createdGroupId ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#1a202c',
                      margin: '0 0 16px 0',
                    }}>
                      '{groupName}' 그룹이 생성되었습니다!
                    </h3>
                    
                    {/* 초대 코드 표시 */}
                    {createdInviteCode && !inviteCodeConfirmed && (
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '24px',
                      }}>
                        <p style={{
                          fontSize: '14px',
                          color: '#64748b',
                          margin: '0 0 12px 0',
                          fontWeight: '600',
                        }}>
                          {ot('invite_code')}
                        </p>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          justifyContent: 'center',
                        }}>
                          <code style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: '#667eea',
                            letterSpacing: '4px',
                            fontFamily: 'monospace',
                          }}>
                            {createdInviteCode}
                          </code>
                          <button
                            onClick={handleCopyInviteCode}
                            style={{
                              padding: '8px',
                              backgroundColor: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={ot('copy_title')}
                          >
                            <Copy style={{ width: '16px', height: '16px' }} />
                          </button>
                        </div>
                        <p style={{
                          fontSize: '12px',
                          color: '#94a3b8',
                          margin: '12px 0 8px 0',
                        }}>
                          {ot('share_code_hint')}
                        </p>
                        <p style={{
                          fontSize: '11px',
                          color: '#64748b',
                          margin: '8px 0 16px 0',
                          fontStyle: 'italic',
                        }}>
                          {ot('confirm_invite_hint')}
                        </p>
                        <button
                          onClick={handleConfirmInviteCode}
                          style={{
                            width: '100%',
                            padding: '10px 20px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#059669';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#10b981';
                          }}
                        >
                          <CheckCircle style={{ width: '16px', height: '16px' }} />
                          {ot('confirmed_btn')}
                        </button>
                      </div>
                    )}

                    {/* 초대코드를 확인한 경우에만 대시보드로 이동 버튼 표시 */}
                    {inviteCodeConfirmed && (
                      <button
                        onClick={handleGoToDashboard}
                        style={{
                          width: '100%',
                          padding: '14px 24px',
                          backgroundColor: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#5568d3';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#667eea';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                        }}
                      >
                        {ot('go_to_dashboard')}
                        <ArrowRight style={{ width: '18px', height: '18px' }} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* 그룹 이름 입력 */}
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '8px',
                      }}>
                        {ot('group_name')}
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => {
                          setGroupName(e.target.value);
                          setError(null);
                        }}
                        placeholder={ot('group_name_placeholder')}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          fontSize: '16px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '12px',
                          outline: 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#667eea';
                          e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e2e8f0';
                          e.target.style.boxShadow = 'none';
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !creating && groupName.trim()) {
                            handleCreateGroup();
                          }
                        }}
                        disabled={creating}
                      />
                    </div>

                    {/* 표시 언어 선택 */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        {ot('display_language')}
                      </label>
                      <select
                        value={groupPreferredLanguage}
                        onChange={(e) => setGroupPreferredLanguage(e.target.value as LangCode)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '15px',
                          color: '#1e293b',
                          backgroundColor: '#fff',
                        }}
                      >
                        <option value="ko">한국어</option>
                        <option value="en">English</option>
                        <option value="ja">日本語</option>
                        <option value="zh-CN">简体中文</option>
                        <option value="zh-TW">繁體中文</option>
                      </select>
                    </div>

                    {/* 가족 표시 (생성자: 아빠/엄마/선택 안함) */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        {mmt('family_role_label')}
                      </label>
                      <select
                        value={createFamilyRole}
                        onChange={(e) => setCreateFamilyRole(e.target.value as '' | 'mom' | 'dad')}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '15px',
                          color: '#1e293b',
                          backgroundColor: '#fff',
                        }}
                      >
                        <option value="">{mmt('family_role_none')}</option>
                        <option value="mom">{mmt('family_role_mom')}</option>
                        <option value="dad">{mmt('family_role_dad')}</option>
                      </select>
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#dc2626',
                        fontSize: '14px',
                      }}>
                        <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* 성공 메시지 */}
                    {success && (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#16a34a',
                        fontSize: '14px',
                      }}>
                        <CheckCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                        <span>{success}</span>
                      </div>
                    )}

                    {/* 생성 버튼 */}
                    <button
                      onClick={handleCreateGroup}
                      disabled={creating || !groupName.trim()}
                      style={{
                        width: '100%',
                        padding: '14px 24px',
                        backgroundColor: creating || !groupName.trim() ? '#94a3b8' : '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: creating || !groupName.trim() ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: creating || !groupName.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {creating ? (
                        <>
                          <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 0.8s linear infinite' }} />
                          생성 중...
                        </>
                      ) : (
                        <>
                          {ot('create_btn')}
                          <ArrowRight style={{ width: '18px', height: '18px' }} />
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* 초대 코드 가입 단계 */}
          {step === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              }}>
                {/* 헤더 */}
                <div style={{ marginBottom: '24px' }}>
                  <button
                    onClick={() => {
                      setStep('select');
                      setError(null);
                      setSuccess(null);
                      setInviteCode('');
                      setGroupPreview(null);
                    }}
                    style={{
                      padding: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#64748b',
                      fontSize: '14px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
                    {ot('back')}
                  </button>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#1a202c',
                    margin: '0 0 8px 0',
                  }}>
                    {ot('join_invite')}
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    margin: 0,
                  }}>
                    {ot('invite_join_subtitle')}
                  </p>
                </div>

                {/* 초대 코드 입력 */}
                {!groupPreview && (
                  <>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '8px',
                      }}>
                        {ot('invite_code')}
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => {
                            setInviteCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
                            setError(null);
                          }}
                          placeholder={ot('invite_placeholder')}
                          maxLength={12}
                          style={{
                            flex: 1,
                            padding: '14px 16px',
                            fontSize: '18px',
                            fontWeight: '700',
                            letterSpacing: '2px',
                            fontFamily: 'monospace',
                            textAlign: 'center',
                            border: '2px solid #e2e8f0',
                            borderRadius: '12px',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#667eea';
                            e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e2e8f0';
                            e.target.style.boxShadow = 'none';
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !verifying && inviteCode.trim()) {
                              handleVerifyInviteCode();
                            }
                          }}
                          disabled={verifying}
                        />
                        <button
                          onClick={handleVerifyInviteCode}
                          disabled={verifying || !inviteCode.trim()}
                          style={{
                            padding: '14px 20px',
                            backgroundColor: verifying || !inviteCode.trim() ? '#94a3b8' : '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: verifying || !inviteCode.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: verifying || !inviteCode.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {verifying ? (
                            <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 0.8s linear infinite' }} />
                          ) : (
                            ot('verify_btn')
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#dc2626',
                        fontSize: '14px',
                      }}>
                        <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                        <span>{error}</span>
                      </div>
                    )}
                  </>
                )}

                {/* 그룹 미리보기 */}
                {groupPreview && (
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0',
                    marginBottom: '24px',
                  }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1a202c',
                      margin: '0 0 16px 0',
                    }}>
                      {ot('group_info')}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '4px',
                          fontWeight: '600',
                        }}>
                          {ot('group_name')}
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: '#1a202c',
                        }}>
                          {groupPreview.name}
                        </div>
                      </div>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '4px',
                          fontWeight: '600',
                        }}>
                          {ot('member_count')}
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: '#1a202c',
                        }}>
                          {groupPreview.member_count}{ot('member_count_suffix')}
                        </div>
                      </div>
                    </div>

                    {/* 에러/성공 메시지 */}
                    {error && (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        marginTop: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#dc2626',
                        fontSize: '14px',
                      }}>
                        <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                        <span>{error}</span>
                      </div>
                    )}

                    {success && (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        marginTop: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#16a34a',
                        fontSize: '14px',
                      }}>
                        <CheckCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                        <span>{success}</span>
                      </div>
                    )}

                    {/* 가입 버튼 */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <button
                        onClick={() => {
                          setGroupPreview(null);
                          setInviteCode('');
                          setError(null);
                          setSuccess(null);
                        }}
                        disabled={joining}
                        style={{
                          flex: 1,
                          padding: '14px 24px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: joining ? 'not-allowed' : 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!joining) {
                            e.currentTarget.style.backgroundColor = '#e2e8f0';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f1f5f9';
                        }}
                      >
                        다시 입력
                      </button>
                      <button
                        onClick={joinedGroupId && groupPreview?.id === joinedGroupId ? handleGoToDashboard : handleJoinGroup}
                        disabled={joining && !(joinedGroupId && groupPreview?.id === joinedGroupId)}
                        style={{
                          flex: 1,
                          padding: '14px 24px',
                          backgroundColor: joining && !(joinedGroupId && groupPreview?.id === joinedGroupId) ? '#94a3b8' : '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: joining && !(joinedGroupId && groupPreview?.id === joinedGroupId) ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: joining && !(joinedGroupId && groupPreview?.id === joinedGroupId) ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {joining && !(joinedGroupId && groupPreview?.id === joinedGroupId) ? (
                          <>
                            <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 0.8s linear infinite' }} />
                            가입 중...
                          </>
                        ) : (
                          <>
                            {joinedGroupId && groupPreview?.id === joinedGroupId ? ot('go_to_group_btn') : ot('join_btn')}
                            <ArrowRight style={{ width: '18px', height: '18px' }} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 그룹 선택 단계 (로그인 시 여러 그룹이 있을 때) */}
          {step === 'choose-group' && (
            <motion.div
              key="choose-group"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
                maxWidth: '500px',
                width: '100%',
              }}
            >
              <div style={{
                textAlign: 'center',
                marginBottom: '32px',
              }}>
                <Users style={{
                  width: '48px',
                  height: '48px',
                  color: '#667eea',
                  margin: '0 auto 16px',
                }} />
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '8px',
                }}>
                  그룹 선택
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: 0,
                }}>
                  접속할 그룹을 선택해주세요
                </p>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '24px',
              }}>
                {userGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    style={{
                      padding: '16px',
                      border: selectedGroupId === group.id ? '2px solid #667eea' : '2px solid #e2e8f0',
                      borderRadius: '12px',
                      backgroundColor: selectedGroupId === group.id ? '#f0f4ff' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedGroupId !== group.id) {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedGroupId !== group.id) {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '4px',
                        }}>
                          {group.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          <span>{group.is_owner ? ot('role_owner') : group.role === 'ADMIN' ? ot('role_admin') : ot('role_member')}</span>
                          <span>•</span>
                          <span style={{ fontFamily: 'monospace' }}>{group.invite_code}</span>
                        </div>
                      </div>
                      {selectedGroupId === group.id && (
                        <CheckCircle style={{
                          width: '24px',
                          height: '24px',
                          color: '#667eea',
                        }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (selectedGroupId) {
                    localStorage.setItem('currentGroupId', selectedGroupId);
                    router.push('/dashboard');
                  }
                }}
                disabled={!selectedGroupId}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: selectedGroupId ? '#667eea' : '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedGroupId ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: selectedGroupId ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                  transition: 'all 0.3s ease',
                  marginBottom: '16px',
                }}
              >
                선택한 그룹으로 이동
                <ArrowRight style={{ width: '18px', height: '18px' }} />
              </button>

              {/* 구분선 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
                  또는
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              </div>

              {/* 새 그룹 추가 옵션 */}
              <div style={{
                display: 'flex',
                gap: '12px',
              }}>
                <button
                  onClick={() => {
                    setStep('create');
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    backgroundColor: 'white',
                    color: '#667eea',
                    border: '2px solid #667eea',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f4ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <Home style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  <span>{ot('create_group')}</span>
                </button>
                <button
                  onClick={() => {
                    setStep('join');
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    backgroundColor: 'white',
                    color: '#10b981',
                    border: '2px solid #10b981',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <Users style={{ width: '16px', height: '16px' }} />
                  {ot('join_invite')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 진행 표시 */}
        {step !== 'select' && step !== 'choose-group' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '24px',
            padding: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '12px',
            fontSize: '14px',
            color: '#64748b',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#667eea',
            }} />
            <span>2 / 2</span>
          </div>
        )}

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
                  router.push('/dashboard');
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
                        router.push('/dashboard');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label={ct('close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{mmt('family_role_modal_description')}</p>
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
                          router.push('/dashboard');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        {ct('skip')}
                      </button>
                      <button
                        onClick={async () => {
                          const { data: { user } } = await supabase.auth.getUser();
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!user || !session?.access_token || !joinedGroupId) {
                            setShowJoinFamilyRoleModal(false);
                            setJoinedGroupId(null);
                            router.push('/dashboard');
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
                          router.push('/dashboard');
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
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

