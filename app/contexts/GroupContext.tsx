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
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { DocumentTitle } from '@/app/components/DocumentTitle';
import { GroupEmailInviteHost } from '@/app/components/GroupEmailInviteHost';
import JoinRequestOutcomeModalHost from '@/app/components/JoinRequestOutcomeModalHost';
import { DEFAULT_UI_THEME, isExplicitUiTheme, resolveEffectiveUiTheme, resolveUiTheme, type UiTheme } from '@/lib/ui-theme';
import {
  readStoredUiTheme,
  writeStoredUiTheme,
} from '@/lib/preferences/ui-theme-cache';
import { CURRENT_APP_ID } from '@/lib/apps';

/** bootstrap(최대 24h) 스톡 ui_theme보다 테마 localStorage를 우선 반영 */
function withCachedUiTheme<T extends { id: string; ui_theme?: unknown }>(
  group: T,
  userId: string | null | undefined,
): T {
  const cached = readStoredUiTheme(userId, group.id);
  if (!cached) return group;
  if (resolveUiTheme((group as { ui_theme?: unknown }).ui_theme) === cached) return group;
  return { ...group, ui_theme: cached };
}

function persistGroupUiTheme(
  userId: string | null | undefined,
  group: { id?: string; ui_theme?: unknown } | null | undefined,
): void {
  if (!group?.id || !isExplicitUiTheme(group.ui_theme)) return;
  writeStoredUiTheme(userId, group.id, resolveUiTheme(group.ui_theme));
}

interface GroupContextType {
  currentGroupId: string | null;
  currentGroup: Group | null;
  /** 그룹 row 기준 또는 (로드 전) userId+groupId / groupId 캐시 */
  uiTheme: UiTheme;
  /** DB 또는 캐시로 테마가 확정됐을 때만 true — false면 테마 전용 타이틀 장식 숨김 */
  uiThemeReady: boolean;
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
        // bootstrap groupRows는 테마 변경 후에도 오래 남을 수 있음 → 테마 캐시로 patch
        if (selected) setCurrentGroup(withCachedUiTheme(selected, userId));
        writeStoredGroupId(preferred);
      }
      setLoading(false);
    }

    try {
      if (!silentRefresh) {
        setLoading(true);
      }
      setError(null);

      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) {
        throw new Error('세션이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      }

      // 1. memberships 테이블에서 사용자가 속한 그룹 조회
      let { data: membershipData, error: membershipError } = await supabase
        .from('memberships')
        .select('group_id, role, family_role')
        .eq('user_id', userId)
        .eq('app_id', CURRENT_APP_ID);

      if (membershipError) throw membershipError;

      // 2. groups 테이블에서 사용자가 소유한 그룹 조회
      let { data: ownedGroupsData, error: ownedGroupsError } = await supabase
        .from('groups')
        .select('id')
        .eq('owner_id', userId)
        .eq('app_id', CURRENT_APP_ID);

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
        const rM = await supabase
          .from('memberships')
          .select('group_id, role, family_role')
          .eq('user_id', userId)
          .eq('app_id', CURRENT_APP_ID);
        const rO = await supabase
          .from('groups')
          .select('id')
          .eq('owner_id', userId)
          .eq('app_id', CURRENT_APP_ID);
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
          .eq('app_id', CURRENT_APP_ID)
          .maybeSingle();
        const { data: po } = await supabase
          .from('groups')
          .select('id')
          .eq('id', pinnedSaved)
          .eq('owner_id', userId)
          .eq('app_id', CURRENT_APP_ID)
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
        .eq('app_id', CURRENT_APP_ID)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      setGroups(groupsData || []);

      const ownedGroupIds = ownedGroupsData?.map((g) => g.id) || [];

      // 5. 멤버십 정보 매핑 (소유자인 경우 ADMIN 역할 부여)
      setMemberships(allGroupIds.map(groupId => {
        const membership = membershipData?.find(m => sameGroupId(m.group_id, groupId));
        const isOwner = ownedGroupIds.some((id) => sameGroupId(id, groupId));
        return {
          user_id: userId,
          group_id: normalizeGroupId(groupId) || groupId,
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
        if (selected) {
          setCurrentGroup(selected);
          persistGroupUiTheme(userId, selected);
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
        .eq('app_id', CURRENT_APP_ID)
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
            .eq('app_id', CURRENT_APP_ID)
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
        .eq('app_id', CURRENT_APP_ID)
        .maybeSingle();

      if (groupInfo) {
        setCurrentGroup(groupInfo);
        persistGroupUiTheme(userId, groupInfo);
      } else if (typeof window !== 'undefined') {
        // 일시적 REST/RLS 실패로 groups 조회가 비어도 currentGroupId를 지우지 않는다.
        // (지우면 위젯·앨범·loadData가 전부 skip되어 모든 계정에서 빈 대시보드가 됨)
        console.warn('[GroupContext] group info empty for', currentGroupId);
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

  // 그룹 로드 전: localStorage 캐시 / 로드 후: DB.
  // localStorage는 paint 전 layout effect에서만 읽어 SSR·하이드레이션 불일치 방지.
  // auth userId는 useEffect 이후라, groupId 전용 캐시로 선적용한다.
  const [uiTheme, setUiTheme] = useState<UiTheme>(DEFAULT_UI_THEME);
  const [uiThemeReady, setUiThemeReady] = useState(false);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const gid =
      normalizeGroupId(currentGroup?.id) ??
      normalizeGroupId(currentGroupId) ??
      readStoredGroupId();
    const cached = readStoredUiTheme(userId, gid);
    const known = Boolean(currentGroup) || Boolean(cached);
    const next = resolveEffectiveUiTheme({
      hasGroupRow: Boolean(currentGroup),
      dbValue: (currentGroup as { ui_theme?: unknown } | null)?.ui_theme,
      cachedTheme: cached,
    });
    setUiThemeReady(known);
    setUiTheme((prev) => (prev === next ? prev : next));
    // 미확정이면 kids DEFAULT로 data-ui-theme를 덮지 않음(잘못된 셸 플래시 방지)
    if (known) {
      document.documentElement.setAttribute('data-ui-theme', next);
    }
  }, [currentGroup, currentGroupId, userId]);

  const value: GroupContextType = {
    currentGroupId,
    currentGroup,
    uiTheme,
    uiThemeReady,
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
        <GroupEmailInviteHost userId={userId} />
        <JoinRequestOutcomeModalHost userId={userId} />
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

