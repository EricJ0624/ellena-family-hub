'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getValidatedUserWithSessionFallback, isTransientAuthNetworkError } from '@/lib/auth-session-resilience';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, Loader2, AlertCircle, CheckCircle, Copy, X, ArrowRight } from 'lucide-react';
import type { LangCode } from '@/lib/language-fonts';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useGroup } from '@/app/contexts/GroupContext';
import { getOnboardingTranslation, type OnboardingTranslations } from '@/lib/translations/onboarding';
import { getMemberManagementTranslation } from '@/lib/translations/memberManagement';
import { getCommonTranslation } from '@/lib/translations/common';
import { normalizeGroupIdFromRpc, isValidUUID } from '@/lib/validation';
import {
  clearSessionStoredInviteCode,
  getInviteCodeFromSearchParams,
  getSessionStoredInviteCode,
  setSessionStoredInviteCode,
} from '@/lib/family-auth-routing';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

const DISPLAY_LANG_OPTIONS: { code: LangCode; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
];

/** PostgREST/GoTrue 에러 객체에서 사용자에게 보일 문자열 추출 */
function supabaseClientErrorText(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err.trim();
  const o = err as { message?: string; details?: string; hint?: string };
  return (o.message || o.details || o.hint || '').trim();
}

/** 온보딩 → 대시보드: 선택/가입 그룹을 URL에 실어 checkAuth가 멤버십을 확정(스토리지·JWT 레이스 완화) */
function dashboardHrefWithOpenGroup(groupId: string | null | undefined): string {
  const g = groupId?.trim().toLowerCase() ?? '';
  if (!g || !isValidUUID(g)) return '/dashboard';
  return `/dashboard?openGroup=${encodeURIComponent(g)}`;
}

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
  const { lang, setLanguage } = useLanguage();
  const { setCurrentGroupId } = useGroup();
  const [fromAdmin, setFromAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'select' | 'create' | 'join' | 'choose-group'>('select');
  const [nickname, setNickname] = useState('');
  
  // 그룹 생성 관련 상태
  const [groupName, setGroupName] = useState('');

  const ot = (key: keyof OnboardingTranslations) => getOnboardingTranslation(lang, key);
  const mmt = (key: keyof import('@/lib/translations/memberManagement').MemberManagementTranslations) =>
    getMemberManagementTranslation(lang, key);
  const ct = (key: 'save' | 'close' | 'cancel' | 'skip') => getCommonTranslation(lang, key);

  const setAppLanguage = (code: LangCode) => {
    void setLanguage(code, { updateCurrentGroup: false });
  };
  const [creating, setCreating] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [inviteCodeConfirmed, setInviteCodeConfirmed] = useState(false);
  
  const [createFamilyRole, setCreateFamilyRole] = useState<'' | 'mom' | 'dad'>('');
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [joinFamilyRole, setJoinFamilyRole] = useState<'' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other'>('');
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
        const urlParams =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const rawInviteForHistory =
          typeof window !== 'undefined'
            ? urlParams?.get('invite')?.trim() || urlParams?.get('invite_code')?.trim() || ''
            : '';
        const inviteFromUrl = urlParams ? getInviteCodeFromSearchParams(urlParams) : null;
        const inviteFromStorage = !inviteFromUrl ? getSessionStoredInviteCode() : null;
        const inviteParam = inviteFromUrl || inviteFromStorage || '';
        // URL에서 invite 쿼리 제거 (Referrer/히스토리 노출 방지)
        if (typeof window !== 'undefined' && rawInviteForHistory) {
          try {
            const params = new URLSearchParams(window.location.search);
            params.delete('invite');
            params.delete('invite_code');
            const newSearch = params.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState({}, '', newUrl);
          } catch (_) {}
        }
        setFromAdmin(fromAdminParam);
        // getSession()만 보면 로컬에 남은 만료·무효 JWT로도 user가 있어 보여 join 단계로 들어갈 수 있음.
        // getUser 재시도·일시 네트워크 실패 시 session 완화 포함(getValidated…).
        const { data: { session: initSession } } = await supabase.auth.getSession();
        const { user, error: authUserError } = await getValidatedUserWithSessionFallback(supabase, initSession);
        if (authUserError || !user) {
          try {
            await supabase.auth.signOut();
          } catch (_) {}
          // 미가입·무효 세션: join UI 대신 가입/로그인(/)으로. 초대는 유지.
          if (inviteParam) {
            try {
              setSessionStoredInviteCode(inviteParam);
            } catch (_) {}
            router.push(`/?invite=${encodeURIComponent(inviteParam)}`);
          } else {
            router.push('/');
          }
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

        // 이미 소속 그룹이 있어도 초대 링크로 들어온 경우에는 먼저 해당 그룹 가입 플로우(join)로 보냄
        if (allGroups.length > 0 && !fromAdminParam && !inviteParam) {
          // 그룹이 있으면 선택 화면 표시 (1개여도 선택 화면 표시)
          setUserGroups(allGroups);
          setStep('choose-group');
          setLoading(false);
          return;
        }

        // 시스템 관리자이고 그룹이 없으면 관리자 페이지로
        // 단, 관리자 페이지에서 온보딩으로 들어온 경우·초대 링크 진입은 허용
        if (isAdmin && !fromAdminParam && !inviteParam) {
          router.push('/admin');
          return;
        }

        // 프로필에서 별명 가져오기
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

        // 초대 링크로 진입한 경우: join 단계로 이동, 코드 채우기, 그룹 미리보기 자동 검증
        if (inviteParam) {
          setStep('join');
          setInviteCode(inviteParam);
          setError(null);
          setSuccess(null);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            let token = session?.access_token ?? null;
            if (token) {
              let res = await fetch('/api/group/preview-by-invite-code', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ invite_code: inviteParam }),
              });
              if (res.status === 401) {
                const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
                if (!refreshErr && refreshed.session?.access_token) {
                  token = refreshed.session.access_token;
                  res = await fetch('/api/group/preview-by-invite-code', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ invite_code: inviteParam }),
                  });
                }
              }
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.id) {
                setGroupPreview({
                  id: data.id,
                  name: data.name,
                  member_count: data.member_count ?? 0,
                  invite_code: data.invite_code,
                });
                setSuccess(ot('success_found'));
              }
            }
          } catch (_) {
            // 검증 실패해도 코드는 채워진 상태로 join 단계 표시
          }
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

      // 그룹 표시 언어 설정 (UI에서 선택한 언어 = 전역 lang)
      await supabase.from('groups').update({ preferred_language: lang }).eq('id', data.id);

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
      setError(
        isTransientAuthNetworkError(err)
          ? ot('error_network_retry')
          : err.message || ot('error_create_failed')
      );
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

      let accessToken = session.access_token;
      let res = await fetch('/api/group/preview-by-invite-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });

      if (res.status === 401) {
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshed.session?.access_token) {
          accessToken = refreshed.session.access_token;
          res = await fetch('/api/group/preview-by-invite-code', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ invite_code: inviteCode.trim() }),
          });
        }
      }

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
      setError(
        isTransientAuthNetworkError(err)
          ? ot('error_network_retry')
          : err.message || ot('error_verify_failed')
      );
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
      const inviteCodeClean = String(groupPreview.invite_code ?? '').trim();
      if (!inviteCodeClean) {
        setError(ot('error_invite_required'));
        return;
      }

      const { data: { session: joinSession } } = await supabase.auth.getSession();
      if (!joinSession?.access_token) {
        const { data: refreshedJoin, error: refreshJoinErr } = await supabase.auth.refreshSession();
        if (refreshJoinErr || !refreshedJoin.session?.access_token) {
          setError(ot('error_login_required'));
          return;
        }
      }

      const runJoin = () =>
        supabase.rpc('join_group_by_invite_code', {
          invite_code_param: inviteCodeClean,
        });

      let { data: joinedGroupIdData, error: joinError } = await runJoin();

      // 토큰 갱신 직후·일시 네트워크에서만 RPC가 실패하는 경우 1회 복구
      if (joinError && isTransientAuthNetworkError(joinError)) {
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr) {
          ({ data: joinedGroupIdData, error: joinError } = await runJoin());
        }
      }

      if (joinError) throw joinError;

      setSuccess(ot('success_joined'));
      const fromRpc = normalizeGroupIdFromRpc(joinedGroupIdData);
      const previewNorm =
        groupPreview?.id && isValidUUID(groupPreview.id.trim().toLowerCase())
          ? groupPreview.id.trim().toLowerCase()
          : null;
      const groupId = fromRpc ?? previewNorm;

      if (groupId) {
        setJoinedGroupId(groupId);
        setCurrentGroupId(groupId);
        setShowJoinFamilyRoleModal(false);
        try {
          clearSessionStoredInviteCode();
        } catch (_) {}
      } else if (groupPreview?.id) {
        setJoinedGroupId(groupPreview.id);
        setCurrentGroupId(groupPreview.id);
        setShowJoinFamilyRoleModal(false);
        try {
          clearSessionStoredInviteCode();
        } catch (_) {}
      } else {
        try {
          clearSessionStoredInviteCode();
        } catch (_) {}
        setTimeout(() => router.push(dashboardHrefWithOpenGroup(groupPreview?.id)), 1500);
      }
    } catch (err: any) {
      const msg = err?.message ?? '';
      const isAlreadyMember = msg.includes('Already a member of this group') || msg.includes('이미 해당 그룹의 멤버');
      if (isAlreadyMember && groupPreview?.id) {
        // 이미 가입된 멤버 → 역할 선택 없이 해당 그룹으로 대시보드 이동
        setError(null);
        setCurrentGroupId(groupPreview.id);
        router.push(dashboardHrefWithOpenGroup(groupPreview.id));
      } else {
        console.error('그룹 가입 오류:', err);
        const raw = supabaseClientErrorText(err) || String(msg || '').trim();
        const looksTransient =
          isTransientAuthNetworkError(err) || isTransientAuthNetworkError(raw);
        // 서버/DB 메시지(만료·무효 코드 등)가 있으면 네트워크 안내로 덮어쓰지 않음
        setError(looksTransient && !raw ? ot('error_network_retry') : raw || ot('error_join_failed'));
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
    if (createdGroupId) {
      setCurrentGroupId(createdGroupId);
    }
    setTimeout(() => {
      router.push(dashboardHrefWithOpenGroup(createdGroupId));
    }, 300);
  };

  // 대시보드로 이동 (그룹 생성 완료 후 등)
  const handleGoToDashboard = () => {
    if (createdGroupId) {
      setCurrentGroupId(createdGroupId);
    }
    router.push(dashboardHrefWithOpenGroup(createdGroupId));
  };

  // 초대 가입 완료 후 이동: 드롭다운에서 가족 표시만 고르고 별도 '저장'을 누르지 않아도 반영
  const handleJoinCompleteGoToDashboard = async () => {
    if (joinedGroupId && joinFamilyRole) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (user?.id && session?.access_token) {
        try {
          const res = await fetch('/api/groups/members/family-role', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              targetUserId: user.id,
              groupId: joinedGroupId,
              familyRole: joinFamilyRole,
            }),
          });
          if (!res.ok) console.warn('가족 표시 저장 실패');
        } catch (e) {
          console.warn('가족 표시 저장 실패', e);
        }
      }
    }
    router.push(dashboardHrefWithOpenGroup(joinedGroupId));
  };

  const joinFlowReady =
    !!joinedGroupId &&
    !!groupPreview?.id &&
    isValidUUID(groupPreview.id.trim().toLowerCase()) &&
    joinedGroupId === groupPreview.id.trim().toLowerCase();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[linear-gradient(135deg,#f5f7fa_0%,#c3cfe2_100%)]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-indigo-500" />
          <p className="text-base text-slate-500">{ot('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-[linear-gradient(135deg,#f5f7fa_0%,#c3cfe2_100%)] p-5 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif]"
    >
      {/* 배경 장식 요소 */}
      <div className="absolute -right-[20%] -top-1/2 z-0 h-[500px] w-[500px] rounded-full bg-[linear-gradient(135deg,rgba(102,126,234,0.1)_0%,rgba(118,75,162,0.1)_100%)]" />
      <div className="absolute -bottom-[30%] -left-[15%] z-0 h-[400px] w-[400px] rounded-full bg-[linear-gradient(135deg,rgba(118,75,162,0.1)_0%,rgba(102,126,234,0.1)_100%)]" />

      <div className="relative z-[1] w-full max-w-[480px]">
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
              <div className="mb-10 text-center">
                <div className="mb-5 text-[80px]">🏠</div>
                <h1 className="m-0 mb-3 text-[32px] font-extrabold tracking-[-1px] text-slate-900">
                  {ot('title')}
                </h1>
                <p className="m-0 text-base font-medium leading-relaxed text-slate-500">
                  {ot('subtitle')}
                </p>
                <div className="mx-auto mt-5 max-w-[320px] text-left">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">
                    {ot('display_language')}
                  </label>
                  <select
                    value={lang}
                    onChange={(e) => setAppLanguage(e.target.value as LangCode)}
                    className="w-full rounded-[10px] border border-slate-200 bg-white px-[14px] py-3 text-[15px] text-slate-800"
                  >
                    {DISPLAY_LANG_OPTIONS.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 선택 카드 */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                {/* 그룹 생성 카드 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('create')}
                  className="cursor-pointer rounded-2xl border-2 border-slate-200 bg-white px-6 py-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out hover:border-indigo-500 hover:shadow-[0_8px_24px_rgba(102,126,234,0.2)]"
                >
                  <div className="mb-3 text-5xl">🏠</div>
                  <h3 className="m-0 mb-2 text-lg font-bold text-slate-900">
                    {ot('create_group')}
                  </h3>
                  <p className="m-0 text-sm leading-6 text-slate-500">
                    {ot('first_member')}
                  </p>
                </motion.button>

                {/* 초대 코드 가입 카드 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('join')}
                  className="cursor-pointer rounded-2xl border-2 border-slate-200 bg-white px-6 py-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out hover:border-indigo-500 hover:shadow-[0_8px_24px_rgba(102,126,234,0.2)]"
                >
                  <div className="mb-3 text-5xl">👥</div>
                  <h3 className="m-0 mb-2 text-lg font-bold text-slate-900">
                    {ot('join_invite')}
                  </h3>
                  <p className="m-0 text-sm leading-6 text-slate-500">
                    {ot('already_family')}
                  </p>
                </motion.button>
              </div>

              {/* 진행 표시 */}
              <div className="flex items-center justify-center gap-2 rounded-xl bg-white/70 p-3 text-sm text-slate-500">
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
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
              <div className="rounded-2xl bg-white p-8 shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
                {/* 헤더 */}
                <div className="mb-6">
                  <button
                    onClick={() => {
                      setStep('select');
                      setError(null);
                      setSuccess(null);
                      setCreatedGroupId(null);
                      setCreatedInviteCode(null);
                    }}
                    className="mb-4 flex cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent p-2 text-sm text-slate-500 hover:bg-slate-100"
                  >
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    {ot('back')}
                  </button>
                  <h2 className="m-0 mb-2 text-2xl font-bold text-slate-900">
                    {ot('create_group')}
                  </h2>
                  <p className="m-0 text-sm text-slate-500">
                    {ot('create_group_subtitle')}
                  </p>
                </div>

                {/* 그룹 생성 완료 화면 */}
                {createdGroupId ? (
                  <div className="text-center">
                    <div className="mb-4 text-[64px]">🎉</div>
                    <h3 className="m-0 mb-4 text-xl font-bold text-slate-900">
                      {ot('group_created_heading').replace(/\{name\}/g, groupName)}
                    </h3>
                    
                    {/* 초대 코드 표시 */}
                    {createdInviteCode && !inviteCodeConfirmed && (
                      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <p className="m-0 mb-3 text-sm font-semibold text-slate-500">
                          {ot('invite_code')}
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          <code className="font-mono text-2xl font-bold tracking-[4px] text-indigo-500">
                            {createdInviteCode}
                          </code>
                          <button
                            onClick={handleCopyInviteCode}
                            className="flex cursor-pointer items-center justify-center rounded-lg border-none bg-indigo-500 p-2 text-white"
                            title={ot('copy_title')}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="m-0 mb-2 mt-3 text-xs text-slate-400">
                          {ot('share_code_hint')}
                        </p>
                        <p className="m-0 mb-4 mt-2 text-[11px] italic text-slate-500">
                          {ot('confirm_invite_hint')}
                        </p>
                        <button
                          onClick={handleConfirmInviteCode}
                          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 ease-in-out hover:bg-emerald-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {ot('confirmed_btn')}
                        </button>
                      </div>
                    )}

                    {/* 초대코드를 확인한 경우에만 대시보드로 이동 버튼 표시 */}
                    {inviteCodeConfirmed && (
                      <button
                        onClick={handleGoToDashboard}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-indigo-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(102,126,234,0.3)] transition-all duration-300 ease-in-out hover:bg-indigo-600 hover:shadow-[0_6px_16px_rgba(102,126,234,0.4)]"
                      >
                        {ot('go_to_dashboard')}
                        <ArrowRight className="h-[18px] w-[18px]" />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* 그룹 이름 입력 */}
                    <div className="mb-6">
                      <label className="mb-2 block text-sm font-semibold text-slate-600">
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
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3.5 text-base outline-none transition-all duration-200 ease-in-out focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.1)]"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !creating && groupName.trim()) {
                            handleCreateGroup();
                          }
                        }}
                        disabled={creating}
                      />
                    </div>

                    {/* 표시 언어 선택 */}
                    <div className="mb-5">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        {ot('display_language')}
                      </label>
                      <select
                        value={lang}
                        onChange={(e) => setAppLanguage(e.target.value as LangCode)}
                        className="w-full rounded-[10px] border border-slate-200 bg-white px-[14px] py-3 text-[15px] text-slate-800"
                      >
                        {DISPLAY_LANG_OPTIONS.map(({ code, label }) => (
                          <option key={code} value={code}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 가족 표시 (생성자: 아빠/엄마/선택 안함) */}
                    <div className="mb-5">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        {mmt('family_role_label')}
                      </label>
                      <select
                        value={createFamilyRole}
                        onChange={(e) => setCreateFamilyRole(e.target.value as '' | 'mom' | 'dad')}
                        className="w-full rounded-[10px] border border-slate-200 bg-white px-[14px] py-3 text-[15px] text-slate-800"
                      >
                        <option value="">{mmt('family_role_none')}</option>
                        <option value="mom">{mmt('family_role_mom')}</option>
                        <option value="dad">{mmt('family_role_dad')}</option>
                      </select>
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* 성공 메시지 */}
                    {success && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>{success}</span>
                      </div>
                    )}

                    {/* 생성 버튼 */}
                    <button
                      onClick={handleCreateGroup}
                      disabled={creating || !groupName.trim()}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border-none px-6 py-3.5 text-base font-semibold text-white transition-all duration-300 ease-in-out ${
                        creating || !groupName.trim()
                          ? 'cursor-not-allowed bg-slate-400 shadow-none'
                          : 'cursor-pointer bg-indigo-500 shadow-[0_4px_12px_rgba(102,126,234,0.3)]'
                      }`}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-[18px] w-[18px] animate-spin" />
                          {ot('creating')}
                        </>
                      ) : (
                        <>
                          {ot('create_btn')}
                          <ArrowRight className="h-[18px] w-[18px]" />
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
              <div className="rounded-2xl bg-white p-8 shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
                {/* 헤더 */}
                <div className="mb-6">
                  <button
                    onClick={() => {
                      setStep('select');
                      setError(null);
                      setSuccess(null);
                      setInviteCode('');
                      setGroupPreview(null);
                    }}
                    className="mb-4 flex cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent p-2 text-sm text-slate-500 hover:bg-slate-100"
                  >
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    {ot('back')}
                  </button>
                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-semibold text-slate-600">
                      {ot('display_language')}
                    </label>
                    <select
                      value={lang}
                      onChange={(e) => setAppLanguage(e.target.value as LangCode)}
                      className="w-full rounded-[10px] border border-slate-200 bg-white px-[14px] py-3 text-[15px] text-slate-800"
                    >
                      {DISPLAY_LANG_OPTIONS.map(({ code, label }) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {!groupPreview && (
                    <>
                      <h2 className="m-0 mb-2 text-2xl font-bold text-slate-900">
                        {ot('join_step_enter_code')}
                      </h2>
                      <p className="m-0 text-sm text-slate-500">
                        {ot('invite_join_subtitle')}
                      </p>
                    </>
                  )}
                  {groupPreview && !joinedGroupId && (
                    <>
                      <h2 className="m-0 mb-2 text-2xl font-bold text-slate-900">
                        {ot('join_step_confirm')}
                      </h2>
                      <p className="m-0 text-sm text-slate-500">
                        {groupPreview.name}
                      </p>
                    </>
                  )}
                  {groupPreview && joinedGroupId && (
                    <>
                      <h2 className="m-0 mb-2 text-2xl font-bold text-slate-900">
                        {ot('join_step_joined')}
                      </h2>
                      <p className="m-0 text-sm text-slate-500">
                        {ot('success_joined')}
                      </p>
                    </>
                  )}
                </div>

                {/* 초대 코드 입력 */}
                {!groupPreview && (
                  <>
                    <div className="mb-6">
                      <label className="mb-2 block text-sm font-semibold text-slate-600">
                        {ot('invite_code')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => {
                            setInviteCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
                            setError(null);
                          }}
                          placeholder={ot('invite_placeholder')}
                          maxLength={12}
                          className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3.5 text-center font-mono text-lg font-bold tracking-[2px] outline-none transition-all duration-200 ease-in-out focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.1)]"
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
                          className={`flex items-center justify-center rounded-xl border-none px-5 py-3.5 text-sm font-semibold text-white transition-all duration-300 ease-in-out ${
                            verifying || !inviteCode.trim()
                              ? 'cursor-not-allowed bg-slate-400 shadow-none'
                              : 'cursor-pointer bg-indigo-500 shadow-[0_4px_12px_rgba(102,126,234,0.3)]'
                          }`}
                        >
                          {verifying ? (
                            <Loader2 className="h-[18px] w-[18px] animate-spin" />
                          ) : (
                            ot('verify_btn')
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                  </>
                )}

                {/* 그룹 미리보기 */}
                {groupPreview && (
                  <div className="mb-6 rounded-xl border-2 border-slate-200 bg-slate-50 p-5">
                    <h3 className="m-0 mb-4 text-base font-bold text-slate-900">
                      {ot('group_info')}
                    </h3>
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="mb-1 text-xs font-semibold text-slate-500">
                          {ot('group_name')}
                        </div>
                        <div className="text-lg font-bold text-slate-900">
                          {groupPreview.name}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold text-slate-500">
                          {ot('member_count')}
                        </div>
                        <div className="text-lg font-bold text-slate-900">
                          {groupPreview.member_count}{ot('member_count_suffix')}
                        </div>
                      </div>

                      {/* You've joined 페이지: 가족 표시 선택 (일반 멤버: 아들/딸/기타) */}
                      {joinFlowReady && (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                            {mmt('family_role_label')}
                          </label>
                          <select
                            value={joinFamilyRole}
                            onChange={(e) => setJoinFamilyRole((e.target.value || '') as '' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other')}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                            aria-label={mmt('family_role_label')}
                          >
                            <option value="">{mmt('family_role_none')}</option>
                            <option value="son">{mmt('family_role_son')}</option>
                            <option value="daughter">{mmt('family_role_daughter')}</option>
                            <option value="grandpa">{mmt('family_role_grandpa')}</option>
                            <option value="grandma">{mmt('family_role_grandma')}</option>
                            <option value="other">{mmt('family_role_other')}</option>
                          </select>
                          {joinFamilyRole && (
                            <button
                              type="button"
                              onClick={async () => {
                                const { data: { user } } = await supabase.auth.getUser();
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!user?.id || !session?.access_token || !joinedGroupId) return;
                                try {
                                  const res = await fetch('/api/groups/members/family-role', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                    body: JSON.stringify({ targetUserId: user.id, groupId: joinedGroupId, familyRole: joinFamilyRole }),
                                  });
                                  if (res.ok) setSuccess(mmt('family_role_saved'));
                                  else setError(mmt('family_role_save_failed'));
                                } catch {
                                  setError(mmt('family_role_save_failed'));
                                }
                              }}
                              className="mt-2 cursor-pointer rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs"
                            >
                              {ct('save')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 에러/성공 메시지 */}
                    {error && (
                      <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {success && (
                      <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>{success}</span>
                      </div>
                    )}

                    {/* 가입 버튼 */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          setGroupPreview(null);
                          setInviteCode('');
                          setError(null);
                          setSuccess(null);
                        }}
                        disabled={joining}
                        className={`flex-1 rounded-xl border-none bg-slate-100 px-6 py-3.5 text-sm font-semibold text-slate-600 transition-all duration-300 ease-in-out ${
                          joining ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        다시 입력
                      </button>
                      <button
                        onClick={joinFlowReady ? handleJoinCompleteGoToDashboard : handleJoinGroup}
                        disabled={joining && !joinFlowReady}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-none px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 ease-in-out ${
                          joining && !joinFlowReady
                            ? 'cursor-not-allowed bg-slate-400 shadow-none'
                            : 'cursor-pointer bg-indigo-500 shadow-[0_4px_12px_rgba(102,126,234,0.3)]'
                        }`}
                      >
                        {joining && !joinFlowReady ? (
                          <>
                            <Loader2 className="h-[18px] w-[18px] animate-spin" />
                            가입 중...
                          </>
                        ) : (
                          <>
                            {joinFlowReady ? ot('go_to_group_btn') : ot('join_btn')}
                            <ArrowRight className="h-[18px] w-[18px]" />
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
              className="w-full max-w-[500px] rounded-3xl bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.1)]"
            >
              <div className="mb-8 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-indigo-500" />
                <h2 className="mb-2 text-2xl font-bold text-slate-800">
                  {ot('select_group')}
                </h2>
                <p className="m-0 text-sm text-slate-500">
                  {ot('choose_group_subtitle')}
                </p>
                <div className="mt-5 text-left">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">
                    {ot('display_language')}
                  </label>
                  <select
                    value={lang}
                    onChange={(e) => setAppLanguage(e.target.value as LangCode)}
                    className="w-full rounded-[10px] border border-slate-200 bg-white px-[14px] py-3 text-[15px] text-slate-800"
                  >
                    {DISPLAY_LANG_OPTIONS.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6 flex flex-col gap-3">
                {userGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`cursor-pointer rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                      selectedGroupId === group.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="mb-1 text-base font-semibold text-slate-800">
                          {group.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span>{group.is_owner ? ot('role_owner') : group.role === 'ADMIN' ? ot('role_admin') : ot('role_member')}</span>
                        </div>
                      </div>
                      {selectedGroupId === group.id && (
                        <CheckCircle className="h-6 w-6 text-indigo-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (selectedGroupId) {
                    // localStorage만 바꾸면 GroupContext의 currentGroupId는 refreshGroups가 고른 첫 그룹에 머물러
                    // 대시보드가 이전 그룹으로 열리는 버그가 난다. 컨텍스트와 동기화 필수.
                    setCurrentGroupId(selectedGroupId);
                    router.push(dashboardHrefWithOpenGroup(selectedGroupId));
                  }
                }}
                disabled={!selectedGroupId}
                className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-none px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 ease-in-out ${
                  selectedGroupId
                    ? 'cursor-pointer bg-indigo-500 shadow-[0_4px_12px_rgba(102,126,234,0.3)]'
                    : 'cursor-not-allowed bg-slate-400 shadow-none'
                }`}
              >
                {ot('go_to_selected_group')}
                <ArrowRight className="h-[18px] w-[18px]" />
              </button>

              {/* 구분선 */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">
                  {ot('or_divider')}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* 새 그룹 추가 옵션 */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    setStep('create');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-indigo-500 bg-white px-5 py-3 text-center text-[13px] font-semibold text-indigo-500 transition-all duration-200 hover:bg-indigo-50"
                >
                  <Home className="h-4 w-4 shrink-0" />
                  <span>{ot('create_group')}</span>
                </button>
                <button
                  onClick={() => {
                    setStep('join');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-500 bg-white px-5 py-3 text-center text-[13px] font-semibold text-emerald-500 transition-all duration-200 hover:bg-emerald-50"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>{ot('join_invite')}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 진행 표시 */}
        {step !== 'select' && step !== 'choose-group' && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-white/70 p-3 text-sm text-slate-500">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>2 / 2</span>
          </div>
        )}

        {/* 가입 후 가족 표시 선택 모달 (일반 멤버: 아들/딸/기타) - body에 포탈로 렌더 */}
        {typeof document !== 'undefined' && showJoinFamilyRoleModal && joinedGroupId &&
          createPortal(
            <AnimatePresence>
              <>
                  <div
                    className="fixed inset-0 bg-black/50 z-[100]"
                    onClick={() => {
                      const gid = joinedGroupId;
                      setShowJoinFamilyRoleModal(false);
                      setJoinedGroupId(null);
                      setJoinFamilyRole('');
                      router.push(dashboardHrefWithOpenGroup(gid));
                    }}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">{mmt('family_role_label')}</h3>
                        <button
                          onClick={() => {
                            const gid = joinedGroupId;
                            setShowJoinFamilyRoleModal(false);
                            setJoinedGroupId(null);
                            setJoinFamilyRole('');
                            router.push(dashboardHrefWithOpenGroup(gid));
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
                          onChange={(e) => setJoinFamilyRole((e.target.value || '') as '' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">{mmt('family_role_none')}</option>
                          <option value="son">{mmt('family_role_son')}</option>
                          <option value="daughter">{mmt('family_role_daughter')}</option>
                          <option value="grandpa">{mmt('family_role_grandpa')}</option>
                          <option value="grandma">{mmt('family_role_grandma')}</option>
                          <option value="other">{mmt('family_role_other')}</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const gid = joinedGroupId;
                              setShowJoinFamilyRoleModal(false);
                              setJoinedGroupId(null);
                              setJoinFamilyRole('');
                              router.push(dashboardHrefWithOpenGroup(gid));
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
                                const gid = joinedGroupId;
                                setShowJoinFamilyRoleModal(false);
                                setJoinedGroupId(null);
                                router.push(dashboardHrefWithOpenGroup(gid));
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
                              const gid = joinedGroupId;
                              setShowJoinFamilyRoleModal(false);
                              setJoinedGroupId(null);
                              setJoinFamilyRole('');
                              router.push(dashboardHrefWithOpenGroup(gid));
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
            </AnimatePresence>,
            document.body
          )}
      </div>

    </div>
  );
}

