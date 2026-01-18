'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Group, Membership, MembershipRole } from '@/types/db';

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

  // 그룹 목록 로드
  const refreshGroups = useCallback(async () => {
    if (!userId) {
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

    try {
      setLoading(true);
      setError(null);

      // 1. memberships 테이블에서 사용자가 속한 그룹 조회
      const { data: membershipData, error: membershipError } = await supabase
        .from('memberships')
        .select('group_id, role')
        .eq('user_id', userId);

      if (membershipError) throw membershipError;

      // 2. groups 테이블에서 사용자가 소유한 그룹 조회
      const { data: ownedGroupsData, error: ownedGroupsError } = await supabase
        .from('groups')
        .select('id')
        .eq('owner_id', userId);

      if (ownedGroupsError) throw ownedGroupsError;

      // 3. 모든 그룹 ID 수집 (memberships + 소유 그룹, 중복 제거)
      const membershipGroupIds = membershipData?.map(m => m.group_id) || [];
      const ownedGroupIds = ownedGroupsData?.map(g => g.id) || [];
      const allGroupIds = [...new Set([...membershipGroupIds, ...ownedGroupIds])];

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

      // 5. 멤버십 정보 매핑 (소유자인 경우 ADMIN 역할 부여)
      setMemberships(allGroupIds.map(groupId => {
        const membership = membershipData?.find(m => m.group_id === groupId);
        const isOwner = ownedGroupIds.includes(groupId);
        return {
          user_id: userId,
          group_id: groupId,
          role: isOwner ? 'ADMIN' : (membership?.role as MembershipRole || 'MEMBER'),
          joined_at: new Date().toISOString(),
        };
      }));

      // 현재 그룹이 없거나 삭제된 경우, 첫 번째 그룹으로 설정
      if (!currentGroupId || !groupsData?.find(g => g.id === currentGroupId)) {
        if (groupsData && groupsData.length > 0) {
          setCurrentGroupIdState(groupsData[0].id);
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
        .single();

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
            .single();

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
        .single();

      if (groupInfo) {
        setCurrentGroup(groupInfo);
      }
    } catch (err: any) {
      console.error('멤버십 정보 로드 실패:', err);
    }
  }, [userId, currentGroupId]);

  // 그룹 ID 변경 핸들러
  const setCurrentGroupId = useCallback((groupId: string | null) => {
    setCurrentGroupIdState(groupId);
    // localStorage에 저장 (선택사항)
    if (groupId) {
      localStorage.setItem('currentGroupId', groupId);
    } else {
      localStorage.removeItem('currentGroupId');
    }
  }, []);

  // 초기 로드 및 그룹 ID 복원
  useEffect(() => {
    if (userId && prevUserIdRef.current && prevUserIdRef.current !== userId) {
      setCurrentGroupIdState(null);
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

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
}

