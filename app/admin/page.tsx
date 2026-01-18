'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  UserPlus, 
  UserX, 
  Settings, 
  BarChart3, 
  Shield, 
  Loader2, 
  AlertCircle,
  X,
  Search,
  Crown,
  Image as ImageIcon,
  MapPin,
  Trash2,
  Megaphone,
  MessageSquare,
  KeyRound,
  Plus,
  Edit,
  Check,
  XCircle,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

interface UserInfo {
  id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;
  groups_count: number;
  is_active: boolean;
}

interface GroupInfo {
  id: string;
  name: string;
  owner_email: string | null;
  member_count: number;
  created_at: string;
  storage_quota_bytes?: number;
  storage_used_bytes?: number;
}

interface SystemStats {
  totalUsers: number;
  totalGroups: number;
  activeUsers: number;
  totalAdmins: number;
}

interface GroupDetailInfo {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  created_at: string;
  avatar_url: string | null;
  invite_code: string | null;
}

interface MemberInfo {
  user_id: string;
  email: string | null;
  nickname: string | null;
  role: string;
  joined_at: string;
}

interface PhotoInfo {
  id: string;
  image_url: string | null;
  cloudinary_url: string | null;
  s3_original_url: string | null;
  original_filename: string | null;
  created_at: string;
  uploader_id: string;
  caption: string | null;
}

interface LocationInfo {
  user_id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  updated_at: string;
  email: string | null;
  nickname: string | null;
}

interface GroupStats {
  totalMembers: number;
  totalPhotos: number;
  totalLocations: number;
  recentPhotos: number;
}

interface AnnouncementInfo {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface SupportTicketInfo {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string;
  content: string;
  status: 'pending' | 'answered' | 'closed';
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
  groups?: {
    id: string;
    name: string;
  };
}

interface DashboardAccessRequestInfo {
  id: string;
  group_id: string;
  requested_by: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  groups?: {
    id: string;
    name: string;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'groups' | 'group-admin' | 'announcements' | 'support-tickets' | 'dashboard-access-requests'>('dashboard');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [manageableGroups, setManageableGroups] = useState<GroupInfo[]>([]); // 관리 가능한 그룹만 (소유자 또는 ADMIN인 그룹)
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 그룹 관리 관련 상태
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetailInfo | null>(null);
  const [groupAdminTab, setGroupAdminTab] = useState<'dashboard' | 'members' | 'settings' | 'content'>('dashboard');
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [groupMembers, setGroupMembers] = useState<MemberInfo[]>([]);
  const [groupPhotos, setGroupPhotos] = useState<PhotoInfo[]>([]);
  const [groupLocations, setGroupLocations] = useState<LocationInfo[]>([]);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  // 공지사항, 문의, 접근 요청 관련 상태
  const [announcements, setAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketInfo[]>([]);
  const [accessRequests, setAccessRequests] = useState<DashboardAccessRequestInfo[]>([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementInfo | null>(null);
  const [editingTicket, setEditingTicket] = useState<SupportTicketInfo | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [ticketAnswer, setTicketAnswer] = useState('');
  const [accessRequestExpiresHours, setAccessRequestExpiresHours] = useState(24);

  const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return '0GB';
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb >= 1) return `${gb.toFixed(2)}GB`;
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)}MB`;
  };

  const getStoragePercent = (used: number | null | undefined, quota: number | null | undefined): number => {
    if (!used || !quota || quota <= 0) return 0;
    return Math.min((used / quota) * 100, 100);
  };

  // 관리자 권한 확인 및 초기 데이터 로드
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/dashboard');
          return;
        }

        const { data, error: adminError } = await supabase.rpc('is_system_admin', {
          user_id_param: user.id,
        });

        if (adminError || !data) {
          router.push('/dashboard');
          return;
        }

        setIsAuthorized(true);
        
        // 관리자 접근 시간 업데이트
        await supabase.rpc('update_admin_last_access');
      } catch (err) {
        console.error('관리자 권한 확인 오류:', err);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  // 초기 로드 시 관리 가능한 그룹 로드
  useEffect(() => {
    if (isAuthorized) {
      loadManageableGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // 통계 데이터 로드
  const loadStats = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      // 전체 사용자 수
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 전체 그룹 수
      const { count: totalGroups } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true });

      // 활성 사용자 수 (최근 30일 내 활동)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: activeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', thirtyDaysAgo.toISOString());

      // 시스템 관리자 수
      const { count: totalAdmins } = await supabase
        .from('system_admins')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalUsers: totalUsers || 0,
        totalGroups: totalGroups || 0,
        activeUsers: activeUsers || 0,
        totalAdmins: totalAdmins || 0,
      });
    } catch (err: any) {
      console.error('통계 로드 오류:', err);
      setError(err.message || '통계를 불러오는데 실패했습니다.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 사용자 목록 로드 (시스템 관리자용: auth.users에서 모든 사용자 조회)
  const loadUsers = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      // 현재 사용자 인증 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        setLoadingData(false);
        return;
      }

      // API 호출: 모든 사용자 목록 조회 (auth.users에서 직접 조회)
      const response = await fetch('/api/admin/users/list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '사용자 목록 조회에 실패했습니다.');
      }

      if (!result.success || !result.data) {
        setUsers([]);
        setLoadingData(false);
        return;
      }

      // UserInfo 형식으로 변환
      const usersWithGroups: UserInfo[] = result.data.map((user: any) => ({
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        created_at: user.created_at || new Date().toISOString(),
        groups_count: user.groups_count || 0,
        is_active: user.is_active !== false,
      }));

      // 최신 가입일 기준으로 정렬
      usersWithGroups.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setUsers(usersWithGroups);
    } catch (err: any) {
      console.error('사용자 목록 로드 오류:', err);
      setError(err.message || '사용자 목록을 불러오는데 실패했습니다.');
      setUsers([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 그룹 목록 로드
  const loadGroups = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('인증 정보를 가져올 수 없습니다.');
        setLoadingData(false);
        return;
      }

      const response = await fetch('/api/admin/group-storage', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '그룹 목록을 불러오는데 실패했습니다.');
          }

      setGroups(result.data || []);
    } catch (err: any) {
      console.error('그룹 목록 로드 오류:', err);
      setError(err.message || '그룹 목록을 불러오는데 실패했습니다.');
      setGroups([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 시스템 관리자가 소유자이거나 ADMIN인 그룹만 조회 (관리 가능한 그룹)
  const loadManageableGroups = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setManageableGroups([]);
        return;
      }

      // 1. 소유자인 그룹 조회
      const { data: ownedGroups, error: ownedError } = await supabase
        .from('groups')
        .select('id, name, owner_id, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (ownedError) {
        console.error('소유 그룹 조회 오류:', ownedError);
      }

      // 2. ADMIN 역할인 그룹 조회
      const { data: adminMemberships, error: adminError } = await supabase
        .from('memberships')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('role', 'ADMIN');

      if (adminError) {
        console.error('ADMIN 멤버십 조회 오류:', adminError);
      }

      const adminGroupIds = adminMemberships?.map(m => m.group_id) || [];
      
      let adminGroups: any[] = [];
      if (adminGroupIds.length > 0) {
        const { data, error: adminGroupsError } = await supabase
          .from('groups')
          .select('id, name, owner_id, created_at')
          .in('id', adminGroupIds)
          .order('created_at', { ascending: false });

        if (adminGroupsError) {
          console.error('ADMIN 그룹 조회 오류:', adminGroupsError);
        } else {
          adminGroups = data || [];
        }
      }

      // 3. 중복 제거 및 병합
      const allManageableGroupsMap = new Map();
      (ownedGroups || []).forEach(g => allManageableGroupsMap.set(g.id, g));
      (adminGroups || []).forEach(g => allManageableGroupsMap.set(g.id, g));
      const allManageableGroups = Array.from(allManageableGroupsMap.values());

      // 4. 상세 정보 추가 (소유자 이메일, 멤버 수)
      const groupsWithDetails: GroupInfo[] = await Promise.all(
        allManageableGroups.map(async (group) => {
          try {
            const { data: ownerData } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', group.owner_id)
              .single();

            let memberCount = 0;
            try {
              const { count } = await supabase
                .from('memberships')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id);
              memberCount = count || 0;
            } catch (countErr) {
              console.warn(`그룹 ${group.id} 멤버 수 조회 오류:`, countErr);
            }

            return {
              id: group.id,
              name: group.name,
              owner_email: ownerData?.email || null,
              member_count: memberCount + 1,
              created_at: group.created_at,
            };
          } catch (err: any) {
            console.error(`그룹 ${group.id} 상세 정보 로드 오류:`, err);
            return {
              id: group.id,
              name: group.name,
              owner_email: null,
              member_count: 1,
              created_at: group.created_at,
            };
          }
        })
      );

      setManageableGroups(groupsWithDetails);
    } catch (err: any) {
      console.error('관리 가능한 그룹 로드 오류:', err);
      setManageableGroups([]);
    }
  }, []);

  // 선택된 그룹 정보 로드 (권한 검증 포함)
  const loadSelectedGroup = useCallback(async (groupId: string) => {
    try {
      // 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('인증 정보를 가져올 수 없습니다.');
        setSelectedGroup(null);
        setSelectedGroupId(null);
        return;
      }

      // 그룹 정보 조회
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name, owner_id, created_at, avatar_url, invite_code')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      // 권한 확인: 소유자이거나 ADMIN인지 확인
      const isOwner = groupData.owner_id === user.id;
      let isAdmin = false;
      
      if (!isOwner) {
        const { data: membership } = await supabase
          .from('memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('group_id', groupId)
          .eq('role', 'ADMIN')
          .single();
        
        isAdmin = !!membership;
      }

      // 권한이 없으면 에러
      if (!isOwner && !isAdmin) {
        setError('이 그룹에 대한 관리 권한이 없습니다.');
        setSelectedGroup(null);
        setSelectedGroupId(null);
        return;
      }

      // 소유자 이메일 조회
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', groupData.owner_id)
        .single();

      setSelectedGroup({
        ...groupData,
        owner_email: ownerData?.email || null,
      });
      setError(null); // 권한 검증 통과 시 에러 초기화
    } catch (err: any) {
      console.error('그룹 정보 로드 오류:', err);
      setError(err.message || '그룹 정보를 불러오는데 실패했습니다.');
      setSelectedGroup(null);
      setSelectedGroupId(null);
    }
  }, []);

  // 그룹 통계 로드
  const loadGroupStats = useCallback(async (groupId: string) => {
    try {
      setLoadingData(true);
      setError(null);

      // 그룹 정보 가져오기 (소유자 ID 확인용)
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      // 그룹 멤버 수
      const { count: memberCount } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

      const totalMembers = memberCount || 0;

      // 그룹 멤버 ID 목록
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', groupId);

      const memberIds = membersData?.map(m => m.user_id) || [];
      
      // 그룹 소유자 추가
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      // 그룹 사진 수
      const { count: photoCount } = await supabase
        .from('memory_vault')
        .select('*', { count: 'exact', head: true })
        .in('uploader_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

      // 최근 7일 사진 수
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentPhotoCount } = await supabase
        .from('memory_vault')
        .select('*', { count: 'exact', head: true })
        .in('uploader_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('created_at', sevenDaysAgo.toISOString());

      // 위치 데이터 수
      const { count: locationCount } = await supabase
        .from('user_locations')
        .select('*', { count: 'exact', head: true })
        .in('user_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

      setGroupStats({
        totalMembers,
        totalPhotos: photoCount || 0,
        totalLocations: locationCount || 0,
        recentPhotos: recentPhotoCount || 0,
      });
    } catch (err: any) {
      console.error('그룹 통계 로드 오류:', err);
      setError(err.message || '통계를 불러오는데 실패했습니다.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 그룹 멤버 목록 로드
  const loadGroupMembers = useCallback(async (groupId: string) => {
    try {
      setLoadingData(true);
      setError(null);

      // 멤버십 조회
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('memberships')
        .select('user_id, role, joined_at')
        .eq('group_id', groupId);

      if (membershipsError) throw membershipsError;

      // 그룹 소유자 정보
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      const memberIds = membershipsData?.map(m => m.user_id) || [];
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      // 프로필 정보 조회
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, nickname, avatar_url')
        .in('id', memberIds);

      const membersWithProfiles: MemberInfo[] = (membershipsData || []).map(membership => {
        const profile = profilesData?.find(p => p.id === membership.user_id);
        return {
          user_id: membership.user_id,
          email: profile?.email || null,
          nickname: profile?.nickname || null,
          role: membership.role,
          joined_at: membership.joined_at,
        };
      });

      // 소유자 추가
      if (groupData?.owner_id) {
        const ownerProfile = profilesData?.find(p => p.id === groupData.owner_id);
        if (ownerProfile && !membersWithProfiles.find(m => m.user_id === groupData.owner_id)) {
          membersWithProfiles.unshift({
            user_id: groupData.owner_id,
            email: ownerProfile.email || null,
            nickname: ownerProfile.nickname || null,
            role: 'ADMIN',
            joined_at: new Date().toISOString(),
          });
        }
      }

      setGroupMembers(membersWithProfiles);
    } catch (err: any) {
      console.error('그룹 멤버 로드 오류:', err);
      setError(err.message || '멤버 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 그룹 사진 목록 로드
  const loadGroupPhotos = useCallback(async (groupId: string) => {
    try {
      setLoadingData(true);
      setError(null);

      // 그룹 정보 가져오기 (소유자 ID 확인용)
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      // 그룹 멤버 ID 목록
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', groupId);

      const memberIds = membersData?.map(m => m.user_id) || [];
      
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      if (memberIds.length === 0) {
        setGroupPhotos([]);
        setLoadingData(false);
        return;
      }

      const { data: photosData, error: photosError } = await supabase
        .from('memory_vault')
        .select('id, image_url, cloudinary_url, s3_original_url, original_filename, created_at, uploader_id, caption')
        .in('uploader_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (photosError) throw photosError;

      setGroupPhotos(photosData || []);
    } catch (err: any) {
      console.error('사진 목록 로드 오류:', err);
      setError(err.message || '사진 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 그룹 위치 데이터 로드
  const loadGroupLocations = useCallback(async (groupId: string) => {
    try {
      setLoadingData(true);
      setError(null);

      // 그룹 정보 가져오기 (소유자 ID 확인용)
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      // 그룹 멤버 ID 목록
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', groupId);

      const memberIds = membersData?.map(m => m.user_id) || [];
      
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      if (memberIds.length === 0) {
        setGroupLocations([]);
        setLoadingData(false);
        return;
      }

      const { data: locationsData, error: locationsError } = await supabase
        .from('user_locations')
        .select('user_id, latitude, longitude, address, updated_at')
        .in('user_id', memberIds);

      if (locationsError) throw locationsError;

      // 프로필 정보 조회
      const userIds = (locationsData || []).map(l => l.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds);

      const locationsWithProfiles: LocationInfo[] = (locationsData || []).map(location => {
        const profile = profilesData?.find(p => p.id === location.user_id);
        return {
          ...location,
          email: profile?.email || null,
          nickname: profile?.nickname || null,
        };
      });

      setGroupLocations(locationsWithProfiles);
    } catch (err: any) {
      console.error('위치 데이터 로드 오류:', err);
      setError(err.message || '위치 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 그룹 선택 변경
  useEffect(() => {
    if (selectedGroupId) {
      loadSelectedGroup(selectedGroupId);
    } else {
      setSelectedGroup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (!isAuthorized) return;

    if (activeTab === 'dashboard') {
      loadStats();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'groups') {
      loadGroups(); // 모든 그룹 조회 (그룹 목록 탭용)
      loadManageableGroups(); // 관리 가능한 그룹 조회 (관리하기 버튼용)
    } else if (activeTab === 'group-admin' && selectedGroupId) {
      // 그룹 관리 탭일 때만 데이터 로드
      if (groupAdminTab === 'dashboard') {
        loadGroupStats(selectedGroupId);
      } else if (groupAdminTab === 'members') {
        loadGroupMembers(selectedGroupId);
      } else if (groupAdminTab === 'content') {
        loadGroupPhotos(selectedGroupId);
        loadGroupLocations(selectedGroupId);
      }
    } else if (activeTab === 'announcements') {
      loadAnnouncements();
    } else if (activeTab === 'support-tickets') {
      loadSupportTickets();
    } else if (activeTab === 'dashboard-access-requests') {
      loadAccessRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthorized, groupAdminTab, selectedGroupId]);

  // 공지사항 로드
  const loadAnnouncements = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        setLoadingData(false);
        return;
      }

      const response = await fetch('/api/admin/announcements', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '공지사항 조회에 실패했습니다.');
      }

      setAnnouncements(result.data || []);
    } catch (err: any) {
      console.error('공지사항 로드 오류:', err);
      setError(err.message || '공지사항을 불러오는데 실패했습니다.');
      setAnnouncements([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 문의 목록 로드
  const loadSupportTickets = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        setLoadingData(false);
        return;
      }

      const response = await fetch('/api/admin/support-tickets', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '문의 조회에 실패했습니다.');
      }

      setSupportTickets(result.data || []);
    } catch (err: any) {
      console.error('문의 로드 오류:', err);
      setError(err.message || '문의를 불러오는데 실패했습니다.');
      setSupportTickets([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 접근 요청 목록 로드
  const loadAccessRequests = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        setLoadingData(false);
        return;
      }

      const response = await fetch('/api/admin/dashboard-access-requests', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '접근 요청 조회에 실패했습니다.');
      }

      setAccessRequests(result.data || []);
    } catch (err: any) {
      console.error('접근 요청 로드 오류:', err);
      setError(err.message || '접근 요청을 불러오는데 실패했습니다.');
      setAccessRequests([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 검색 필터링
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.nickname?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  });

  const filteredGroups = groups.filter((group) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      group.name.toLowerCase().includes(query) ||
      group.owner_email?.toLowerCase().includes(query) ||
      group.id.toLowerCase().includes(query)
    );
  });

  // 사진 삭제
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('정말로 이 사진을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoadingData(true);
      const { error } = await supabase
        .from('memory_vault')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      alert('사진이 삭제되었습니다.');
      if (selectedGroupId) {
        loadGroupPhotos(selectedGroupId);
        loadGroupStats(selectedGroupId);
      }
    } catch (err: any) {
      console.error('사진 삭제 오류:', err);
      alert(err.message || '사진 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoadingData(false);
    }
  };

  // 그룹 관리 탭으로 전환 (권한 검증 포함)
  const handleSelectGroupForAdmin = async (groupId: string) => {
    // 관리 가능한 그룹인지 확인
    const isManageable = manageableGroups.some(mg => mg.id === groupId);
    if (!isManageable) {
      alert('이 그룹에 대한 관리 권한이 없습니다. 그룹 소유자이거나 관리자로 등록된 그룹만 관리할 수 있습니다.');
      return;
    }
    
    setSelectedGroupId(groupId);
    setActiveTab('group-admin');
    setGroupAdminTab('dashboard');
    // 그룹 정보 로드 (권한 검증 포함)
    await loadSelectedGroup(groupId);
  };

  // 검색 필터링 (그룹 관리)
  const filteredGroupPhotos = groupPhotos.filter((photo) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      photo.original_filename?.toLowerCase().includes(query) ||
      photo.caption?.toLowerCase().includes(query) ||
      photo.id.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fa',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#64748b', fontSize: '16px' }}>권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div
      className="admin-page"
      style={{
      minHeight: '100vh',
      backgroundColor: '#f5f7fa',
      padding: '20px',
      }}
    >
      {/* 헤더 */}
      <div
        className="admin-header"
        style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <div
          className="admin-header-top"
          style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: '#9333ea',
              borderRadius: '12px',
              color: 'white',
            }}>
              <Shield style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0,
              }}>
                관리자 페이지
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: '4px 0 0 0',
              }}>
                시스템 관리 및 모니터링
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#e2e8f0',
              color: '#475569',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
            닫기
          </button>
        </div>

        {/* 탭 메뉴 */}
        <div
          className="admin-tabs"
          style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          }}
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dashboard' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'dashboard' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'dashboard' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <BarChart3 style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            대시보드
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'users' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'users' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Users style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            회원 관리
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'groups' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'groups' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'groups' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Settings style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            그룹 목록
          </button>
          <button
            onClick={() => {
              // 관리 가능한 그룹이 있는지 확인
              if (manageableGroups.length === 0) {
                alert('관리할 수 있는 그룹이 없습니다. 그룹 소유자이거나 관리자로 등록된 그룹만 관리할 수 있습니다.');
                return;
              }
              
              if (selectedGroupId || activeTab === 'group-admin') {
                setActiveTab('group-admin');
              } else {
                // 관리 가능한 그룹 목록에서 첫 번째 그룹 자동 선택
                if (manageableGroups.length > 0) {
                  setSelectedGroupId(manageableGroups[0].id);
                  setActiveTab('group-admin');
                } else {
                  alert('그룹 목록에서 그룹을 선택하고 "관리하기" 버튼을 클릭해주세요.');
                }
              }
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'group-admin' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'group-admin' 
                ? '#9333ea' 
                : (manageableGroups.length > 0 ? '#64748b' : '#94a3b8'),
              fontSize: '16px',
              fontWeight: activeTab === 'group-admin' ? '600' : '500',
              cursor: manageableGroups.length > 0 || activeTab === 'group-admin' ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: manageableGroups.length > 0 || activeTab === 'group-admin' ? 1 : 0.5,
            }}
          >
            <Shield style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            그룹 관리 {manageableGroups.length > 0 && `(${manageableGroups.length})`}
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'announcements' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'announcements' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'announcements' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Megaphone style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            공지 관리
          </button>
          <button
            onClick={() => setActiveTab('support-tickets')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'support-tickets' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'support-tickets' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'support-tickets' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            <MessageSquare style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            문의 관리
            {supportTickets.filter(t => t.status === 'pending').length > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: '600',
              }}>
                {supportTickets.filter(t => t.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dashboard-access-requests')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dashboard-access-requests' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'dashboard-access-requests' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'dashboard-access-requests' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            <KeyRound style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            접근 요청 관리
            {accessRequests.filter(r => r.status === 'pending').length > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: '600',
              }}>
                {accessRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div
        className="admin-content"
        style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#991b1b',
          }}>
            <AlertCircle style={{ width: '20px', height: '20px', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {loadingData ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
          }}>
            <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite', color: '#9333ea' }} />
            <span style={{ marginLeft: '12px', color: '#64748b' }}>로딩 중...</span>
          </div>
        ) : (
          <>
            {/* 대시보드 탭 */}
            {activeTab === 'dashboard' && stats && (
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '24px',
                }}>
                  시스템 통계
                </h2>
                <div
                  className="admin-grid"
                  style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: '24px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '12px',
                      border: '1px solid #bae6fd',
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      color: '#0369a1',
                      fontWeight: '500',
                      marginBottom: '8px',
                    }}>
                      전체 사용자
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#0c4a6e',
                    }}>
                      {stats.totalUsers.toLocaleString()}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{
                      padding: '24px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '12px',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      color: '#92400e',
                      fontWeight: '500',
                      marginBottom: '8px',
                    }}>
                      활성 사용자 (30일)
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#78350f',
                    }}>
                      {stats.activeUsers.toLocaleString()}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                      padding: '24px',
                      backgroundColor: '#f3e8ff',
                      borderRadius: '12px',
                      border: '1px solid #d8b4fe',
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      color: '#6b21a8',
                      fontWeight: '500',
                      marginBottom: '8px',
                    }}>
                      전체 그룹
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#581c87',
                    }}>
                      {stats.totalGroups.toLocaleString()}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    style={{
                      padding: '24px',
                      backgroundColor: '#fce7f3',
                      borderRadius: '12px',
                      border: '1px solid #fbcfe8',
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      color: '#9f1239',
                      fontWeight: '500',
                      marginBottom: '8px',
                    }}>
                      시스템 관리자
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#831843',
                    }}>
                      {stats.totalAdmins.toLocaleString()}
                    </div>
                  </motion.div>
                </div>

                {/* 가족 생성/가입 기능 버튼 */}
                <div style={{
                  marginTop: '32px',
                  padding: '24px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '12px',
                  }}>
                    가족 생성/가입
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#64748b',
                    marginBottom: '16px',
                  }}>
                    가족 그룹을 생성하거나 초대 코드로 가입할 수 있습니다.
                  </div>
                  <button
                    onClick={() => router.push('/onboarding?from=admin')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      backgroundColor: '#9333ea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(147, 51, 234, 0.2)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#7e22ce';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(147, 51, 234, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#9333ea';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(147, 51, 234, 0.2)';
                    }}
                  >
                    <UserPlus style={{ width: '18px', height: '18px' }} />
                    가족 생성/가입하기
                  </button>
                </div>
              </div>
            )}

            {/* 회원 관리 탭 */}
            {activeTab === 'users' && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                }}>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#1e293b',
                    margin: 0,
                  }}>
                    회원 목록 ({filteredUsers.length}명)
                  </h2>
                  <div
                    className="admin-search"
                    style={{
                    position: 'relative',
                    width: '300px',
                    }}
                  >
                    <Search style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '18px',
                      height: '18px',
                      color: '#94a3b8',
                    }} />
                    <input
                      type="text"
                      placeholder="이메일, 닉네임, ID로 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  overflowX: 'auto',
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: '#f8fafc',
                        borderBottom: '2px solid #e2e8f0',
                      }}>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                        }}>
                          이메일
                        </th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                        }}>
                          닉네임
                        </th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                        }}>
                          가입일
                        </th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                        }}>
                          그룹 수
                        </th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                        }}>
                          액션
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, index) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ padding: '12px', fontSize: '14px', color: '#1e293b' }}>
                            {user.email || '-'}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#1e293b' }}>
                            {user.nickname || '-'}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#64748b' }}>
                            {new Date(user.created_at).toLocaleDateString('ko-KR')}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#64748b' }}>
                            {user.groups_count}개
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <button
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#b91c1c';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#dc2626';
                              }}
                              onClick={async () => {
                                // 현재 로그인한 사용자 확인
                                const { data: { user: currentUser } } = await supabase.auth.getUser();
                                
                                // 시스템 관리자 본인은 삭제 불가
                                if (currentUser?.id === user.id) {
                                  alert('본인의 계정은 삭제할 수 없습니다.');
                                  return;
                                }

                                const userDisplayName = user.email || user.nickname || '이 사용자';
                                const confirmMessage = `정말로 "${userDisplayName}" 회원을 강제 탈퇴 처리하시겠습니까?\n\n⚠️ 경고: 이 작업은 되돌릴 수 없습니다.\n- 사용자 계정이 영구적으로 삭제됩니다.\n- 관련된 모든 데이터가 삭제됩니다.\n- 모든 그룹에서 자동으로 제거됩니다.`;
                                
                                if (!confirm(confirmMessage)) {
                                  return;
                                }

                                try {
                                  setLoadingData(true);
                                  const { data: { session } } = await supabase.auth.getSession();
                                  if (!session?.access_token) {
                                    alert('인증 정보를 가져올 수 없습니다.');
                                    return;
                                  }

                                  const response = await fetch('/api/admin/users/delete', {
                                    method: 'DELETE',
                                    headers: {
                                      'Authorization': `Bearer ${session.access_token}`,
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ userId: user.id }),
                                  });

                                  const result = await response.json();

                                  if (!response.ok) {
                                    throw new Error(result.error || '회원 강제 탈퇴에 실패했습니다.');
                                  }

                                  alert(`"${userDisplayName}" 회원이 강제 탈퇴 처리되었습니다.`);
                                  loadUsers(); // 목록 새로고침
                                } catch (error: any) {
                                  console.error('회원 강제 탈퇴 오류:', error);
                                  alert(error.message || '회원 강제 탈퇴 중 오류가 발생했습니다.');
                                } finally {
                                  setLoadingData(false);
                                }
                              }}
                            >
                              <UserX style={{ width: '14px', height: '14px' }} />
                              회원 강제 탈퇴
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredUsers.length === 0 && (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      <Users style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>사용자가 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 그룹 관리 탭 */}
            {activeTab === 'groups' && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                }}>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#1e293b',
                    margin: 0,
                  }}>
                    그룹 목록 ({filteredGroups.length}개)
                  </h2>
                  <div
                    className="admin-search"
                    style={{
                    position: 'relative',
                    width: '300px',
                    }}
                  >
                    <Search style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '18px',
                      height: '18px',
                      color: '#94a3b8',
                    }} />
                    <input
                      type="text"
                      placeholder="그룹명, 소유자 이메일로 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="admin-grid"
                  style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '16px',
                  }}
                >
                  {filteredGroups.map((group, index) => {
                    const usedBytes = group.storage_used_bytes || 0;
                    const quotaBytes = group.storage_quota_bytes || 0;
                    const percent = getStoragePercent(usedBytes, quotaBytes);

                    return (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{
                        padding: '20px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                      }}>
                        <h3 style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#1e293b',
                          margin: 0,
                        }}>
                          {group.name}
                        </h3>
                        <Crown style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#64748b',
                        marginBottom: '8px',
                      }}>
                        소유자: {group.owner_email || '-'}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#64748b',
                          marginBottom: '8px',
                      }}>
                        멤버: {group.member_count}명
                      </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#64748b',
                          marginBottom: '12px',
                        }}>
                          용량: {formatBytes(usedBytes)} / {formatBytes(quotaBytes)} ({percent.toFixed(0)}%)
                        </div>
                        <div style={{
                          height: '6px',
                          backgroundColor: '#e2e8f0',
                          borderRadius: '999px',
                          overflow: 'hidden',
                          marginBottom: '16px',
                        }}>
                          <div style={{
                            width: `${percent}%`,
                            height: '100%',
                            backgroundColor: percent >= 90 ? '#ef4444' : percent >= 70 ? '#f59e0b' : '#22c55e',
                            transition: 'width 0.2s',
                          }} />
                        </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginBottom: '16px',
                      }}>
                        생성일: {new Date(group.created_at).toLocaleDateString('ko-KR')}
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                          flexWrap: 'wrap',
                      }}>
                          <button
                            style={{
                              flex: '1 1 120px',
                              padding: '8px 12px',
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                            onClick={async () => {
                              const currentGb = quotaBytes ? (quotaBytes / 1024 / 1024 / 1024).toFixed(2) : '5';
                              const input = prompt('그룹 용량(GB)을 입력하세요.', currentGb);
                              if (!input) return;
                              const nextGb = Number(input);
                              if (!Number.isFinite(nextGb) || nextGb <= 0) {
                                alert('유효한 GB 값을 입력해주세요.');
                                return;
                              }

                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert('인증 정보를 가져올 수 없습니다.');
                                  return;
                                }

                                const response = await fetch('/api/admin/group-storage', {
                                  method: 'PATCH',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    groupId: group.id,
                                    storageQuotaGb: nextGb,
                                  }),
                                });

                                const result = await response.json();
                                if (!response.ok) {
                                  throw new Error(result.error || '용량 변경에 실패했습니다.');
                                }

                                await loadGroups();
                              } catch (error: any) {
                                alert(error.message || '용량 변경 중 오류가 발생했습니다.');
                              }
                            }}
                          >
                            용량 설정
                          </button>
                        {/* 관리 가능한 그룹에만 "관리하기" 버튼 표시 */}
                        {manageableGroups.some(mg => mg.id === group.id) && (
                          <button
                            style={{
                              flex: 1,
                              padding: '8px 16px',
                              backgroundColor: '#9333ea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleSelectGroupForAdmin(group.id)}
                          >
                            관리하기
                          </button>
                        )}
                        <button
                          style={{
                            flex: manageableGroups.some(mg => mg.id === group.id) ? 1 : 1,
                            width: manageableGroups.some(mg => mg.id === group.id) ? 'auto' : '100%',
                            padding: '8px 16px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                          onClick={async () => {
                            if (!confirm(`정말로 "${group.name}" 그룹을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
                              return;
                            }

                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert('인증 정보를 가져올 수 없습니다.');
                                return;
                              }

                              const response = await fetch('/api/admin/groups/delete', {
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ groupId: group.id }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || '그룹 삭제에 실패했습니다.');
                              }

                              alert('그룹이 삭제되었습니다.');
                              loadGroups(); // 목록 새로고침
                              loadManageableGroups(); // 관리 가능한 그룹 목록도 새로고침
                            } catch (error: any) {
                              console.error('그룹 삭제 오류:', error);
                              alert(error.message || '그룹 삭제 중 오류가 발생했습니다.');
                            }
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </motion.div>
                    );
                  })}
                </div>

                {filteredGroups.length === 0 && (
                  <div style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: '#94a3b8',
                  }}>
                    <Settings style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                    <p>그룹이 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 그룹 관리 탭 (시스템 관리자가 그룹을 관리하는 탭) */}
            {activeTab === 'group-admin' && (
              <div>
                {/* 그룹 선택 드롭다운 */}
                <div style={{
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '8px',
                  }}>
                    관리할 그룹 선택
                  </label>
                  <select
                    value={selectedGroupId || ''}
                    onChange={async (e) => {
                      const groupId = e.target.value;
                      setSelectedGroupId(groupId || null);
                      setGroupAdminTab('dashboard');
                      if (groupId) {
                        await loadSelectedGroup(groupId);
                      } else {
                        setSelectedGroup(null);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">그룹을 선택하세요</option>
                    {/* 관리 가능한 그룹만 표시 */}
                    {manageableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.member_count}명)
                      </option>
                    ))}
                  </select>
                  {manageableGroups.length === 0 && (
                    <p style={{
                      marginTop: '8px',
                      fontSize: '13px',
                      color: '#f59e0b',
                      fontStyle: 'italic',
                    }}>
                      관리할 수 있는 그룹이 없습니다. 그룹 소유자이거나 관리자로 등록된 그룹만 관리할 수 있습니다.
                    </p>
                  )}
                </div>

                {selectedGroup && (
                  <>
                    {/* 그룹 관리 서브 탭 */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      borderBottom: '2px solid #e2e8f0',
                      marginBottom: '24px',
                    }}>
                      <button
                        onClick={() => setGroupAdminTab('dashboard')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'dashboard' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'dashboard' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'dashboard' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <BarChart3 style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        대시보드
                      </button>
                      <button
                        onClick={() => setGroupAdminTab('members')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'members' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'members' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'members' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Users style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        멤버 관리
                      </button>
                      <button
                        onClick={() => setGroupAdminTab('settings')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'settings' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'settings' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'settings' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Settings style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        그룹 설정
                      </button>
                      <button
                        onClick={() => setGroupAdminTab('content')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'content' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'content' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'content' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <ImageIcon style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        콘텐츠 관리
                      </button>
                    </div>

                    {/* 대시보드 서브 탭 */}
                    {groupAdminTab === 'dashboard' && groupStats && (
                      <div>
                        <h2 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '24px',
                        }}>
                          그룹 통계
                        </h2>
                        <div
                          className="admin-grid"
                          style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '16px',
                          }}
                        >
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                              padding: '24px',
                              backgroundColor: '#f0f9ff',
                              borderRadius: '12px',
                              border: '1px solid #bae6fd',
                            }}
                          >
                            <div style={{
                              fontSize: '14px',
                              color: '#0369a1',
                              fontWeight: '500',
                              marginBottom: '8px',
                            }}>
                              전체 멤버
                            </div>
                            <div style={{
                              fontSize: '32px',
                              fontWeight: '700',
                              color: '#0c4a6e',
                            }}>
                              {groupStats.totalMembers.toLocaleString()}
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            style={{
                              padding: '24px',
                              backgroundColor: '#fef3c7',
                              borderRadius: '12px',
                              border: '1px solid #fde68a',
                            }}
                          >
                            <div style={{
                              fontSize: '14px',
                              color: '#92400e',
                              fontWeight: '500',
                              marginBottom: '8px',
                            }}>
                              전체 사진
                            </div>
                            <div style={{
                              fontSize: '32px',
                              fontWeight: '700',
                              color: '#78350f',
                            }}>
                              {groupStats.totalPhotos.toLocaleString()}
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            style={{
                              padding: '24px',
                              backgroundColor: '#f3e8ff',
                              borderRadius: '12px',
                              border: '1px solid #d8b4fe',
                            }}
                          >
                            <div style={{
                              fontSize: '14px',
                              color: '#6b21a8',
                              fontWeight: '500',
                              marginBottom: '8px',
                            }}>
                              최근 7일 사진
                            </div>
                            <div style={{
                              fontSize: '32px',
                              fontWeight: '700',
                              color: '#581c87',
                            }}>
                              {groupStats.recentPhotos.toLocaleString()}
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            style={{
                              padding: '24px',
                              backgroundColor: '#fce7f3',
                              borderRadius: '12px',
                              border: '1px solid #fbcfe8',
                            }}
                          >
                            <div style={{
                              fontSize: '14px',
                              color: '#9f1239',
                              fontWeight: '500',
                              marginBottom: '8px',
                            }}>
                              위치 데이터
                            </div>
                            <div style={{
                              fontSize: '32px',
                              fontWeight: '700',
                              color: '#831843',
                            }}>
                              {groupStats.totalLocations.toLocaleString()}
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    )}

                    {/* 멤버 관리 서브 탭 */}
                    {groupAdminTab === 'members' && (
                      <div>
                        <h2 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '24px',
                        }}>
                          멤버 관리 ({groupMembers.length}명)
                        </h2>
                        <div style={{
                          overflowX: 'auto',
                        }}>
                          <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                          }}>
                            <thead>
                              <tr style={{
                                backgroundColor: '#f8fafc',
                                borderBottom: '2px solid #e2e8f0',
                              }}>
                                <th style={{
                                  padding: '12px',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#475569',
                                }}>
                                  이메일
                                </th>
                                <th style={{
                                  padding: '12px',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#475569',
                                }}>
                                  닉네임
                                </th>
                                <th style={{
                                  padding: '12px',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#475569',
                                }}>
                                  역할
                                </th>
                                <th style={{
                                  padding: '12px',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#475569',
                                }}>
                                  가입일
                                </th>
                                <th style={{
                                  padding: '12px',
                                  textAlign: 'right',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#475569',
                                }}>
                                  액션
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupMembers.map((member, index) => (
                                <motion.tr
                                  key={member.user_id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  style={{
                                    borderBottom: '1px solid #e2e8f0',
                                    transition: 'background-color 0.2s',
                                  }}
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
                                    {member.nickname || '-'}
                                  </td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: '#64748b' }}>
                                    <span style={{
                                      padding: '4px 8px',
                                      backgroundColor: member.role === 'ADMIN' || selectedGroup.owner_id === member.user_id ? '#dbeafe' : '#f3f4f6',
                                      color: member.role === 'ADMIN' || selectedGroup.owner_id === member.user_id ? '#1e40af' : '#374151',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                    }}>
                                      {selectedGroup.owner_id === member.user_id ? '소유자' : (member.role === 'ADMIN' ? '관리자' : '멤버')}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: '#64748b' }}>
                                    {new Date(member.joined_at).toLocaleDateString('ko-KR')}
                                  </td>
                                  <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                      {selectedGroup.owner_id !== member.user_id && (
                                        <button
                                          style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#fee2e2',
                                            color: '#991b1b',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'all 0.2s',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#fecaca';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#fee2e2';
                                          }}
                                          onClick={async () => {
                                            if (!confirm(`정말로 ${member.email || member.nickname || '이 멤버'}를 "${selectedGroup.name}" 그룹에서 추방하시겠습니까?`)) {
                                              return;
                                            }

                                            try {
                                              setLoadingData(true);
                                              const { error } = await supabase
                                                .from('memberships')
                                                .delete()
                                                .eq('user_id', member.user_id)
                                                .eq('group_id', selectedGroupId!);

                                              if (error) throw error;

                                              alert('멤버가 그룹에서 추방되었습니다.');
                                              if (selectedGroupId) {
                                                loadGroupMembers(selectedGroupId);
                                                loadGroupStats(selectedGroupId);
                                              }
                                            } catch (err: any) {
                                              console.error('멤버 추방 오류:', err);
                                              alert(err.message || '멤버 추방 중 오류가 발생했습니다.');
                                            } finally {
                                              setLoadingData(false);
                                            }
                                          }}
                                        >
                                          <UserX style={{ width: '14px', height: '14px' }} />
                                          추방
                                        </button>
                                      )}
                                      <button
                                        style={{
                                          padding: '6px 12px',
                                          backgroundColor: '#dc2626',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#b91c1c';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = '#dc2626';
                                        }}
                                        onClick={async () => {
                                          // 현재 로그인한 사용자 확인
                                          const { data: { user: currentUser } } = await supabase.auth.getUser();
                                          
                                          // 시스템 관리자 본인은 삭제 불가
                                          if (currentUser?.id === member.user_id) {
                                            alert('본인의 계정은 삭제할 수 없습니다.');
                                            return;
                                          }

                                          const userDisplayName = member.email || member.nickname || '이 사용자';
                                          const confirmMessage = `정말로 "${userDisplayName}" 회원을 강제 탈퇴 처리하시겠습니까?\n\n⚠️ 경고: 이 작업은 되돌릴 수 없습니다.\n- 사용자 계정이 영구적으로 삭제됩니다.\n- 관련된 모든 데이터가 삭제됩니다.\n- 모든 그룹에서 자동으로 제거됩니다.`;
                                          
                                          if (!confirm(confirmMessage)) {
                                            return;
                                          }

                                          try {
                                            setLoadingData(true);
                                            const { data: { session } } = await supabase.auth.getSession();
                                            if (!session?.access_token) {
                                              alert('인증 정보를 가져올 수 없습니다.');
                                              return;
                                            }

                                            const response = await fetch('/api/admin/users/delete', {
                                              method: 'DELETE',
                                              headers: {
                                                'Authorization': `Bearer ${session.access_token}`,
                                                'Content-Type': 'application/json',
                                              },
                                              body: JSON.stringify({ userId: member.user_id }),
                                            });

                                            const result = await response.json();

                                            if (!response.ok) {
                                              throw new Error(result.error || '회원 강제 탈퇴에 실패했습니다.');
                                            }

                                            alert(`"${userDisplayName}" 회원이 강제 탈퇴 처리되었습니다.`);
                                            if (selectedGroupId) {
                                              loadGroupMembers(selectedGroupId);
                                              loadGroupStats(selectedGroupId);
                                            }
                                          } catch (error: any) {
                                            console.error('회원 강제 탈퇴 오류:', error);
                                            alert(error.message || '회원 강제 탈퇴 중 오류가 발생했습니다.');
                                          } finally {
                                            setLoadingData(false);
                                          }
                                        }}
                                      >
                                        <UserX style={{ width: '14px', height: '14px' }} />
                                        회원 강제 탈퇴
                                      </button>
                                    </div>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                          {groupMembers.length === 0 && (
                            <div style={{
                              padding: '48px',
                              textAlign: 'center',
                              color: '#94a3b8',
                            }}>
                              <Users style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                              <p>멤버가 없습니다.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 그룹 설정 서브 탭 */}
                    {groupAdminTab === 'settings' && (
                      <div>
                        <h2 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '24px',
                        }}>
                          그룹 설정
                        </h2>
                        <div style={{
                          padding: '24px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}>
                          <p style={{ color: '#64748b', fontSize: '14px' }}>
                            그룹 설정 기능은 곧 추가될 예정입니다.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 콘텐츠 관리 서브 탭 */}
                    {groupAdminTab === 'content' && (
                      <div>
                        <h2 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '24px',
                        }}>
                          콘텐츠 관리
                        </h2>
                        <div
                          className="admin-grid"
                          style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '16px',
                          marginBottom: '24px',
                          }}
                        >
                          {groupPhotos.slice(0, 20).map((photo, index) => (
                            <motion.div
                              key={photo.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              style={{
                                position: 'relative',
                                aspectRatio: '1',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                const url = photo.image_url || photo.cloudinary_url || photo.s3_original_url;
                                if (url) window.open(url, '_blank');
                              }}
                            >
                              {photo.image_url || photo.cloudinary_url || photo.s3_original_url ? (
                                <img
                                  src={photo.image_url || photo.cloudinary_url || photo.s3_original_url || ''}
                                  alt={photo.original_filename || '사진'}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  backgroundColor: '#f1f5f9',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <ImageIcon style={{ width: '32px', height: '32px', color: '#94a3b8' }} />
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(photo.id);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  padding: '6px',
                                  backgroundColor: 'rgba(220, 38, 38, 0.9)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Trash2 style={{ width: '14px', height: '14px' }} />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                        {groupPhotos.length === 0 && (
                          <div style={{
                            padding: '48px',
                            textAlign: 'center',
                            color: '#94a3b8',
                          }}>
                            <ImageIcon style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                            <p>사진이 없습니다.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {!selectedGroup && (
                  <div style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: '#94a3b8',
                  }}>
                    <Shield style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                    <p>관리할 그룹을 선택해주세요.</p>
                  </div>
                )}
              </div>
            )}

            {/* 공지 관리 탭 */}
            {activeTab === 'announcements' && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                }}>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#1e293b',
                    margin: 0,
                  }}>
                    공지사항 관리
                  </h2>
                  <button
                    onClick={() => {
                      setEditingAnnouncement(null);
                      setAnnouncementTitle('');
                      setAnnouncementContent('');
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#9333ea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Plus style={{ width: '18px', height: '18px' }} />
                    새 공지 작성
                  </button>
                </div>

                {/* 공지 목록 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}>
                  {announcements.map((announcement) => (
                    <motion.div
                      key={announcement.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '20px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                      }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#1e293b',
                            margin: '0 0 8px 0',
                          }}>
                            {announcement.title}
                          </h3>
                          <p style={{
                            fontSize: '14px',
                            color: '#64748b',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                          }}>
                            {announcement.content}
                          </p>
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginLeft: '16px',
                        }}>
                          <button
                            onClick={async () => {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert('인증 정보를 가져올 수 없습니다.');
                                return;
                              }

                              try {
                                setLoadingData(true);
                                const response = await fetch(`/api/admin/announcements?id=${announcement.id}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || '공지 삭제에 실패했습니다.');
                                }

                                alert('공지가 삭제되었습니다.');
                                loadAnnouncements();
                              } catch (error: any) {
                                console.error('공지 삭제 오류:', error);
                                alert(error.message || '공지 삭제 중 오류가 발생했습니다.');
                              } finally {
                                setLoadingData(false);
                              }
                            }}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '12px',
                      }}>
                        작성일: {new Date(announcement.created_at).toLocaleString('ko-KR')}
                        {announcement.updated_at !== announcement.created_at && ` | 수정일: ${new Date(announcement.updated_at).toLocaleString('ko-KR')}`}
                        {!announcement.is_active && ' | 비활성화됨'}
                      </div>
                    </motion.div>
                  ))}
                  {announcements.length === 0 && (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      <Megaphone style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>공지사항이 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* 공지 작성/수정 모달 */}
                {editingAnnouncement !== undefined && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                  onClick={() => {
                    setEditingAnnouncement(null);
                    setAnnouncementTitle('');
                    setAnnouncementContent('');
                  }}
                  >
                    <div style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '24px',
                      width: '90%',
                      maxWidth: '600px',
                      maxHeight: '80vh',
                      overflow: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '16px',
                      }}>
                        {editingAnnouncement ? '공지 수정' : '새 공지 작성'}
                      </h3>
                      <input
                        type="text"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        placeholder="제목을 입력하세요..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontFamily: 'inherit',
                          marginBottom: '16px',
                        }}
                      />
                      <textarea
                        value={announcementContent}
                        onChange={(e) => setAnnouncementContent(e.target.value)}
                        placeholder="내용을 입력하세요..."
                        style={{
                          width: '100%',
                          minHeight: '300px',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          marginBottom: '16px',
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                      }}>
                        <button
                          onClick={() => {
                            setEditingAnnouncement(null);
                            setAnnouncementTitle('');
                            setAnnouncementContent('');
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#e2e8f0',
                            color: '#475569',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          취소
                        </button>
                        <button
                          onClick={async () => {
                            if (!announcementTitle.trim() || !announcementContent.trim()) {
                              alert('제목과 내용을 모두 입력해주세요.');
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert('인증 정보를 가져올 수 없습니다.');
                                return;
                              }

                              if (editingAnnouncement) {
                                // 수정
                                const response = await fetch('/api/admin/announcements', {
                                  method: 'PUT',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: editingAnnouncement.id,
                                    title: announcementTitle,
                                    content: announcementContent,
                                    is_active: true,
                                  }),
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || '공지 수정에 실패했습니다.');
                                }

                                alert('공지가 수정되었습니다.');
                              } else {
                                // 작성
                                const response = await fetch('/api/admin/announcements', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    title: announcementTitle,
                                    content: announcementContent,
                                    is_active: true,
                                  }),
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || '공지 작성에 실패했습니다.');
                                }

                                alert('공지가 작성되었습니다.');
                              }

                              setEditingAnnouncement(null);
                              setAnnouncementTitle('');
                              setAnnouncementContent('');
                              loadAnnouncements();
                            } catch (error: any) {
                              console.error('공지 작성/수정 오류:', error);
                              alert(error.message || '공지 작성/수정 중 오류가 발생했습니다.');
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#9333ea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          {editingAnnouncement ? '수정' : '작성'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 문의 관리 탭 */}
            {activeTab === 'support-tickets' && (
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '24px',
                }}>
                  문의 관리 ({supportTickets.filter(t => t.status === 'pending').length}개 대기중)
                </h2>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}>
                  {supportTickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '20px',
                        backgroundColor: ticket.status === 'pending' ? '#fef3c7' : '#f8fafc',
                        borderRadius: '12px',
                        border: `1px solid ${ticket.status === 'pending' ? '#fde68a' : '#e2e8f0'}`,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px',
                          }}>
                            <h3 style={{
                              fontSize: '18px',
                              fontWeight: '600',
                              color: '#1e293b',
                              margin: 0,
                            }}>
                              {ticket.title}
                            </h3>
                            <span style={{
                              padding: '4px 12px',
                              backgroundColor: ticket.status === 'pending' ? '#fbbf24' : ticket.status === 'answered' ? '#10b981' : '#94a3b8',
                              color: 'white',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}>
                              {ticket.status === 'pending' ? '대기중' : ticket.status === 'answered' ? '답변완료' : '닫힘'}
                            </span>
                            {ticket.groups && (
                              <span style={{
                                fontSize: '14px',
                                color: '#64748b',
                              }}>
                                그룹: {ticket.groups.name}
                              </span>
                            )}
                          </div>
                          <p style={{
                            fontSize: '14px',
                            color: '#64748b',
                            margin: '0 0 12px 0',
                            whiteSpace: 'pre-wrap',
                          }}>
                            {ticket.content}
                          </p>
                          {ticket.answer && (
                            <div style={{
                              marginTop: '16px',
                              padding: '16px',
                              backgroundColor: '#f0f9ff',
                              borderRadius: '8px',
                              border: '1px solid #bae6fd',
                            }}>
                              <div style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#0369a1',
                                marginBottom: '8px',
                              }}>
                                답변:
                              </div>
                              <p style={{
                                fontSize: '14px',
                                color: '#1e293b',
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                              }}>
                                {ticket.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {ticket.status === 'pending' && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginTop: '16px',
                        }}>
                          <button
                            onClick={async () => {
                              setEditingTicket(ticket);
                              setTicketAnswer(ticket.answer || '');
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#9333ea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            답변하기
                          </button>
                        </div>
                      )}
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '12px',
                      }}>
                        작성일: {new Date(ticket.created_at).toLocaleString('ko-KR')}
                        {ticket.answered_at && ` | 답변일: ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {supportTickets.length === 0 && (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      <MessageSquare style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>문의가 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* 답변 모달 */}
                {editingTicket && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                  onClick={() => setEditingTicket(null)}
                  >
                    <div style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '24px',
                      width: '90%',
                      maxWidth: '600px',
                      maxHeight: '80vh',
                      overflow: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '16px',
                      }}>
                        답변 작성
                      </h3>
                      <textarea
                        value={ticketAnswer}
                        onChange={(e) => setTicketAnswer(e.target.value)}
                        placeholder="답변을 입력하세요..."
                        style={{
                          width: '100%',
                          minHeight: '200px',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          marginBottom: '16px',
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                      }}>
                        <button
                          onClick={() => {
                            setEditingTicket(null);
                            setTicketAnswer('');
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#e2e8f0',
                            color: '#475569',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          취소
                        </button>
                        <button
                          onClick={async () => {
                            if (!ticketAnswer.trim()) {
                              alert('답변 내용을 입력해주세요.');
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert('인증 정보를 가져올 수 없습니다.');
                                return;
                              }

                              const response = await fetch('/api/admin/support-tickets', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  id: editingTicket.id,
                                  answer: ticketAnswer,
                                  status: 'answered',
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || '답변 작성에 실패했습니다.');
                              }

                              alert('답변이 작성되었습니다.');
                              setEditingTicket(null);
                              setTicketAnswer('');
                              loadSupportTickets();
                            } catch (error: any) {
                              console.error('답변 작성 오류:', error);
                              alert(error.message || '답변 작성 중 오류가 발생했습니다.');
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#9333ea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          답변 작성
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 접근 요청 관리 탭 */}
            {activeTab === 'dashboard-access-requests' && (
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '24px',
                }}>
                  대시보드 접근 요청 관리 ({accessRequests.filter(r => r.status === 'pending').length}개 대기중)
                </h2>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}>
                  {accessRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '20px',
                        backgroundColor: request.status === 'pending' ? '#fef3c7' : request.status === 'approved' ? '#d1fae5' : '#f8fafc',
                        borderRadius: '12px',
                        border: `1px solid ${request.status === 'pending' ? '#fde68a' : request.status === 'approved' ? '#a7f3d0' : '#e2e8f0'}`,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px',
                          }}>
                            {request.groups && (
                              <h3 style={{
                                fontSize: '18px',
                                fontWeight: '600',
                                color: '#1e293b',
                                margin: 0,
                              }}>
                                {request.groups.name}
                              </h3>
                            )}
                            <span style={{
                              padding: '4px 12px',
                              backgroundColor: request.status === 'pending' ? '#fbbf24' : request.status === 'approved' ? '#10b981' : request.status === 'rejected' ? '#ef4444' : '#94a3b8',
                              color: 'white',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}>
                              {request.status === 'pending' ? '대기중' : request.status === 'approved' ? '승인됨' : request.status === 'rejected' ? '거절됨' : request.status === 'expired' ? '만료됨' : '취소됨'}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '14px',
                            color: '#64748b',
                            margin: '0 0 12px 0',
                            whiteSpace: 'pre-wrap',
                          }}>
                            {request.reason}
                          </p>
                          {request.status === 'approved' && request.expires_at && (
                            <div style={{
                              fontSize: '14px',
                              color: '#059669',
                              marginBottom: '8px',
                            }}>
                              만료일: {new Date(request.expires_at).toLocaleString('ko-KR')}
                            </div>
                          )}
                          {request.status === 'rejected' && request.rejection_reason && (
                            <div style={{
                              marginTop: '12px',
                              padding: '12px',
                              backgroundColor: '#fee2e2',
                              borderRadius: '8px',
                              border: '1px solid #fecaca',
                            }}>
                              <div style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#991b1b',
                                marginBottom: '4px',
                              }}>
                                거절 사유:
                              </div>
                              <p style={{
                                fontSize: '14px',
                                color: '#1e293b',
                                margin: 0,
                              }}>
                                {request.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginTop: '16px',
                        }}>
                          <button
                            onClick={async () => {
                              try {
                                setLoadingData(true);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert('인증 정보를 가져올 수 없습니다.');
                                  return;
                                }

                                const response = await fetch('/api/admin/dashboard-access-requests', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: request.id,
                                    action: 'approve',
                                    expires_hours: accessRequestExpiresHours,
                                  }),
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || '승인에 실패했습니다.');
                                }

                                alert('접근 요청이 승인되었습니다.');
                                loadAccessRequests();
                              } catch (error: any) {
                                console.error('승인 오류:', error);
                                alert(error.message || '승인 중 오류가 발생했습니다.');
                              } finally {
                                setLoadingData(false);
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            승인
                          </button>
                          <button
                            onClick={async () => {
                              const reason = prompt('거절 사유를 입력하세요:');
                              if (!reason) return;

                              try {
                                setLoadingData(true);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert('인증 정보를 가져올 수 없습니다.');
                                  return;
                                }

                                const response = await fetch('/api/admin/dashboard-access-requests', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: request.id,
                                    action: 'reject',
                                    rejection_reason: reason,
                                  }),
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || '거절에 실패했습니다.');
                                }

                                alert('접근 요청이 거절되었습니다.');
                                loadAccessRequests();
                              } catch (error: any) {
                                console.error('거절 오류:', error);
                                alert(error.message || '거절 중 오류가 발생했습니다.');
                              } finally {
                                setLoadingData(false);
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            거절
                          </button>
                        </div>
                      )}
                      {request.status === 'approved' && request.expires_at && new Date(request.expires_at) > new Date() && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginTop: '16px',
                        }}>
                          <button
                            onClick={async () => {
                              if (!confirm('정말로 이 접근 권한을 취소하시겠습니까?')) {
                                return;
                              }

                              try {
                                setLoadingData(true);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert('인증 정보를 가져올 수 없습니다.');
                                  return;
                                }

                                const response = await fetch('/api/admin/dashboard-access-requests', {
                                  method: 'PUT',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: request.id,
                                  }),
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || '취소에 실패했습니다.');
                                }

                                alert('접근 권한이 취소되었습니다.');
                                loadAccessRequests();
                              } catch (error: any) {
                                console.error('취소 오류:', error);
                                alert(error.message || '취소 중 오류가 발생했습니다.');
                              } finally {
                                setLoadingData(false);
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            권한 취소
                          </button>
                        </div>
                      )}
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '12px',
                      }}>
                        요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                        {request.approved_at && ` | 승인일: ${new Date(request.approved_at).toLocaleString('ko-KR')}`}
                        {request.rejected_at && ` | 거절일: ${new Date(request.rejected_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {accessRequests.length === 0 && (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      <KeyRound style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>접근 요청이 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
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

