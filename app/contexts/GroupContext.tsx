'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Group, Membership, MembershipRole } from '@/types/db';
import { getCachedAuthBootstrap } from '@/lib/auth-bootstrap';
import type { AuthBootstrapPayload } from '@/lib/auth-bootstrap-server';
import {
  findGroupById,
  getPinnedGroupId,
  readStoredGroupId,
  resolvePreferredGroupId,
  sameGroupId,
  writeStoredGroupId,
} from '@/lib/group-id-resolve';
import { normalizeGroupId } from '@/lib/validation';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { DocumentTitle } from '@/app/components/DocumentTitle';
import { resolveUiTheme } from '@/lib/ui-theme';

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

function seedFromBootstrapCache(
  userId: string,
  bootstrap: AuthBootstrapPayload,
  currentGroupId: string | null,
): {
  groups: Group[];
  memberships: Membership[];
  preferredGroupId: string | null;
} | null {
  if (!bootstrap.groupRows.length) return null;

  const groups = bootstrap.groupRows as Group[];
  const ownedSet = new Set(bootstrap.ownedGroupIds.map((id) => id.toLowerCase()));
  const roleByGroup = new Map(
    bootstrap.membershipRoles.map((row) => [row.group_id.toLowerCase(), row]),
  );

  const memberships: Membership[] = bootstrap.groupIds.map((groupId) => {
    const roleRow = roleByGroup.get(groupId.toLowerCase());
    const isOwner = ownedSet.has(groupId.toLowerCase());
    return {
      user_id: userId,
      group_id: groupId,
      role: (isOwner ? 'ADMIN' : roleRow?.role || 'MEMBER') as MembershipRole,
      joined_at: new Date().toISOString(),
      family_role: (roleRow?.family_role as Membership['family_role']) ?? null,
    };
  });

  let preferredGroupId = resolvePreferredGroupId(groups, { currentGroupId });

  return { groups, memberships, preferredGroupId };
}

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

    const bootstrapHint = getCachedAuthBootstrap(userId);
    const bootstrapSeed = bootstrapHint ? seedFromBootstrapCache(userId, bootstrapHint, currentGroupId) : null;
    const silentRefresh = Boolean(bootstrapSeed);

    if (bootstrapSeed) {
      setGroups(bootstrapSeed.groups);
      setMemberships(bootstrapSeed.memberships);
      if (bootstrapSeed.preferredGroupId) {
        const preferred = normalizeGroupId(bootstrapSeed.preferredGroupId);
        setCurrentGroupIdState(preferred);
        const selected = findGroupById(bootstrapSeed.groups, preferred);
        if (selected) setCurrentGroup(selected);
        writeStoredGroupId(preferred);
      }
      setLoading(false);
    }

    try {
      if (!silentRefresh) {
        setLoading(true);
      }
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

      const pinnedSaved = getPinnedGroupId();

      // bootstrap이 그룹 있음을 알려주면 빈 결과 재시도 대기를 줄인다.
      if (allGroupIds.length === 0) {
        await new Promise((r) => setTimeout(r, bootstrapHint?.hasGroups ? 120 : 450));
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
        writeStoredGroupId(null);
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
      const activeId = resolvePreferredGroupId(groupsData || [], { currentGroupId, pinnedGroupId: pinnedSaved });
      if (groupsData && activeId) {
        const updated = findGroupById(groupsData, activeId);
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

      const preferredGroupId = resolvePreferredGroupId(groupsData || [], {
        currentGroupId,
        pinnedGroupId: pinnedSaved,
      });

      if (preferredGroupId) {
        setCurrentGroupIdState(preferredGroupId);
        writeStoredGroupId(preferredGroupId);
        const selected = findGroupById(groupsData || [], preferredGroupId);
        if (selected) setCurrentGroup(selected);
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
        writeStoredGroupId(null);
        setCurrentGroupIdState(null);
        setCurrentGroup(null);
      }
    } catch (err: any) {
      console.error('멤버십 정보 로드 실패:', err);
    }
  }, [userId, currentGroupId]);

  // 그룹 ID 변경 핸들러 — 항상 lowercase UUID로 정규화
  const setCurrentGroupId = useCallback((groupId: string | null) => {
    const nextId = normalizeGroupId(groupId);
    const previousGroupId = currentGroupId;

    if (sameGroupId(previousGroupId, nextId)) {
      // 대소문자만 다른 경우 스토리지만 정규화
      if (nextId && previousGroupId !== nextId) {
        setCurrentGroupIdState(nextId);
        writeStoredGroupId(nextId);
      }
      return;
    }

    setCurrentGroup(null);
    setUserRole(null);
    setIsOwner(false);
    setCurrentGroupIdState(nextId);
    writeStoredGroupId(nextId);

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 그룹 전환:', { from: previousGroupId, to: nextId });
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
      writeStoredGroupId(null);
    }
    prevUserIdRef.current = userId;

    if (userId) {
      const savedGroupId = readStoredGroupId();
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

