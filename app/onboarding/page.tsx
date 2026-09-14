'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getValidatedUserWithSessionFallback, isTransientAuthNetworkError } from '@/lib/auth-session-resilience';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, Loader2, AlertCircle, CheckCircle, Copy, X, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useGroup } from '@/app/contexts/GroupContext';
import { getOnboardingTranslation, type OnboardingTranslations } from '@/lib/translations/onboarding';
import {
  getFamilyRoleSelectOptions,
  getMemberManagementTranslation,
  type FamilyRoleSelectValue,
} from '@/lib/translations/memberManagement';
import { getCommonTranslation } from '@/lib/translations/common';
import { getAccountTranslation } from '@/lib/translations/account';
import { getGroupSelectorLabel } from '@/lib/group-display-name';
import { normalizeGroupId, normalizeGroupIdFromRpc } from '@/lib/validation';
import { dashboardHrefWithOpenGroup, sameGroupId } from '@/lib/group-id-resolve';
import {
  clearSessionStoredInviteCode,
  getInviteCodeFromSearchParams,
  getSessionStoredInviteCode,
  setSessionStoredInviteCode,
} from '@/lib/family-auth-routing';
import { messageFromSuspendRpcError, suspendedPath } from '@/lib/account-suspend-access';
import { messageFromGroupCreateRpcError } from '@/lib/group-create-rpc';
import type { BootstrapGroupSummary } from '@/lib/auth-bootstrap-server';
import { refreshAuthBootstrapCache, invalidateCachedAuthBootstrap } from '@/lib/auth-bootstrap';
import { APP_ENROLL_PATH, needsAppEnrollment } from '@/lib/app-enrollment-routing';
import { getAdminSuspendTranslation } from '@/lib/translations/adminSuspend';
import { CURRENT_APP_ID } from '@/lib/apps';
import { isShortInviteCode, GROUP_SHORT_INVITE_ERROR } from '@/lib/group-short-invite';
import { JOIN_REQUEST_PENDING_EVENT } from '@/lib/notifications/join-request-events';
// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

/** PostgREST/GoTrue 에러 객체에서 사용자에게 보일 문자열 추출 */
function supabaseClientErrorText(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err.trim();
  const o = err as { message?: string; details?: string; hint?: string };
  return (o.message || o.details || o.hint || '').trim();
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
  display_name_pending?: boolean;
}

function bootstrapGroupsToUserGroups(groups: BootstrapGroupSummary[]): UserGroup[] {
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    invite_code: g.invite_code,
    is_owner: g.is_owner,
    role: g.role,
    display_name_pending: g.display_name_pending,
  }));
}

async function redirectCreateFlowToChooseGroup(
  accessToken: string,
  userId: string,
  ownedFallback: UserGroup[],
  apply: (groups: UserGroup[]) => void,
): Promise<void> {
  const refreshed = await refreshAuthBootstrapCache(accessToken, userId);
  apply(refreshed?.groups.length ? bootstrapGroupsToUserGroups(refreshed.groups) : ownedFallback);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { lang } = useLanguage();
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
  const ct = (key: 'save' | 'close' | 'cancel' | 'skip' | 'app_title') => getCommonTranslation(lang, key);

  const [creating, setCreating] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdWithPendingName, setCreatedWithPendingName] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [inviteCodeConfirmed, setInviteCodeConfirmed] = useState(false);
  
  const [createFamilyRole, setCreateFamilyRole] = useState<'' | FamilyRoleSelectValue>('');
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [joinFamilyRole, setJoinFamilyRole] = useState<'' | FamilyRoleSelectValue>('');

  // 초대 코드 가입 관련 상태
  const [inviteCode, setInviteCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [joining, setJoining] = useState(false);
  const [groupPreview, setGroupPreview] = useState<GroupPreview | null>(null);
  
  // 사용자 그룹 목록 (로그인 시 선택용)
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [suspendedGroupIds, setSuspendedGroupIds] = useState<string[]>([]);
  
  // 에러 및 성공 메시지
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  /** 베타 페이즈 여부 (가입 한도 1~100일 때 true, 그룹 합류 후 축하 배너 표시용) */
  const [isBetaPhase, setIsBetaPhase] = useState(false);

  // 가입 버튼 연타 방지 (가입 성공 후 두 번째 요청이 'Already a member'로 에러 뜨는 것 방지)
  const joinInProgressRef = useRef(false);
  // 초대 코드 확인(4자리 요청 포함) 연타 방지
  const verifyInProgressRef = useRef(false);
  // 그룹 생성 연타·인증 링크 재진입 시 중복 생성 방지
  const createInProgressRef = useRef(false);

  // 베타 페이즈 확인 (가입 한도 1~100일 때)
  useEffect(() => {
    fetch('/api/signup-status', { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null)
      .then((result) => {
        if (result && typeof result.signupMaxUsers === 'number' && result.signupMaxUsers <= 100) {
          setIsBetaPhase(true);
        }
      });
  }, []);

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
        if (!initSession?.access_token) {
          try {
            await supabase.auth.signOut();
          } catch (_) {}
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

        // getUser + bootstrap 병렬 — 순차 대기(특히 WiFi)를 줄임
        const [userResult, bootstrapResult] = await Promise.all([
          getValidatedUserWithSessionFallback(supabase, initSession),
          refreshAuthBootstrapCache(initSession.access_token, initSession.user.id),
        ]);
        const { user, error: authUserError } = userResult;
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

        // 서버 bootstrap 1회 — RPC·memberships·정지 조회를 PostgREST 큐 밖으로
        const bootstrap = bootstrapResult;

        if (bootstrap && needsAppEnrollment(bootstrap)) {
          router.replace(APP_ENROLL_PATH);
          return;
        }

        let isAdmin = false;
        let allGroups: UserGroup[] = [];
        let accessLookupFailed = true;
        let accessibleGroupIds: string[] = [];

        if (bootstrap && (!bootstrap.appId || bootstrap.appId === CURRENT_APP_ID)) {
          isAdmin = bootstrap.isSystemAdmin;
          allGroups = bootstrapGroupsToUserGroups(bootstrap.groups);
          accessLookupFailed = bootstrap.lookupFailed;
          accessibleGroupIds = bootstrap.accessibleGroupIds;
          if (bootstrap.lookupFailed) {
            console.warn('[Onboarding] bootstrap 조회 실패, 정지 목록 없이 계속');
            setSuspendedGroupIds([]);
          } else {
            setSuspendedGroupIds(bootstrap.suspendedGroupIds);
          }
        } else {
          if (bootstrap?.appId && bootstrap.appId !== CURRENT_APP_ID) {
            console.warn('[Onboarding] bootstrap appId mismatch, client fallback', {
              bootstrapAppId: bootstrap.appId,
              current: CURRENT_APP_ID,
            });
            invalidateCachedAuthBootstrap(user.id);
          } else {
            console.warn('[Onboarding] bootstrap 실패, 클라이언트 조회로 폴백');
          }
          const { data: adminData } = await supabase.rpc('is_system_admin', {
            user_id_param: user.id,
          });
          isAdmin = Boolean(adminData);

          const { data: enrollmentRow } = await supabase
            .from('user_app_enrollments')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('app_id', CURRENT_APP_ID)
            .maybeSingle();

          const { data: memberships } = await supabase
            .from('memberships')
            .select(
              'group_id, role, groups!inner(id, name, invite_code, owner_id, display_name_pending, app_id)',
            )
            .eq('user_id', user.id)
            .eq('groups.app_id', CURRENT_APP_ID);

          const { data: ownedGroups } = await supabase
            .from('groups')
            .select('id, name, invite_code, owner_id, display_name_pending')
            .eq('owner_id', user.id)
            .eq('app_id', CURRENT_APP_ID);

          const hasOwnedOrMember =
            Boolean(ownedGroups && ownedGroups.length > 0) ||
            Boolean(memberships && memberships.length > 0);
          if (!enrollmentRow?.user_id && !(isAdmin && !hasOwnedOrMember)) {
            router.replace(APP_ENROLL_PATH);
            return;
          }

          const groupIds = new Set<string>();
          allGroups = [];
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
                  display_name_pending: group.display_name_pending ?? false,
                });
              }
            });
          }
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
                  display_name_pending: group.display_name_pending ?? false,
                });
              }
            });
          }
          accessLookupFailed = true;
          accessibleGroupIds = allGroups.map((g) => g.id);
          setSuspendedGroupIds([]);
        }

        // 이미 소속 그룹이 있어도 초대 링크로 들어온 경우에는 먼저 해당 그룹 가입 플로우(join)로 보냄
        if (allGroups.length > 0 && !fromAdminParam && !inviteParam) {
          if (!accessLookupFailed && accessibleGroupIds.length === 0) {
            router.push('/suspended');
            return;
          }
          setUserGroups(allGroups);
          setStep('choose-group');
          setLoading(false);
          return;
        }

        // 시스템 관리자이고 그룹이 없으면 관리자 페이지로
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
          setGroupName(
            getOnboardingTranslation(lang, 'default_group_name').replace('{name}', profile.nickname)
          );
        } else {
          const emailNickname =
            user.email?.split('@')[0] || getOnboardingTranslation(lang, 'default_user_fallback');
          setNickname(emailNickname);
          setGroupName(
            getOnboardingTranslation(lang, 'default_group_name').replace('{name}', emailNickname)
          );
        }

        // 초대 링크로 진입한 경우: join 단계로 이동, 코드 채우기, 그룹 미리보기 자동 검증
        // 4자리 승인형은 미리보기 없이 코드만 채움 (확인 시 가입 요청)
        if (inviteParam) {
          setStep('join');
          setInviteCode(inviteParam);
          setError(null);
          setSuccess(null);
          if (!isShortInviteCode(inviteParam)) {
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
  const handleCreateGroup = async (decideLater = false) => {
    if (createInProgressRef.current) return;
    if (!decideLater && !groupName.trim()) {
      setError(ot('error_group_name_required'));
      return;
    }

    createInProgressRef.current = true;
    setCreating(true);
    setError(null);
    setSuccess(null);
    setCreatedWithPendingName(decideLater);

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

      // 초기 온보딩(그룹 선택 화면 아님): DB에 이미 소유 그룹이 있으면 create 대신 선택 화면으로
      if (userGroups.length === 0) {
        const { data: ownedGroups, error: ownedError } = await supabase
          .from('groups')
          .select('id, name, invite_code, owner_id, display_name_pending')
          .eq('owner_id', user.id)
          .eq('app_id', CURRENT_APP_ID);
        if (!ownedError && ownedGroups && ownedGroups.length > 0) {
          await redirectCreateFlowToChooseGroup(
            session.access_token,
            user.id,
            ownedGroups.map((group) => ({
              id: group.id,
              name: group.name,
              invite_code: group.invite_code,
              is_owner: true,
              role: 'ADMIN' as const,
              display_name_pending: group.display_name_pending ?? false,
            })),
            (groups) => {
              setUserGroups(groups);
              setStep('choose-group');
            },
          );
          return;
        }
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
        group_name: decideLater ? '' : groupName.trim(),
        invite_code_param: inviteCode,
        owner_id_param: user.id,
        display_name_pending_param: decideLater,
        app_id_param: CURRENT_APP_ID,
      });

      if (createError) {
        if (messageFromGroupCreateRpcError(createError.message) === 'GROUP_CREATE_BURST') {
          await redirectCreateFlowToChooseGroup(session.access_token, user.id, [], (groups) => {
            if (groups.length) {
              setUserGroups(groups);
              setStep('choose-group');
            }
          });
          setError(ot('error_create_burst'));
          return;
        }
        throw createError;
      }

      // 생성된 그룹 정보 조회
      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (fetchError) throw fetchError;

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
      if (userGroups.length === 0) {
        setUserGroups([
          {
            id: data.id,
            name: data.name,
            invite_code: inviteCode,
            is_owner: true,
            role: 'ADMIN',
            display_name_pending: Boolean(data.display_name_pending),
          },
        ]);
      }

      // 온보딩 진입 시 hasGroups:false로 고정된 bootstrap 캐시 갱신
      const { data: { session: postCreateSession } } = await supabase.auth.getSession();
      if (postCreateSession?.access_token) {
        await refreshAuthBootstrapCache(postCreateSession.access_token, user.id);
      }
      
      // 초대코드를 확인한 후에만 대시보드로 이동하도록 함
    } catch (err: any) {
      console.error('그룹 생성 오류:', err);
      const suspendKind = messageFromSuspendRpcError(err?.message);
      setError(
        suspendKind === 'ALL_GROUPS_SUSPENDED'
          ? ot('error_all_groups_suspended')
          : isTransientAuthNetworkError(err)
            ? ot('error_network_retry')
            : err.message || ot('error_create_failed')
      );
    } finally {
      setCreating(false);
      createInProgressRef.current = false;
    }
  };

  const handleBackFromCreate = () => {
    if (userGroups.length > 0) {
      setStep('choose-group');
      setError(null);
      setSuccess(null);
      setCreatedGroupId(null);
      setCreatedInviteCode(null);
      return;
    }
    setStep('select');
    setError(null);
    setSuccess(null);
    setCreatedGroupId(null);
    setCreatedInviteCode(null);
  };

  // 초대 코드 검증 (비멤버는 groups RLS로 읽을 수 없으므로 서버 API 사용, service role로 RLS 우회)
  // 4자리 승인형 코드는 미리보기 없이 가입 요청 API로 바로 전송
  const handleVerifyInviteCode = async () => {
    if (!inviteCode.trim()) {
      setError(ot('error_invite_required'));
      return;
    }
    if (verifyInProgressRef.current) return;
    verifyInProgressRef.current = true;

    setVerifying(true);
    setError(null);
    setSuccess(null);
    setGroupPreview(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(ot('error_login_required'));
        return;
      }

      const code = inviteCode.trim();

      if (isShortInviteCode(code)) {
        const res = await fetch('/api/group/join-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errCode = typeof json.code === 'string' ? json.code : '';
          if (errCode === GROUP_SHORT_INVITE_ERROR.RATE_LIMITED) {
            throw new Error(ot('error_short_invite_rate'));
          }
          if (errCode === GROUP_SHORT_INVITE_ERROR.ALREADY_PENDING) {
            throw new Error(ot('error_short_invite_pending'));
          }
          if (errCode === GROUP_SHORT_INVITE_ERROR.ALREADY_MEMBER) {
            throw new Error(ot('error_short_invite_already_member'));
          }
          if (errCode === GROUP_SHORT_INVITE_ERROR.GROUP_SUSPENDED) {
            throw new Error(ot('error_target_group_suspended'));
          }
          if (errCode === GROUP_SHORT_INVITE_ERROR.INVALID_OR_EXPIRED) {
            throw new Error(ot('error_invalid_invite'));
          }
          throw new Error(ot('error_join_failed'));
        }

        setSuccess(ot('success_join_pending'));
        const requestId =
          typeof json.data?.request_id === 'string' ? json.data.request_id : null;
        const groupId = typeof json.data?.group_id === 'string' ? json.data.group_id : null;
        if (requestId && groupId && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(JOIN_REQUEST_PENDING_EVENT, {
              detail: {
                requestId,
                groupId,
                groupName:
                  typeof json.data?.group_name === 'string' ? json.data.group_name : null,
              },
            }),
          );
        }
        return;
      }

      let accessToken = session.access_token;
      let res = await fetch('/api/group/preview-by-invite-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ invite_code: code }),
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
            body: JSON.stringify({ invite_code: code }),
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
      verifyInProgressRef.current = false;
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
          p_app_id: CURRENT_APP_ID,
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
      const previewNorm = normalizeGroupId(groupPreview?.id);
      const groupId = fromRpc ?? previewNorm;

      if (groupId) {
        setJoinedGroupId(groupId);
        setCurrentGroupId(groupId);
        try {
          clearSessionStoredInviteCode();
        } catch (_) {}
        const { data: { session: postJoinSession } } = await supabase.auth.getSession();
        if (postJoinSession?.access_token) {
          void refreshAuthBootstrapCache(postJoinSession.access_token, postJoinSession.user.id);
        }
      } else if (groupPreview?.id) {
        setJoinedGroupId(groupPreview.id);
        setCurrentGroupId(groupPreview.id);
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
        const suspendKind = messageFromSuspendRpcError(raw);
        if (suspendKind === 'GROUP_SUSPENDED') {
          setError(ot('error_target_group_suspended'));
        } else {
          const looksTransient =
            isTransientAuthNetworkError(err) || isTransientAuthNetworkError(raw);
          // 서버/DB 메시지(만료·무효 코드 등)가 있으면 네트워크 안내로 덮어쓰지 않음
          setError(looksTransient && !raw ? ot('error_network_retry') : raw || ot('error_join_failed'));
        }
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
    !!normalizeGroupId(groupPreview?.id) &&
    sameGroupId(joinedGroupId, groupPreview?.id);

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
              </div>

              {/* 선택 카드 */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
                {/* 그룹 생성 카드 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('create')}
                  className="cursor-pointer rounded-2xl border-2 border-slate-200 bg-white px-3 py-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out hover:border-indigo-500 hover:shadow-[0_8px_24px_rgba(102,126,234,0.2)] sm:px-6"
                >
                  <div className="mb-3 text-5xl">🏠</div>
                  <h3 className="m-0 mb-2 whitespace-nowrap text-base font-bold text-slate-900 sm:text-lg">
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
                  className="cursor-pointer rounded-2xl border-2 border-slate-200 bg-white px-3 py-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out hover:border-indigo-500 hover:shadow-[0_8px_24px_rgba(102,126,234,0.2)] sm:px-6"
                >
                  <div className="mb-3 text-5xl">👥</div>
                  <h3 className="m-0 mb-2 whitespace-nowrap text-base font-bold text-slate-900 sm:text-lg">
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
                    onClick={handleBackFromCreate}
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
                      {createdWithPendingName
                        ? ot('group_created_heading_pending')
                        : ot('group_created_heading').replace(/\{name\}/g, groupName)}
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

                    {/* 베타 축하 배너: 그룹 생성 완료 + 베타 페이즈일 때 */}
                    {isBetaPhase && (
                      <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-4 text-left">
                        <p className="mb-1 text-[13px] font-bold text-purple-800">
                          {ot('beta_welcome_title')}
                        </p>
                        <p className="mb-1 text-[13px] leading-5 text-purple-700">
                          {ot('beta_welcome_body')}
                        </p>
                        <p className="text-[12px] leading-5 text-purple-600">
                          {ot('beta_welcome_report')}
                        </p>
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

                    {/* 가족 표시 (권한과 무관하게 동일 옵션) */}
                    <div className="mb-5">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        {mmt('family_role_label')}
                      </label>
                      <select
                        value={createFamilyRole}
                        onChange={(e) => setCreateFamilyRole((e.target.value || '') as '' | FamilyRoleSelectValue)}
                        className="w-full rounded-[10px] border border-slate-200 bg-white px-[14px] py-3 text-[15px] text-slate-800"
                      >
                        {getFamilyRoleSelectOptions(lang).map((opt) => (
                          <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                        ))}
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
                      onClick={() => handleCreateGroup()}
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
                    <button
                      type="button"
                      onClick={() => handleCreateGroup(true)}
                      disabled={creating}
                      className="mt-3 w-full text-sm text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-50"
                    >
                      {ot('decide_later_btn')}
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
                      <div className="flex min-w-0 gap-2">
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => {
                            setInviteCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
                            setError(null);
                          }}
                          placeholder={ot('invite_placeholder')}
                          maxLength={12}
                          className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-4 py-3.5 text-center font-mono text-lg font-bold tracking-[2px] outline-none transition-all duration-200 ease-in-out focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.1)]"
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
                          className={`flex shrink-0 items-center justify-center rounded-xl border-none px-5 py-3.5 text-sm font-semibold whitespace-nowrap text-white transition-all duration-300 ease-in-out ${
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
                    <p className="mb-4 text-xs leading-5 text-slate-500">
                      {ot('invite_code_short_hint')}
                    </p>

                    {/* 에러 메시지 */}
                    {error && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    {success && !groupPreview && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>{success}</span>
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

                      {/* You've joined 페이지: 가족 표시 선택 (권한과 무관하게 동일 옵션) */}
                      {joinFlowReady && (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                            {mmt('family_role_label')}
                          </label>
                          <select
                            value={joinFamilyRole}
                            onChange={(e) => setJoinFamilyRole((e.target.value || '') as '' | FamilyRoleSelectValue)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                            aria-label={mmt('family_role_label')}
                          >
                            {getFamilyRoleSelectOptions(lang).map((opt) => (
                              <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                            ))}
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

                    {/* 베타 축하 배너: 그룹 합류 성공 + 베타 페이즈일 때 */}
                    {joinedGroupId && isBetaPhase && (
                      <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-4">
                        <p className="mb-1 text-[13px] font-bold text-purple-800">
                          {ot('beta_welcome_title')}
                        </p>
                        <p className="mb-1 text-[13px] leading-5 text-purple-700">
                          {ot('beta_welcome_body')}
                        </p>
                        <p className="text-[12px] leading-5 text-purple-600">
                          {ot('beta_welcome_report')}
                        </p>
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
                        {ot('re_enter')}
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
                            {ot('joining')}
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

          {/* 그룹 선택 단계 (로그인 후 소속 그룹이 1개 이상이어도 항상 여기) */}
          {step === 'choose-group' && (
            <motion.div
              key="choose-group"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-[500px] rounded-3xl bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.1)]"
            >
              <div className="mb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <img
                    src="/branding/hearth-family-icon.png"
                    alt=""
                    width={144}
                    height={144}
                    className="h-36 w-36 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.1)]"
                    aria-hidden
                  />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-800">
                  {ot('select_group')}
                </h2>
                <p className="m-0 text-sm text-slate-500">
                  {ot('choose_group_subtitle')}
                </p>
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
                        <div className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
                          <span>{getGroupSelectorLabel(group, ct('app_title'))}</span>
                          {suspendedGroupIds.some((id) => sameGroupId(id, group.id)) && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">
                              {getAdminSuspendTranslation(lang, 'badge_suspended')}
                            </span>
                          )}
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
                    if (suspendedGroupIds.some((id) => sameGroupId(id, selectedGroupId))) {
                      router.push(suspendedPath(selectedGroupId));
                      return;
                    }
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
                  <span className="whitespace-nowrap">{ot('join_invite')}</span>
                </button>
                <Link
                  href="/account"
                  className="mt-1 block w-full text-center text-xs font-medium text-slate-500 no-underline hover:text-slate-800"
                >
                  {getAccountTranslation(lang, 'account_link')}
                </Link>
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
      </div>

    </div>
  );
}

