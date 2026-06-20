'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/validation';
import type { Group, Membership, MembershipRole } from '@/types/db';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { DocumentTitle } from '@/app/components/DocumentTitle';

type UiTheme = 'default' | 'stable_glass' | 'highend_glass';

function resolveUiTheme(value: unknown): UiTheme {
  if (value === 'highend_glass') return 'highend_glass';
  if (value === 'stable_glass') return 'stable_glass';
  return 'default';
}

interface GroupContextType {
  currentGroupId: string | null;
  currentGroup: Group | null;
  userRole: MembershipRole | null;
  isOwner: boolean;
  groups: Group[];
  memberships: Membership[];
  loading: boolean;
  error: string | null;
  setCurrentGroupId: (groupId: string | null) => void;
  refreshGroups: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const [currentGroupId, setCurrentGroupIdState] = useState<string | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [userRole, setUserRole] = useState<MembershipRole | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);
  /** 로그인 계정 전환 직후 자식(대시보드)이 이전 사용자의 isOwner/userRole로 API를 호출하지 않도록, paint 전에 권한 상태를 비움 */
  const lastUserIdForRoleRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!userId) {
      lastUserIdForRoleRef.current = null;
      return;
    }
    const prev = lastUserIdForRoleRef.current;
    if (prev !== null && prev !== userId) {
      setUserRole(null);
      setIsOwner(false);
    }
    lastUserIdForRoleRef.current = userId;
  }, [userId]);

  // 그룹 목록 로드
  const refreshGroups = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setMemberships([]);
      setCurrentGroupIdState(null);
      setCurrentGroup(null);
      setUserRole(null);
      setIsOwner(false);
      // userId가 아직 resolve되기 전(null)인 동안 localStorage의 currentGroupId를 지우면
      // 온보딩에서 선택 직후 /dashboard로 갈 때 선택 그룹이 날아갈 수 있음(로그인 루프 유발).
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. memberships 테이블에서 사용자가 속한 그룹 조회
      let { data: membershipData, error: membershipError } = await supabase
        .from('memberships')
        .select('group_id, role, family_role')
        .eq('user_id', userId);

      if (membershipError) throw membershipError;

      // 2. groups 테이블에서 사용자가 소유한 그룹 조회
      let { data: ownedGroupsData, error: ownedGroupsError } = await supabase
        .from('groups')
        .select('id')
        .eq('owner_id', userId);

      if (ownedGroupsError) throw ownedGroupsError;

      const recomputeAllGroupIds = () => {
        const membershipGroupIds = membershipData?.map((m) => m.group_id) || [];
        const ownedGroupIds = ownedGroupsData?.map((g) => g.id) || [];
        return [...new Set([...membershipGroupIds, ...ownedGroupIds])];
      };

      let allGroupIds = recomputeAllGroupIds();

      const pinnedSaved =
        typeof window !== 'undefined'
          ? (() => {
              const s = localStorage.getItem('currentGroupId')?.trim().toLowerCase() ?? '';
              return s && isValidUUID(s) ? s : null;
            })()
          : null;

      // 로그인 직후·라우트 전환 직후 PostgREST가 빈 배열을 줄 수 있음. 한 번 백오프 후 재조회.
      if (allGroupIds.length === 0) {
        await new Promise((r) => setTimeout(r, 450));
        const rM = await supabase.from('memberships').select('group_id, role, family_role').eq('user_id', userId);
        const rO = await supabase.from('groups').select('id').eq('owner_id', userId);
        if (!rM.error && !rO.error) {
          membershipData = rM.data;
          ownedGroupsData = rO.data;
          allGroupIds = recomputeAllGroupIds();
        }
      }

      // 온보딩에서 방금 고른 그룹이 스토리지에만 있고 목록 조회가 아직 비는 경우: pinned 단일 행으로 복구
      if (allGroupIds.length === 0 && pinnedSaved) {
        const { data: pm } = await supabase
          .from('memberships')
          .select('group_id, role, family_role')
          .eq('user_id', userId)
          .eq('group_id', pinnedSaved)
          .maybeSingle();
        const { data: po } = await supabase
          .from('groups')
          .select('id')
          .eq('id', pinnedSaved)
          .eq('owner_id', userId)
          .maybeSingle();
        if (pm) {
          membershipData = [pm];
          allGroupIds = [pinnedSaved];
        } else if (po) {
          membershipData = [];
          ownedGroupsData = [{ id: po.id }];
          allGroupIds = [pinnedSaved];
        }
      }

      if (allGroupIds.length === 0) {
        setGroups([]);
        setMemberships([]);
        setCurrentGroupIdState(null);
        setCurrentGroup(null);
        setUserRole(null);
        setIsOwner(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentGroupId');
        }
        setLoading(false);
        return;
      }

      // 4. 그룹 정보 조회
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .in('id', allGroupIds)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      setGroups(groupsData || []);

      const ownedGroupIds = ownedGroupsData?.map((g) => g.id) || [];

      // 현재 선택된 그룹 정보를 새로 고친 목록과 동기화 (대시보드 타이틀/스타일 등 즉시 반영)
      if (groupsData && currentGroupId) {
        const updated = groupsData.find((g) => g.id === currentGroupId);
        if (updated) setCurrentGroup(updated);
      }

      // 5. 멤버십 정보 매핑 (소유자인 경우 ADMIN 역할 부여)
      setMemberships(allGroupIds.map(groupId => {
        const membership = membershipData?.find(m => m.group_id === groupId);
        const isOwner = ownedGroupIds.includes(groupId);
        return {
          user_id: userId,
          group_id: groupId,
          role: isOwner ? 'ADMIN' : (membership?.role as MembershipRole || 'MEMBER'),
          joined_at: new Date().toISOString(),
          family_role: (membership as { family_role?: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null })?.family_role ?? null,
        };
      }));

      // 저장된 그룹 ID 우선 반영 (로그인 모달 선택 반영)
      let preferredGroupId = currentGroupId;
      if (typeof window !== 'undefined') {
        const savedGroupId = localStorage.getItem('currentGroupId');
        if (savedGroupId && groupsData?.find(g => g.id === savedGroupId)) {
          preferredGroupId = savedGroupId;
        }
      }

      // 현재 그룹이 없거나 삭제된 경우, 첫 번째 그룹으로 설정
      if (!preferredGroupId || !groupsData?.find(g => g.id === preferredGroupId)) {
        if (groupsData && groupsData.length > 0) {
          const firstGroupId = groupsData[0].id;
          setCurrentGroupIdState(firstGroupId);
          // localStorage에도 저장
          if (typeof window !== 'undefined') {
            localStorage.setItem('currentGroupId', firstGroupId);
          }
        }
      } else if (preferredGroupId !== currentGroupId) {
        setCurrentGroupIdState(preferredGroupId);
        // localStorage에도 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentGroupId', preferredGroupId);
        }
      }
    } catch (err: any) {
      console.error('그룹 목록 로드 실패:', err);
      setError(err.message || '그룹 목록을 불러오는데 실패했습니다.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [userId, currentGroupId]);

  // 멤버십 정보 새로고침
  const refreshMemberships = useCallback(async () => {
    if (!userId || !currentGroupId) {
      setUserRole(null);
      setIsOwner(false);
      return;
    }

    try {
      // 그룹 소유자 확인
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', currentGroupId)
        .maybeSingle();

      if (groupData) {
        const owner = groupData.owner_id === userId;
        setIsOwner(owner);

        if (owner) {
          setUserRole('ADMIN');
        } else {
          // 멤버십 확인
          const { data: membershipData } = await supabase
            .from('memberships')
            .select('role')
            .eq('user_id', userId)
            .eq('group_id', currentGroupId)
            .maybeSingle();

          if (membershipData) {
            setUserRole(membershipData.role as MembershipRole);
          } else {
            setUserRole(null);
          }
        }
      }

      // 현재 그룹 정보 업데이트
      const { data: groupInfo } = await supabase
        .from('groups')
        .select('*')
        .eq('id', currentGroupId)
        .maybeSingle();

      if (groupInfo) {
        setCurrentGroup(groupInfo);
      } else if (typeof window !== 'undefined') {
        // RLS/삭제로 조회 불가한 그룹 ID가 localStorage에 남은 경우
        localStorage.removeItem('currentGroupId');
        setCurrentGroupIdState(null);
        setCurrentGroup(null);
      }
    } catch (err: any) {
      console.error('멤버십 정보 로드 실패:', err);
    }
  }, [userId, currentGroupId]);

  // 그룹 ID 변경 핸들러 (✅ SECURITY: 그룹 전환 시 완전한 상태 초기화)
  const setCurrentGroupId = useCallback((groupId: string | null) => {
    // 이전 그룹 ID 저장
    const previousGroupId = currentGroupId;
    
    // 그룹이 변경되는 경우에만 상태 초기화
    if (previousGroupId !== groupId) {
      // 1. 현재 그룹 정보 초기화
      setCurrentGroup(null);
      setUserRole(null);
      setIsOwner(false);
      
      // 2. 새 그룹 ID 설정
      setCurrentGroupIdState(groupId);
      
      // 3. localStorage 동기화 (브라우저 환경에서만)
      if (typeof window !== 'undefined') {
        if (groupId) {
          localStorage.setItem('currentGroupId', groupId);
          console.log('✅ 그룹 전환:', { from: previousGroupId, to: groupId });
        } else {
          localStorage.removeItem('currentGroupId');
          console.log('✅ 그룹 해제');
        }
      }
      
      // 4. 개발 환경에서 디버깅 정보 출력
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 그룹 전환 완료:', {
          previousGroupId,
          newGroupId: groupId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [currentGroupId]);

  // 초기 로드 및 그룹 ID 복원
  useEffect(() => {
    if (!userId) {
      setCurrentGroupIdState(null);
      setCurrentGroup(null);
      setUserRole(null);
      setIsOwner(false);
      setGroups([]);
      setMemberships([]);
      // 인증 resolve 전에는 persisted currentGroupId를 유지 (온보딩 → 대시보드 레이스 방지)
      prevUserIdRef.current = null;
      return;
    }
    if (userId && prevUserIdRef.current && prevUserIdRef.current !== userId) {
      setCurrentGroupIdState(null);
      setUserRole(null);
      setIsOwner(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentGroupId');
      }
    }
    prevUserIdRef.current = userId;

    if (userId) {
      // localStorage에서 저장된 그룹 ID 복원
      const savedGroupId = localStorage.getItem('currentGroupId');
      if (savedGroupId) {
        setCurrentGroupIdState(savedGroupId);
      }
      refreshGroups();
    }
  }, [userId, refreshGroups]);

  // 현재 그룹 변경 시 멤버십 정보 업데이트
  useEffect(() => {
    if (currentGroupId && userId) {
      refreshMemberships();
    } else {
      setUserRole(null);
      setIsOwner(false);
      setCurrentGroup(null);
    }
  }, [currentGroupId, userId, refreshMemberships]);

  // 그룹 단위 UI 테마를 문서 루트 속성으로 반영
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const theme = resolveUiTheme((currentGroup as { ui_theme?: unknown } | null)?.ui_theme);
    document.documentElement.setAttribute('data-ui-theme', theme);
  }, [currentGroup]);

  const value: GroupContextType = {
    currentGroupId,
    currentGroup,
    userRole,
    isOwner,
    groups,
    memberships,
    loading,
    error,
    setCurrentGroupId,
    refreshGroups,
    refreshMemberships,
  };

  return (
    <GroupContext.Provider value={value}>
      <LanguageProvider>
        <DocumentTitle />
        {children}
      </LanguageProvider>
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
}

