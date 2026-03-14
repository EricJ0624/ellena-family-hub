'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAdminTranslation, getAdminAuditHeaders } from '@/lib/translations/admin';
import { getCommonTranslation } from '@/lib/translations/common';
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
  Clock,
  FileText,
  Download,
  PiggyBank
} from 'lucide-react';
import { motion } from 'framer-motion';
import GroupSettings from '@/app/components/GroupSettings';
import { getAnnouncementTexts } from '@/lib/announcement-i18n';
import type { LangCode } from '@/lib/language-fonts';

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

const ANNOUNCEMENT_LANGS: LangCode[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
const ANNOUNCEMENT_LANG_LABELS: Record<LangCode, string> = { ko: '한국어', en: 'English', ja: '日本語', 'zh-CN': '简体中文', 'zh-TW': '繁體中文' };

interface AnnouncementInfo {
  id: string;
  title: string;
  content: string;
  title_i18n?: Record<string, string> | null;
  content_i18n?: Record<string, string> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  target?: 'ADMIN_ONLY' | 'ALL_MEMBERS';
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

const ADMIN_LANG_STORAGE_KEY = 'admin_preferred_language';
type AdminLang = 'ko' | 'en';

function getStoredAdminLang(): AdminLang {
  if (typeof window === 'undefined') return 'ko';
  const s = localStorage.getItem(ADMIN_LANG_STORAGE_KEY);
  return s === 'en' ? 'en' : 'ko';
}

export default function AdminPage() {
  const router = useRouter();
  const [adminLang, setAdminLangState] = useState<AdminLang>('ko');
  useLanguage(); // ensure provider is present; we use adminLang for this page
  useEffect(() => {
    setAdminLangState(getStoredAdminLang());
  }, []);
  const at = (key: keyof import('@/lib/translations/admin').AdminTranslations) => getAdminTranslation(adminLang, key);
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(adminLang, key);

  const setAdminLang = useCallback((lang: AdminLang) => {
    setAdminLangState(lang);
    if (typeof window !== 'undefined') localStorage.setItem(ADMIN_LANG_STORAGE_KEY, lang);
  }, []);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'groups' | 'group-admin' | 'announcements' | 'all-support-tickets' | 'support-tickets' | 'dashboard-access-requests' | 'audit-log'>('dashboard');
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
  const [groupAdminTab, setGroupAdminTab] = useState<'dashboard' | 'members' | 'settings' | 'content' | 'announcements' | 'support-tickets' | 'dashboard-access-requests' | 'piggy-archives'>('dashboard');
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [groupMembers, setGroupMembers] = useState<MemberInfo[]>([]);
  const [groupPhotos, setGroupPhotos] = useState<PhotoInfo[]>([]);
  const [groupLocations, setGroupLocations] = useState<LocationInfo[]>([]);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  
  // 그룹별 공지사항, 문의, 접근 요청 상태
  const [groupAnnouncements, setGroupAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [groupSupportTickets, setGroupSupportTickets] = useState<SupportTicketInfo[]>([]);
  const [groupAccessRequests, setGroupAccessRequests] = useState<DashboardAccessRequestInfo[]>([]);

  // 공지사항, 문의, 접근 요청 관련 상태
  const [announcements, setAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketInfo[]>([]);
  const [accessRequests, setAccessRequests] = useState<DashboardAccessRequestInfo[]>([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementInfo | null | undefined>(undefined);
  const [editingTicket, setEditingTicket] = useState<SupportTicketInfo | null>(null);
  const [announcementTitleI18n, setAnnouncementTitleI18n] = useState<Record<string, string>>(() => Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
  const [announcementContentI18n, setAnnouncementContentI18n] = useState<Record<string, string>>(() => Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
  const [announcementTarget, setAnnouncementTarget] = useState<'ADMIN_ONLY' | 'ALL_MEMBERS'>('ADMIN_ONLY');
  const [announcementLangTab, setAnnouncementLangTab] = useState<LangCode>('ko');
  const [ticketAnswer, setTicketAnswer] = useState('');
  const [accessRequestExpiresHours, setAccessRequestExpiresHours] = useState(24);
  const [showNewAccessRequestModal, setShowNewAccessRequestModal] = useState(false);
  const [newAccessRequestGroupId, setNewAccessRequestGroupId] = useState('');
  const [newAccessRequestReason, setNewAccessRequestReason] = useState('');
  
  // 시스템 관리자 관리 관련 상태
  const [systemAdmins, setSystemAdmins] = useState<string[]>([]); // 시스템 관리자 user_id 목록
  const [systemAdminCount, setSystemAdminCount] = useState(0);

  // 감사 로그 조회 상태
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    admin_id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    group_id: string | null;
    target_user_id: string | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
  }>>([]);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditLogPage, setAuditLogPage] = useState(1);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogFilters, setAuditLogFilters] = useState({
    from: '',
    to: '',
    resource_type: '',
    admin_id: '',
    group_id: '',
  });
  const auditLogLimit = 50;

  // 저금통 보관 내역 (삭제된 저금통 거래 아카이브)
  const [piggyArchivesSnapshots, setPiggyArchivesSnapshots] = useState<Array<{
    id: string;
    group_id: string;
    group_name: string;
    user_id: string;
    user_nickname: string;
    deleted_at: string;
    deleted_by: string | null;
    deleted_by_nickname: string | null;
    account_name: string | null;
  }>>([]);
  const [piggyArchivesLoading, setPiggyArchivesLoading] = useState(false);
  const [piggyArchivesDetailId, setPiggyArchivesDetailId] = useState<string | null>(null);
  const [piggyArchivesDetail, setPiggyArchivesDetail] = useState<{
    walletTransactions: Array<{ id: string; amount: number; type: string; typeLabel: string; memo: string | null; created_at: string; dateLabel: string; actor_nickname: string }>;
    bankTransactions: Array<{ id: string; amount: number; type: string; typeLabel: string; memo: string | null; created_at: string; dateLabel: string; actor_nickname: string }>;
  } | null>(null);
  const [piggyArchivesDetailLoading, setPiggyArchivesDetailLoading] = useState(false);

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
      setError(err.message || at('error_stats'));
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 시스템 관리자 목록 로드
  const loadSystemAdmins = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/admin/system-admins', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setSystemAdmins(result.data?.map((a: any) => a.user_id) || []);
        setSystemAdminCount(result.count || 0);
      }
    } catch (error) {
      console.error('시스템 관리자 목록 로드 오류:', error);
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
        setError(at('error_session_expired'));
        setLoadingData(false);
        return;
      }

      // 시스템 관리자 목록 먼저 로드
      await loadSystemAdmins();

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
        throw new Error(result.error || at('error_users'));
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
      setError(err.message || at('error_users'));
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
        setError(at('error_auth'));
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
        throw new Error(result.error || at('error_groups'));
          }

      setGroups(result.data || []);
    } catch (err: any) {
      console.error('그룹 목록 로드 오류:', err);
      setError(err.message || at('error_groups'));
      setGroups([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 시스템 관리자가 소유자이거나 멤버인 그룹 조회 (관리 가능한 그룹)
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

      // 2. 멤버로 포함된 그룹 조회 (역할 무관)
      const { data: memberships, error: memberError } = await supabase
        .from('memberships')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) {
        console.error('멤버십 조회 오류:', memberError);
      }

      const memberGroupIds = memberships?.map(m => m.group_id) || [];
      
      let memberGroups: any[] = [];
      if (memberGroupIds.length > 0) {
        const { data, error: memberGroupsError } = await supabase
          .from('groups')
          .select('id, name, owner_id, created_at')
          .in('id', memberGroupIds)
          .order('created_at', { ascending: false });

        if (memberGroupsError) {
          console.error('멤버 그룹 조회 오류:', memberGroupsError);
        } else {
          memberGroups = data || [];
        }
      }

      // 3. 중복 제거 및 병합
      const allManageableGroupsMap = new Map();
      (ownedGroups || []).forEach(g => allManageableGroupsMap.set(g.id, g));
      (memberGroups || []).forEach(g => allManageableGroupsMap.set(g.id, g));
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
              member_count: memberCount,
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
        setError(at('error_auth'));
        setSelectedGroup(null);
        setSelectedGroupId(null);
        return;
      }

      // 그룹 정보 조회
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name, owner_id, created_at, invite_code')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      // 권한 확인: 소유자이거나 ADMIN/멤버인지 확인
      const isOwner = groupData.owner_id === user.id;
      let isAdmin = false;
      let isMember = false;
      
      if (!isOwner) {
        const { data: membership } = await supabase
          .from('memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('group_id', groupId)
          .single();
        
        isAdmin = membership?.role === 'ADMIN';
        isMember = !!membership;
      }

      // 권한이 없으면 에러
      if (!isOwner && !isAdmin && !isMember) {
        setError(at('error_no_permission'));
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

      // 감사: 시스템 관리자 그룹 접근 로그 (API에서 권한 검사 후 기록)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch('/api/admin/audit/dashboard-access', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ group_id: groupId }),
          }).catch(() => {});
        }
      });
    } catch (err: any) {
      console.error('그룹 정보 로드 오류:', err);
      setError(err.message || at('error_group_detail'));
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
      setError(err.message || at('error_stats'));
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
        .select('id, email, nickname')
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
      setError(err.message || at('error_members'));
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
        .select('id, image_url, s3_original_url, original_filename, created_at, uploader_id, caption')
        .in('uploader_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (photosError) throw photosError;

      setGroupPhotos(photosData || []);
    } catch (err: any) {
      console.error('사진 목록 로드 오류:', err);
      setError(err.message || at('error_photos'));
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
        .select('user_id, latitude, longitude, address, last_updated')
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
        const loc = location as { user_id: string; latitude: number; longitude: number; address: string | null; last_updated: string };
        return {
          ...loc,
          updated_at: loc.last_updated,
          email: profile?.email || null,
          nickname: profile?.nickname || null,
        };
      });

      setGroupLocations(locationsWithProfiles);
    } catch (err: any) {
      console.error('위치 데이터 로드 오류:', err);
      setError(err.message || at('error_locations'));
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

  // 그룹별 공지사항 로드 (시스템 관리자는 전체 공지사항 조회)
  const loadGroupAnnouncements = useCallback(async (groupId: string) => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        setLoadingData(false);
        return;
      }

      // 시스템 관리자는 /api/admin/announcements 사용 (전체 공지사항)
      const response = await fetch('/api/admin/announcements', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || at('error_announcements'));
      }

      setGroupAnnouncements(result.data || []);
    } catch (err: any) {
      console.error('공지사항 로드 오류:', err);
      setError(err.message || at('error_announcements'));
      setGroupAnnouncements([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 그룹별 문의 로드 (해당 그룹의 모든 문의 조회)
  const loadGroupSupportTickets = useCallback(async (groupId: string) => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        setLoadingData(false);
        return;
      }

      // 그룹별 문의 조회 (그룹 관리자 API 사용)
      const response = await fetch(`/api/group-admin/support-tickets?group_id=${groupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || at('error_support'));
      }

      setGroupSupportTickets(result.data || []);
    } catch (err: any) {
      console.error('문의 로드 오류:', err);
      setError(err.message || at('error_support'));
      setGroupSupportTickets([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 그룹별 접근 요청 로드
  const loadGroupAccessRequests = useCallback(async (groupId: string) => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        setLoadingData(false);
        return;
      }

      // 그룹 관리자 API 사용 (해당 그룹의 모든 접근 요청)
      const response = await fetch(`/api/group-admin/dashboard-access-requests?group_id=${groupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || at('error_access_requests'));
      }

      setGroupAccessRequests(result.data || []);
    } catch (err: any) {
      console.error('접근 요청 로드 오류:', err);
      setError(err.message || at('error_access_requests'));
      setGroupAccessRequests([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (!isAuthorized) return;

    if (activeTab === 'dashboard') {
      loadStats();
      loadAllSupportTickets(); // 대시보드에서 최근 문의 표시용
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
      } else if (groupAdminTab === 'announcements') {
        loadGroupAnnouncements(selectedGroupId);
      } else if (groupAdminTab === 'support-tickets') {
        loadGroupSupportTickets(selectedGroupId);
      } else if (groupAdminTab === 'dashboard-access-requests') {
        loadGroupAccessRequests(selectedGroupId);
      } else if (groupAdminTab === 'piggy-archives') {
        loadPiggyArchivesSnapshots(selectedGroupId);
      }
    } else if (activeTab === 'announcements') {
      loadAnnouncements();
    } else if (activeTab === 'all-support-tickets') {
      loadAllSupportTickets();
    } else if (activeTab === 'support-tickets') {
      loadSupportTickets();
    } else if (activeTab === 'dashboard-access-requests') {
      loadAccessRequests();
    } else if (activeTab === 'audit-log') {
      loadAuditLogs(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthorized, groupAdminTab, selectedGroupId]);

  // 전체 문의 로드 (모든 그룹)
  const loadAllSupportTickets = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        setLoadingData(false);
        return;
      }

      // 시스템 관리자는 모든 그룹의 문의 조회
      const response = await fetch('/api/admin/support-tickets', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || at('error_support'));
      }

      setSupportTickets(result.data || []);
    } catch (err: any) {
      console.error('문의 로드 오류:', err);
      setError(err.message || at('error_support'));
      setSupportTickets([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 공지사항 로드
  const loadAnnouncements = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
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
        throw new Error(result.error || at('error_announcements'));
      }

      setAnnouncements(result.data || []);
    } catch (err: any) {
      console.error('공지사항 로드 오류:', err);
      setError(err.message || at('error_announcements'));
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
        setError(at('error_session_expired'));
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
        throw new Error(result.error || at('error_support'));
      }

      setSupportTickets(result.data || []);
    } catch (err: any) {
      console.error('문의 로드 오류:', err);
      setError(err.message || at('error_support'));
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
        setError(at('error_session_expired'));
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
        throw new Error(result.error || at('error_access_requests'));
      }

      setAccessRequests(result.data || []);
    } catch (err: any) {
      console.error('접근 요청 로드 오류:', err);
      setError(err.message || at('error_access_requests'));
      setAccessRequests([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async (pageNum: number = 1) => {
    try {
      setAuditLogLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        setAuditLogLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', String(auditLogLimit));
      if (auditLogFilters.from) params.set('from', auditLogFilters.from);
      if (auditLogFilters.to) params.set('to', auditLogFilters.to);
      if (auditLogFilters.resource_type) params.set('resource_type', auditLogFilters.resource_type);
      if (auditLogFilters.admin_id) params.set('admin_id', auditLogFilters.admin_id);
      if (auditLogFilters.group_id) params.set('group_id', auditLogFilters.group_id);

      const response = await fetch(`/api/admin/audit/logs?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || at('error_audit_log'));
      }

      setAuditLogs(result.data || []);
      setAuditLogTotal(result.total ?? 0);
      setAuditLogPage(result.page ?? 1);
    } catch (err: any) {
      console.error('감사 로그 로드 오류:', err);
      setError(err.message || at('error_audit_log'));
      setAuditLogs([]);
      setAuditLogTotal(0);
    } finally {
      setAuditLogLoading(false);
    }
  }, [auditLogFilters]);

  const loadPiggyArchivesSnapshots = useCallback(async (groupId: string) => {
    try {
      setPiggyArchivesLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        setPiggyArchivesLoading(false);
        return;
      }
      const response = await fetch(`/api/group-admin/piggy-archives?group_id=${encodeURIComponent(groupId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '보관 내역 조회 실패');
      const list = result.data?.snapshots ?? [];
      setPiggyArchivesSnapshots(list.map((s: { id: string; group_id: string; user_id: string; user_nickname: string; deleted_at: string; deleted_by: string | null; deleted_by_nickname: string | null; account_name: string | null }) => ({
        id: s.id,
        group_id: s.group_id,
        group_name: selectedGroup?.name ?? '-',
        user_id: s.user_id,
        user_nickname: s.user_nickname,
        deleted_at: s.deleted_at,
        deleted_by: s.deleted_by,
        deleted_by_nickname: s.deleted_by_nickname,
        account_name: s.account_name,
      })));
    } catch (err: any) {
      console.error('저금통 보관 목록 로드 오류:', err);
      setError(err.message || '저금통 보관 내역 조회에 실패했습니다.');
      setPiggyArchivesSnapshots([]);
    } finally {
      setPiggyArchivesLoading(false);
    }
  }, [selectedGroup?.name]);

  const loadPiggyArchivesDetail = useCallback(async (groupId: string, snapshotId: string) => {
    try {
      setPiggyArchivesDetailLoading(true);
      setPiggyArchivesDetail(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch(`/api/group-admin/piggy-archives?group_id=${encodeURIComponent(groupId)}&snapshot_id=${encodeURIComponent(snapshotId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '상세 조회 실패');
      setPiggyArchivesDetail(result.data ?? null);
    } catch (err: any) {
      console.error('저금통 보관 상세 로드 오류:', err);
      setPiggyArchivesDetail(null);
    } finally {
      setPiggyArchivesDetailLoading(false);
    }
  }, []);

  const deletePiggyArchivesSnapshot = useCallback(async (groupId: string, snapshotId: string) => {
    if (!confirm('이 보관 내역을 삭제하시겠습니까? 삭제된 거래 기록은 복구할 수 없습니다.')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        return;
      }
      const response = await fetch(
        `/api/group-admin/piggy-archives?group_id=${encodeURIComponent(groupId)}&snapshot_id=${encodeURIComponent(snapshotId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '삭제 실패');
      if (piggyArchivesDetailId === snapshotId) {
        setPiggyArchivesDetailId(null);
        setPiggyArchivesDetail(null);
      }
      loadPiggyArchivesSnapshots(groupId);
    } catch (err: any) {
      console.error('저금통 보관 내역 삭제 오류:', err);
      setError(err.message || '보관 내역 삭제에 실패했습니다.');
    }
  }, [piggyArchivesDetailId]);

  const exportAuditLogsCsv = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '1000');
      if (auditLogFilters.from) params.set('from', auditLogFilters.from);
      if (auditLogFilters.to) params.set('to', auditLogFilters.to);
      if (auditLogFilters.resource_type) params.set('resource_type', auditLogFilters.resource_type);
      if (auditLogFilters.admin_id) params.set('admin_id', auditLogFilters.admin_id);
      if (auditLogFilters.group_id) params.set('group_id', auditLogFilters.group_id);

      const response = await fetch(`/api/admin/audit/logs?${params.toString()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok || !result.data) return;

      const rows = result.data as Array<{
        id: string;
        admin_id: string;
        action: string;
        resource_type: string;
        resource_id: string | null;
        group_id: string | null;
        target_user_id: string | null;
        details: unknown;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
      }>;
      const headers = getAdminAuditHeaders(adminLang);
      const csvRows = [
        headers.join(','),
        ...rows.map((r) => [
          r.created_at,
          r.admin_id,
          `"${(r.action || '').replace(/"/g, '""')}"`,
          r.resource_type,
          r.resource_id || '',
          r.group_id || '',
          r.target_user_id || '',
          `"${(JSON.stringify(r.details) || '').replace(/"/g, '""')}"`,
          r.ip_address || '',
          `"${(r.user_agent || '').replace(/"/g, '""')}"`,
        ].join(',')),
      ];
      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV 내보내기 오류:', e);
    }
  }, [auditLogFilters]);

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
    if (!confirm(at('confirm_delete_photo'))) {
      return;
    }

    try {
      setLoadingData(true);
      const { error } = await supabase
        .from('memory_vault')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      alert(at('photo_deleted'));
      if (selectedGroupId) {
        loadGroupPhotos(selectedGroupId);
        loadGroupStats(selectedGroupId);
      }
    } catch (err: any) {
      console.error('사진 삭제 오류:', err);
      alert(err.message || at('error_delete_photo'));
    } finally {
      setLoadingData(false);
    }
  };

  // 그룹 관리 탭으로 전환 (권한 검증 포함)
  const handleSelectGroupForAdmin = async (groupId: string) => {
    // 관리 가능한 그룹인지 확인
    const isManageable = manageableGroups.some(mg => mg.id === groupId);
    if (!isManageable) {
      alert(at('error_no_permission'));
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
          <p style={{ color: '#64748b', fontSize: '16px' }}>{at('checking_permission')}</p>
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
                {at('page_title')}
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: '4px 0 0 0',
              }}>
                {at('page_subtitle')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid #e2e8f0',
            }}>
              <button
                type="button"
                onClick={() => setAdminLang('ko')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: adminLang === 'ko' ? '#9333ea' : 'transparent',
                  color: adminLang === 'ko' ? 'white' : '#64748b',
                }}
              >
                한국어
              </button>
              <button
                type="button"
                onClick={() => setAdminLang('en')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: adminLang === 'en' ? '#9333ea' : 'transparent',
                  color: adminLang === 'en' ? 'white' : '#64748b',
                }}
              >
                English
              </button>
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
              {ct('close')}
            </button>
          </div>
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
            {at('tab_dashboard')}
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
            {at('tab_users')}
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
            {at('tab_groups')}
          </button>
          <button
            onClick={() => {
              // 관리 가능한 그룹이 있는지 확인
              if (manageableGroups.length === 0) {
                alert(at('no_manageable_groups'));
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
                  alert(at('select_group_first'));
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
            {at('tab_group_admin')} {manageableGroups.length > 0 && `(${manageableGroups.length})`}
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
            {at('tab_announcements')}
          </button>
          <button
            onClick={() => setActiveTab('all-support-tickets')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'all-support-tickets' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'all-support-tickets' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'all-support-tickets' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            <MessageSquare style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            {at('tab_support')}
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
            {at('tab_access_requests')}
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
          <button
            onClick={() => setActiveTab('audit-log')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'audit-log' ? '3px solid #9333ea' : '3px solid transparent',
              color: activeTab === 'audit-log' ? '#9333ea' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'audit-log' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FileText style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            {at('tab_audit_log')}
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
            <span style={{ marginLeft: '12px', color: '#64748b' }}>{at('loading')}</span>
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
                  {at('system_stats')}
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
                      {at('total_users')}
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
                      {at('active_users')}
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
                      {at('total_groups')}
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
                      {at('system_admins')}
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

                {/* 최근 문의 위젯 */}
                <div style={{
                  marginTop: '32px',
                  padding: '24px',
                  backgroundColor: '#fff7ed',
                  borderRadius: '12px',
                  border: '1px solid #fed7aa',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}>
                    <div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '4px',
                      }}>
                        최근 문의
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#64748b',
                      }}>
                        미답변 문의: <span style={{ 
                          fontWeight: '600', 
                          color: supportTickets.filter(t => t.status === 'pending').length > 0 ? '#ef4444' : '#10b981' 
                        }}>
                          {supportTickets.filter(t => t.status === 'pending').length}건
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('all-support-tickets')}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#9333ea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#7e22ce';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#9333ea';
                      }}
                    >
                      전체 보기
                    </button>
                  </div>
                  {supportTickets.length === 0 ? (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '14px',
                    }}>
                      문의가 없습니다.
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}>
                      {supportTickets.slice(0, 5).map((ticket) => (
                        <div
                          key={ticket.id}
                          style={{
                            padding: '16px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onClick={() => setActiveTab('all-support-tickets')}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                          }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1e293b',
                            }}>
                              {ticket.title}
                            </div>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: ticket.status === 'pending' ? '#fee2e2' : ticket.status === 'answered' ? '#dbeafe' : '#f3f4f6',
                              color: ticket.status === 'pending' ? '#991b1b' : ticket.status === 'answered' ? '#1e40af' : '#4b5563',
                            }}>
                              {ticket.status === 'pending' ? at('status_pending') : ticket.status === 'answered' ? at('status_answered') : at('status_closed')}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            color: '#64748b',
                          }}>
                            <span style={{
                              padding: '2px 6px',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}>
                              {ticket.groups?.name || ct('unknown')}
                            </span>
                            <span>•</span>
                            <span>{new Date(ticket.created_at).toLocaleDateString('ko-KR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                      placeholder={at('search_user_placeholder')}
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
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                        }}>
                          권한
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
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {systemAdmins.includes(user.id) ? (
                              <span style={{
                                padding: '4px 12px',
                                backgroundColor: '#7e22ce',
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                              }}>
                                시스템 관리자
                              </span>
                            ) : (
                              <span style={{
                                padding: '4px 12px',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                              }}>
                                일반 사용자
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {/* 시스템 관리자 승격/해제 버튼 */}
                              {systemAdmins.includes(user.id) ? (
                                <button
                                  style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#f59e0b',
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
                                    e.currentTarget.style.backgroundColor = '#d97706';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f59e0b';
                                  }}
                                  onClick={async () => {
                                    const { data: { user: currentUser } } = await supabase.auth.getUser();
                                    
                                    if (currentUser?.id === user.id) {
                                      alert(at('no_self_revoke'));
                                      return;
                                    }

                                    if (systemAdminCount <= 1) {
                                      alert(at('no_last_admin_revoke'));
                                      return;
                                    }

                                    const userDisplayName = user.nickname || user.email || at('user_fallback');
                                    if (!confirm(at('confirm_revoke').replace(/\$\{name\}/g, userDisplayName))) {
                                      return;
                                    }

                                    try {
                                      setLoadingData(true);
                                      const { data: { session } } = await supabase.auth.getSession();
                                      if (!session?.access_token) {
                                        alert(at('error_auth'));
                                        return;
                                      }

                                      const response = await fetch(`/api/admin/system-admins?user_id=${user.id}`, {
                                        method: 'DELETE',
                                        headers: {
                                          'Authorization': `Bearer ${session.access_token}`,
                                          'Content-Type': 'application/json',
                                        },
                                      });

                                      const result = await response.json();

                                      if (!response.ok) {
                                        throw new Error(result.error || at('error_revoke'));
                                      }

                                      alert(at('revoked').replace(/\$\{name\}/g, userDisplayName));
                                      loadUsers();
                                    } catch (error: any) {
                                      console.error('권한 해제 오류:', error);
                                      alert(error.message || at('error_revoke'));
                                    } finally {
                                      setLoadingData(false);
                                    }
                                  }}
                                >
                                  <Shield style={{ width: '16px', height: '16px' }} />
                                  권한 해제
                                </button>
                              ) : (
                                <button
                                  style={{
                                    padding: '8px 16px',
                                    backgroundColor: systemAdminCount >= 1 ? '#94a3b8' : '#7e22ce',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: systemAdminCount >= 1 ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    opacity: systemAdminCount >= 1 ? 0.6 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (systemAdminCount < 1) {
                                      e.currentTarget.style.backgroundColor = '#6b21a8';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (systemAdminCount < 1) {
                                      e.currentTarget.style.backgroundColor = '#7e22ce';
                                    }
                                  }}
                                  disabled={systemAdminCount >= 1}
                                  onClick={async () => {
                                    if (systemAdminCount >= 1) {
                                      alert(at('only_one_sys_admin'));
                                      return;
                                    }

                                    const userDisplayName = user.nickname || user.email || at('user_fallback');
                                    if (!confirm(at('confirm_promote').replace(/\$\{name\}/g, userDisplayName))) {
                                      return;
                                    }

                                    try {
                                      setLoadingData(true);
                                      const { data: { session } } = await supabase.auth.getSession();
                                      if (!session?.access_token) {
                                        alert(at('error_auth'));
                                        return;
                                      }

                                      const response = await fetch('/api/admin/system-admins', {
                                        method: 'POST',
                                        headers: {
                                          'Authorization': `Bearer ${session.access_token}`,
                                          'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({ user_id: user.id }),
                                      });

                                      const result = await response.json();

                                      if (!response.ok) {
                                        throw new Error(result.error || at('error_promote'));
                                      }

                                      alert(result.message || at('promoted').replace(/\$\{name\}/g, userDisplayName));
                                      loadUsers();
                                    } catch (error: any) {
                                      console.error('관리자 승격 오류:', error);
                                      alert(error.message || at('error_promote'));
                                    } finally {
                                      setLoadingData(false);
                                    }
                                  }}
                                >
                                  <Shield style={{ width: '16px', height: '16px' }} />
                                  관리자 승격
                                </button>
                              )}
                              
                              {/* {at('force_leave_btn')} 버튼 */}
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
                                  alert(at('no_self_delete'));
                                  return;
                                }

                                const userDisplayName = user.email || user.nickname || at('user_fallback');
                                const confirmMessage = at('confirm_force_leave_warning').replace(/\$\{name\}/g, userDisplayName);
                                
                                if (!confirm(confirmMessage)) {
                                  return;
                                }

                                try {
                                  setLoadingData(true);
                                  const { data: { session } } = await supabase.auth.getSession();
                                  if (!session?.access_token) {
                                    alert(at('error_auth'));
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

                                  const result = await response.json().catch(() => ({}));

                                  if (!response.ok) {
                                    throw new Error((result as { error?: string })?.error || at('error_force_leave'));
                                  }

                                  alert(at('force_leave_done').replace(/\$\{name\}/g, userDisplayName));
                                  loadUsers(); // 목록 새로고침
                                } catch (error: any) {
                                  console.error(`${at('force_leave_btn')} 오류:`, error);
                                  alert(error?.message || at('error_force_leave_msg'));
                                } finally {
                                  setLoadingData(false);
                                }
                              }}
                            >
                              <UserX style={{ width: '14px', height: '14px' }} />
                              {at('force_leave_btn')}
                            </button>
                            </div>
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
                      <p>{at('no_users')}</p>
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
                    {at('tab_groups')} ({filteredGroups.length})
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
                      placeholder={at('search_group_placeholder')}
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
                        {at('owner')}: {group.owner_email || '-'}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#64748b',
                          marginBottom: '8px',
                      }}>
                        {at('members_count')}: {group.member_count}
                      </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#64748b',
                          marginBottom: '12px',
                        }}>
                          {at('storage')}: {formatBytes(usedBytes)} / {formatBytes(quotaBytes)} ({percent.toFixed(0)}%)
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
                        {at('created_at')}: {new Date(group.created_at).toLocaleDateString(adminLang === 'ko' ? 'ko-KR' : 'en-US')}
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
                              const input = prompt(at('prompt_quota_gb'), currentGb);
                              if (!input) return;
                              const nextGb = Number(input);
                              if (!Number.isFinite(nextGb) || nextGb <= 0) {
                                alert(at('alert_invalid_gb'));
                                return;
                              }

                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert(at('error_auth'));
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
                                  throw new Error(result.error || at('error_quota_change'));
                                }

                                await loadGroups();
                              } catch (error: any) {
                                alert(error.message || at('error_quota_change'));
                              }
                            }}
                          >
                            {at('set_quota')}
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
{at('manage_btn')}
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
                            const msg = at('confirm_delete_group').replace(/\$\{groupName\}/g, group.name);
                            if (!confirm(msg)) {
                              return;
                            }

                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(at('error_auth'));
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
                                throw new Error(result.error || at('error_delete_group'));
                              }

                              alert(at('group_deleted'));
                              loadGroups(); // 목록 새로고침
                              loadManageableGroups(); // 관리 가능한 그룹 목록도 새로고침
                            } catch (error: any) {
                              console.error('그룹 삭제 오류:', error);
                              alert(error.message || at('error_delete_group'));
                            }
                          }}
                        >
                          {at('delete_group_btn')}
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
                      rowGap: '8px',
                      flexWrap: 'wrap',
                      overflowX: 'auto',
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
                      <button
                        onClick={() => setGroupAdminTab('announcements')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'announcements' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'announcements' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'announcements' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Megaphone style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        {at('announcements_label')}
                      </button>
                      <button
                        onClick={() => setGroupAdminTab('support-tickets')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'support-tickets' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'support-tickets' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'support-tickets' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <MessageSquare style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        문의하기
                      </button>
                      <button
                        onClick={() => setGroupAdminTab('dashboard-access-requests')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'dashboard-access-requests' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'dashboard-access-requests' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'dashboard-access-requests' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <KeyRound style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        접근 요청
                      </button>
                      <button
                        onClick={() => setGroupAdminTab('piggy-archives')}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: groupAdminTab === 'piggy-archives' ? '3px solid #9333ea' : '3px solid transparent',
                          color: groupAdminTab === 'piggy-archives' ? '#9333ea' : '#64748b',
                          fontSize: '14px',
                          fontWeight: groupAdminTab === 'piggy-archives' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <PiggyBank style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        저금통 보관 내역
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
                                      {selectedGroup.owner_id === member.user_id ? at('role_owner') : (member.role === 'ADMIN' ? at('role_admin') : at('role_member'))}
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
                                            const memberDisplay = member.email || member.nickname || at('user_fallback');
                                            const kickMsg = at('confirm_kick_from_group')
                                              .replace(/\$\{memberDisplay\}/g, memberDisplay)
                                              .replace(/\$\{groupName\}/g, selectedGroup.name);
                                            if (!confirm(kickMsg)) {
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

                                              alert(at('kick_done'));
                                              if (selectedGroupId) {
                                                loadGroupMembers(selectedGroupId);
                                                loadGroupStats(selectedGroupId);
                                              }
                                            } catch (err: any) {
                                              console.error('멤버 추방 오류:', err);
                                              alert(err.message || at('error_kick_msg'));
                                            } finally {
                                              setLoadingData(false);
                                            }
                                          }}
                                        >
                                          <UserX style={{ width: '14px', height: '14px' }} />
                                          {at('kick_btn')}
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
                                            alert(at('no_self_delete'));
                                            return;
                                          }

                                          const userDisplayName = member.email || member.nickname || at('user_fallback');
                                          const confirmMessage = at('confirm_force_leave_warning').replace(/\$\{name\}/g, userDisplayName);
                                          
                                          if (!confirm(confirmMessage)) {
                                            return;
                                          }

                                          try {
                                            setLoadingData(true);
                                            const { data: { session } } = await supabase.auth.getSession();
                                            if (!session?.access_token) {
                                              alert(at('error_auth'));
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

                                            const result = await response.json().catch(() => ({}));

                                            if (!response.ok) {
                                              throw new Error((result as { error?: string })?.error || at('error_force_leave'));
                                            }

                                            alert(at('force_leave_done').replace(/\$\{name\}/g, userDisplayName));
                                            if (selectedGroupId) {
                                              loadGroupMembers(selectedGroupId);
                                              loadGroupStats(selectedGroupId);
                                            }
                                          } catch (error: any) {
                                            console.error(`${at('force_leave_btn')} 오류:`, error);
                                            alert(error?.message || at('error_force_leave_msg'));
                                          } finally {
                                            setLoadingData(false);
                                          }
                                        }}
                                      >
                                        <UserX style={{ width: '14px', height: '14px' }} />
                                        {at('force_leave_btn')}
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
                        <GroupSettings onClose={() => setGroupAdminTab('dashboard')} />
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
                                const url = photo.image_url || photo.s3_original_url;
                                if (url) window.open(url, '_blank');
                              }}
                            >
                              {photo.image_url || photo.s3_original_url ? (
                                <img
                                  src={photo.image_url || photo.s3_original_url || ''}
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

                    {/* 공지사항 서브 탭 */}
                    {groupAdminTab === 'announcements' && (
                      <div>
                        <h2 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '24px',
                        }}>
                          {at('announcements_section_count').replace(/\$\{count\}/g, String(groupAnnouncements.length))}
                        </h2>

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                        }}>
                          {groupAnnouncements.map((announcement) => (
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
                                    margin: 0,
                                  }}>
                                    {announcement.title}
                                  </h3>
                                  <p style={{
                                    fontSize: '14px',
                                    color: '#64748b',
                                    margin: '8px 0 0 0',
                                    whiteSpace: 'pre-wrap',
                                  }}>
                                    {announcement.content}
                                  </p>
                                </div>
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                marginTop: '12px',
                              }}>
                                {at('written_at')} {new Date(announcement.created_at).toLocaleString('ko-KR')}
                              </div>
                            </motion.div>
                          ))}
                          {groupAnnouncements.length === 0 && (
                            <div style={{
                              padding: '48px',
                              textAlign: 'center',
                              color: '#94a3b8',
                            }}>
                              <Megaphone style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                              <p>{at('no_announcements')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 문의하기 서브 탭 */}
                    {groupAdminTab === 'support-tickets' && (
                      <div>
                        <h2 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '24px',
                        }}>
                          문의 목록 ({groupSupportTickets.length}개)
                        </h2>

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                        }}>
                          {groupSupportTickets.map((ticket) => (
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
                                      {ticket.status === "pending" ? "대기중" : ticket.status === "answered" ? "답변완료" : "종료"}
                                    </span>
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
                              <div style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                marginTop: '12px',
                              }}>
                                {at('written_at')} {new Date(ticket.created_at).toLocaleString('ko-KR')}
                                {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
                              </div>
                            </motion.div>
                          ))}
                          {groupSupportTickets.length === 0 && (
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
                      </div>
                    )}

                    {/* 접근 요청 서브 탭 */}
                    {groupAdminTab === 'dashboard-access-requests' && (
                      <div>
                        <h2 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '24px',
                        }}>
                          대시보드 접근 요청 ({groupAccessRequests.length}개)
                        </h2>

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                        }}>
                          {groupAccessRequests.map((request) => (
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
                                    <span style={{
                                      padding: '4px 12px',
                                      backgroundColor: request.status === 'pending' ? '#fbbf24' : request.status === 'approved' ? '#10b981' : request.status === 'rejected' ? '#ef4444' : '#94a3b8',
                                      color: 'white',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                    }}>
                                      {request.status === 'pending'
                                        ? "대기중"
                                        : request.status === 'approved'
                                          ? at('status_approved')
                                          : request.status === 'rejected'
                                            ? at('status_rejected')
                                            : request.status === 'expired'
                                              ? at('status_expired')
                                              : at('status_revoked')}
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
                                      {at('expires_at_label')} {new Date(request.expires_at).toLocaleString('ko-KR')}
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
                                        {at('rejection_reason_label')}
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
                              <div style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                marginTop: '12px',
                              }}>
                                요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                                {request.approved_at && ` | ${at('approved_at_label')} ${new Date(request.approved_at).toLocaleString('ko-KR')}`}
                                {request.rejected_at && ` | ${at('rejected_at_label')} ${new Date(request.rejected_at).toLocaleString('ko-KR')}`}
                              </div>
                            </motion.div>
                          ))}
                          {groupAccessRequests.length === 0 && (
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

                    {/* 저금통 보관 내역 서브 탭 */}
                    {groupAdminTab === 'piggy-archives' && selectedGroupId && (
                      <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '24px' }}>
                          저금통 보관 내역 (삭제된 저금통 거래)
                        </h2>
                        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '24px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>삭제일시</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>아이(닉네임)</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>저금통 이름</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>삭제한 관리자</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>동작</th>
                              </tr>
                            </thead>
                            <tbody>
                              {piggyArchivesLoading && piggyArchivesSnapshots.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                    <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                                    로딩 중…
                                  </td>
                                </tr>
                              ) : piggyArchivesSnapshots.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                    삭제된 저금통 보관 내역이 없습니다.
                                  </td>
                                </tr>
                              ) : (
                                piggyArchivesSnapshots.map((s) => (
                                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{new Date(s.deleted_at).toLocaleString('ko-KR')}</td>
                                    <td style={{ padding: '10px 12px' }}>{s.user_nickname}</td>
                                    <td style={{ padding: '10px 12px' }}>{s.account_name || '-'}</td>
                                    <td style={{ padding: '10px 12px' }}>{s.deleted_by_nickname ?? '-'}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPiggyArchivesDetailId(s.id);
                                            loadPiggyArchivesDetail(selectedGroupId, s.id);
                                          }}
                                          style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            background: '#f8fafc',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          거래 내역 보기
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deletePiggyArchivesSnapshot(selectedGroupId, s.id)}
                                          style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            border: '1px solid #fecaca',
                                            background: '#fef2f2',
                                            color: '#b91c1c',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          삭제
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {piggyArchivesDetailId && (
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', backgroundColor: '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>보관된 거래 내역</h3>
                              <button
                                type="button"
                                onClick={() => { setPiggyArchivesDetailId(null); setPiggyArchivesDetail(null); }}
                                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', fontSize: '12px', cursor: 'pointer' }}
                              >
                                닫기
                              </button>
                            </div>
                            {piggyArchivesDetailLoading ? (
                              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                                로딩 중…
                              </div>
                            ) : piggyArchivesDetail && (piggyArchivesDetail.walletTransactions.length > 0 || piggyArchivesDetail.bankTransactions.length > 0) ? (
                              <>
                                <h4 style={{ margin: '12px 0 8px', fontSize: '14px', color: '#475569' }}>용돈 내역</h4>
                                {piggyArchivesDetail.walletTransactions.length === 0 ? (
                                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>없음</p>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>일시</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>유형</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>금액</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>메모</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>행위자</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {piggyArchivesDetail.walletTransactions.map((tx) => (
                                        <tr key={tx.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                          <td style={{ padding: '8px' }}>{tx.dateLabel}</td>
                                          <td style={{ padding: '8px' }}>{tx.typeLabel}</td>
                                          <td style={{ padding: '8px', textAlign: 'right' }}>{tx.amount.toLocaleString()}원</td>
                                          <td style={{ padding: '8px' }}>{tx.memo || '-'}</td>
                                          <td style={{ padding: '8px' }}>{tx.actor_nickname}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                <h4 style={{ margin: '12px 0 8px', fontSize: '14px', color: '#475569' }}>저금통 내역</h4>
                                {piggyArchivesDetail.bankTransactions.length === 0 ? (
                                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>없음</p>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>일시</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>유형</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>금액</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>메모</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>행위자</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {piggyArchivesDetail.bankTransactions.map((tx) => (
                                        <tr key={tx.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                          <td style={{ padding: '8px' }}>{tx.dateLabel}</td>
                                          <td style={{ padding: '8px' }}>{tx.typeLabel}</td>
                                          <td style={{ padding: '8px', textAlign: 'right' }}>{tx.amount.toLocaleString()}원</td>
                                          <td style={{ padding: '8px' }}>{tx.memo || '-'}</td>
                                          <td style={{ padding: '8px' }}>{tx.actor_nickname}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </>
                            ) : (
                              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>거래 내역이 없습니다.</p>
                            )}
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
                    <p>{at('select_group_prompt')}</p>
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
                    {at('announcement_manage_title')}
                  </h2>
                  <button
                    onClick={() => {
                      setEditingAnnouncement(null);
                      setAnnouncementTitleI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                      setAnnouncementContentI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                      setAnnouncementTarget('ADMIN_ONLY');
                      setAnnouncementLangTab('ko');
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
                    {at('new_announcement_btn')}
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
                        backgroundColor: announcement.is_active ? '#f8fafc' : '#fef2f2',
                        borderRadius: '12px',
                        border: announcement.is_active ? '1px solid #e2e8f0' : '1px solid #fecaca',
                        opacity: announcement.is_active ? 1 : 0.7,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <h3 style={{
                              fontSize: '18px',
                              fontWeight: '600',
                              color: '#1e293b',
                              margin: 0,
                            }}>
                              {getAnnouncementTexts(announcement, adminLang).title || announcement.title}
                            </h3>
                            {!announcement.is_active && (
                              <span style={{
                                padding: '4px 8px',
                                backgroundColor: '#fecaca',
                                color: '#991b1b',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                              }}>
                                {at('disabled_label')}
                              </span>
                            )}
                            <span style={{
                              padding: '4px 8px',
                              backgroundColor: (announcement as any).target === 'ALL_MEMBERS' ? '#dbeafe' : '#f3f4f6',
                              color: (announcement as any).target === 'ALL_MEMBERS' ? '#1e40af' : '#6b7280',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                            }}>
                              {(announcement as any).target === 'ALL_MEMBERS' ? at('target_all_members') : at('target_admin_only')}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '14px',
                            color: '#64748b',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                          }}>
                            {getAnnouncementTexts(announcement, adminLang).content || announcement.content}
                          </p>
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginLeft: '16px',
                        }}>
                          <button
                            onClick={() => {
                              setEditingAnnouncement(announcement);
                              const ti = announcement.title_i18n && typeof announcement.title_i18n === 'object' ? announcement.title_i18n : { ko: announcement.title };
                              const ci = announcement.content_i18n && typeof announcement.content_i18n === 'object' ? announcement.content_i18n : { ko: announcement.content };
                              setAnnouncementTitleI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, (ti[l] ?? '')])));
                              setAnnouncementContentI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, (ci[l] ?? '')])));
                              setAnnouncementTarget(announcement.target || 'ADMIN_ONLY');
                              setAnnouncementLangTab('ko');
                            }}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#e0e7ff',
                              color: '#3730a3',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            {at('edit_btn')}
                          </button>
                          {announcement.is_active ? (
                            // 활성화된 공지: 비활성화 버튼
                            <button
                              onClick={async () => {
                                if (!confirm(at('deactivate_confirm'))) {
                                  return;
                                }

                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert(at('error_auth'));
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
                                    throw new Error(result.error || at('deactivate_failed'));
                                  }

                                  alert(result.message || at('deactivate_success'));
                                  loadAnnouncements();
                                } catch (error: any) {
                                  console.error(at('deactivate_failed'), error);
                                  alert(error.message || at('deactivate_failed'));
                                } finally {
                                  setLoadingData(false);
                                }
                              }}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              {at('deactivate_btn')}
                            </button>
                          ) : (
                            // 비활성화된 공지: 영구 삭제 버튼
                            <button
                              onClick={async () => {
                                if (!confirm('⚠️ ' + at('confirm_permanent_delete'))) {
                                  return;
                                }

                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert(at('error_auth'));
                                  return;
                                }

                                try {
                                  setLoadingData(true);
                                  const response = await fetch(`/api/admin/announcements?id=${announcement.id}&permanent=true`, {
                                    method: 'DELETE',
                                    headers: {
                                      'Authorization': `Bearer ${session.access_token}`,
                                      'Content-Type': 'application/json',
                                    },
                                  });

                                  const result = await response.json();

                                  if (!response.ok) {
                                    throw new Error(result.error || at('deactivate_failed'));
                                  }

                                  alert(result.message || at('deactivate_success'));
                                  loadAnnouncements();
                                } catch (error: any) {
                                  console.error(at('deactivate_failed'), error);
                                  alert(error.message || at('deactivate_failed'));
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
                              {at('permanent_delete_btn')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '12px',
                      }}>
                        {at('written_at')} {new Date(announcement.created_at).toLocaleString('ko-KR')}
                        {announcement.updated_at !== announcement.created_at && ` | ${at('updated_at_label')} ${new Date(announcement.updated_at).toLocaleString('ko-KR')}`}
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
                      <p>{at('no_announcements')}</p>
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
                    setEditingAnnouncement(undefined);
                    setAnnouncementTitleI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                    setAnnouncementContentI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                    setAnnouncementTarget('ADMIN_ONLY');
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
                        {editingAnnouncement ? at('edit_announcement_modal_title') : at('new_announcement_modal_title')}
                      </h3>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                        {ANNOUNCEMENT_LANGS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setAnnouncementLangTab(l)}
                            style={{
                              padding: '8px 14px',
                              border: 'none',
                              borderBottom: announcementLangTab === l ? '2px solid #9333ea' : '2px solid transparent',
                              background: 'none',
                              fontSize: '13px',
                              fontWeight: announcementLangTab === l ? '600' : '400',
                              color: announcementLangTab === l ? '#9333ea' : '#64748b',
                              cursor: 'pointer',
                            }}
                          >
                            {ANNOUNCEMENT_LANG_LABELS[l]}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={announcementTitleI18n[announcementLangTab] ?? ''}
                        onChange={(e) => setAnnouncementTitleI18n((prev) => ({ ...prev, [announcementLangTab]: e.target.value }))}
                        placeholder={at('placeholder_title')}
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
                        value={announcementContentI18n[announcementLangTab] ?? ''}
                        onChange={(e) => setAnnouncementContentI18n((prev) => ({ ...prev, [announcementLangTab]: e.target.value }))}
                        placeholder={at('placeholder_content')}
                        style={{
                          width: '100%',
                          minHeight: '280px',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          marginBottom: '16px',
                        }}
                      />
                      <div style={{
                        marginBottom: '20px',
                        padding: '16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#334155',
                          marginBottom: '12px',
                        }}>
                          공지 대상 선택
                        </label>
                        <div style={{
                          display: 'flex',
                          gap: '16px',
                        }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            backgroundColor: announcementTarget === 'ADMIN_ONLY' ? '#e0e7ff' : 'transparent',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s',
                          }}>
                            <input
                              type="radio"
                              name="announcementTarget"
                              value="ADMIN_ONLY"
                              checked={announcementTarget === 'ADMIN_ONLY'}
                              onChange={(e) => setAnnouncementTarget(e.target.value as 'ADMIN_ONLY' | 'ALL_MEMBERS')}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{
                              fontSize: '14px',
                              color: '#334155',
                              fontWeight: announcementTarget === 'ADMIN_ONLY' ? '600' : '400',
                            }}>
                              관리자만
                            </span>
                          </label>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            backgroundColor: announcementTarget === 'ALL_MEMBERS' ? '#e0e7ff' : 'transparent',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s',
                          }}>
                            <input
                              type="radio"
                              name="announcementTarget"
                              value="ALL_MEMBERS"
                              checked={announcementTarget === 'ALL_MEMBERS'}
                              onChange={(e) => setAnnouncementTarget(e.target.value as 'ADMIN_ONLY' | 'ALL_MEMBERS')}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{
                              fontSize: '14px',
                              color: '#334155',
                              fontWeight: announcementTarget === 'ALL_MEMBERS' ? '600' : '400',
                            }}>
                              모든 멤버
                            </span>
                          </label>
                        </div>
                        <p style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '8px',
                          marginBottom: '0',
                        }}>
                          {announcementTarget === 'ADMIN_ONLY' 
                            ? '그룹 관리자와 시스템 관리자만 볼 수 있습니다.' 
                            : '모든 그룹 멤버가 볼 수 있습니다.'}
                        </p>
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                      }}>
                        <button
                          onClick={() => {
                            setEditingAnnouncement(undefined);
                            setAnnouncementTitleI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                            setAnnouncementContentI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                            setAnnouncementTarget('ADMIN_ONLY');
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
                          {ct('cancel')}
                        </button>
                        <button
                          onClick={async () => {
                            const titleObj: Record<string, string> = {};
                            const contentObj: Record<string, string> = {};
                            for (const l of ANNOUNCEMENT_LANGS) {
                              const t = (announcementTitleI18n[l] ?? '').trim();
                              const c = (announcementContentI18n[l] ?? '').trim();
                              if (t || c) {
                                titleObj[l] = t || '';
                                contentObj[l] = c || '';
                              }
                            }
                            const keys = Object.keys(titleObj);
                            if (keys.length === 0) {
                              alert(adminLang === 'ko' ? '최소 한 개 언어로 제목과 내용을 입력해주세요.' : 'Please enter title and content in at least one language.');
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(at('error_auth'));
                                return;
                              }

                              if (editingAnnouncement) {
                                const response = await fetch('/api/admin/announcements', {
                                  method: 'PUT',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: editingAnnouncement.id,
                                    title_i18n: titleObj,
                                    content_i18n: contentObj,
                                    is_active: true,
                                    target: announcementTarget,
                                  }),
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || at('error_announcement_update_failed'));
                                }

                                alert(at('success_announcement_updated'));
                              } else {
                                const response = await fetch('/api/admin/announcements', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    title_i18n: titleObj,
                                    content_i18n: contentObj,
                                    is_active: true,
                                    target: announcementTarget,
                                  }),
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || at('error_announcement_create_failed'));
                                }

                                alert(at('success_announcement_created'));
                              }

                              setEditingAnnouncement(undefined);
                              setAnnouncementTitleI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                              setAnnouncementContentI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                              setAnnouncementTarget('ADMIN_ONLY');
                              loadAnnouncements();
                            } catch (error: any) {
                              console.error(at('error_announcement_update_failed'), error);
                              alert(error.message || at('error_announcement_update_failed'));
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
                          {editingAnnouncement ? at('edit_btn') : at('write_btn')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 문의 관리 탭 */}
            {/* 전체 문의 탭 */}
            {activeTab === 'all-support-tickets' && (
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
                    전체 문의 ({supportTickets.filter(t => t.status === 'pending').length}개 미답변)
                  </h2>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                  }}>
                    <select
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                      onChange={(e) => {
                        const status = e.target.value;
                        if (status === 'all') {
                          loadAllSupportTickets();
                        }
                      }}
                    >
                      <option value="all">전체</option>
                      <option value="pending">미답변</option>
                      <option value="answered">답변완료</option>
                      <option value="closed">종료</option>
                    </select>
                  </div>
                </div>

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
                              {ticket.status === 'pending' ? at('status_pending') : ticket.status === 'answered' ? at('status_answered') : at('status_closed')}
                            </span>
                            {ticket.groups && (
                              <span style={{
                                padding: '4px 8px',
                                backgroundColor: '#f3f4f6',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#4b5563',
                              }}>
                                📁 {ticket.groups.name}
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
                        {at('written_at')} {new Date(ticket.created_at).toLocaleString('ko-KR')}
                        {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
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
                        {at('submit_answer_btn')}
                      </h3>
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '4px',
                        }}>
                          {editingTicket.title}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#64748b',
                        }}>
                          {editingTicket.content}
                        </div>
                      </div>
                      <textarea
                        value={ticketAnswer}
                        onChange={(e) => setTicketAnswer(e.target.value)}
                        placeholder={at('placeholder_answer')}
                        style={{
                          width: '100%',
                          minHeight: '200px',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          marginBottom: '16px',
                          resize: 'vertical',
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
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          {at('cancel_btn')}
                        </button>
                        <button
                          onClick={async () => {
                            if (!ticketAnswer.trim()) {
                              alert('답변을 입력해주세요.');
                              return;
                            }

                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(at('error_session_expired'));
                                return;
                              }

                              const response = await fetch('/api/admin/support-tickets', {
                                method: 'PUT',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  id: editingTicket.id,
                                  answer: ticketAnswer.trim(),
                                  status: 'answered',
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || '답변 저장 실패');
                              }

                              alert('답변이 저장되었습니다.');
                              setEditingTicket(null);
                              setTicketAnswer('');
                              loadAllSupportTickets();
                            } catch (err: any) {
                              console.error('답변 저장 오류:', err);
                              alert(err.message || '답변 저장에 실패했습니다.');
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
                          저장
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                              {ticket.status === 'pending' ? at('status_pending') : ticket.status === 'answered' ? at('status_answered') : at('status_closed')}
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
                        {at('written_at')} {new Date(ticket.created_at).toLocaleString('ko-KR')}
                        {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
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
                        {at('submit_answer_btn')}
                      </h3>
                      <textarea
                        value={ticketAnswer}
                        onChange={(e) => setTicketAnswer(e.target.value)}
                        placeholder={at('placeholder_answer')}
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
                          {at('cancel_btn')}
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
                                alert(at('error_auth'));
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
                                throw new Error(result.error || at('error_answer_failed'));
                              }

                              alert(at('success_answer_submitted'));
                              setEditingTicket(null);
                              setTicketAnswer('');
                              loadSupportTickets();
                            } catch (error: any) {
                              console.error(at('error_answer_failed'), error);
                              alert(error.message || at('error_answer_failed'));
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
                          {at('submit_answer_btn')}
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
                    대시보드 접근 요청 관리 ({accessRequests.filter(r => r.status === 'pending').length}개 대기중)
                  </h2>
                  <button
                    onClick={() => {
                      setShowNewAccessRequestModal(true);
                      setNewAccessRequestGroupId('');
                      setNewAccessRequestReason('');
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
                    새 접근 요청
                  </button>
                </div>

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
                              {request.status === 'pending' ? at('status_pending') : request.status === 'approved' ? at('status_approved') : request.status === 'rejected' ? at('status_rejected') : request.status === 'expired' ? at('status_expired') : at('status_revoked')}
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
                              {at('expires_at_label')} {new Date(request.expires_at).toLocaleString('ko-KR')}
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
                                {at('rejection_reason_label')}
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
                                  alert(at('error_auth'));
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
                                  throw new Error(result.error || at('error_approve_failed'));
                                }

                                alert(at('success_request_approved'));
                                loadAccessRequests();
                              } catch (error: any) {
                                console.error(at('error_approve_failed'), error);
                                alert(error.message || at('error_approve_failed'));
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
{at('approve_btn')}
                            </button>
                          <button
                            onClick={async () => {
                              const reason = prompt(at('prompt_reject_reason'));
                              if (!reason) return;

                              try {
                                setLoadingData(true);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert(at('error_auth'));
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
                                  throw new Error(result.error || at('error_reject_failed'));
                                }

                                alert(at('success_request_rejected'));
                                loadAccessRequests();
                              } catch (error: any) {
                                console.error(at('error_reject_failed'), error);
                                alert(error.message || at('error_reject_failed'));
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
{at('reject_btn')}
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
                              if (!confirm(at('confirm_revoke_request'))) {
                                return;
                              }

                              try {
                                setLoadingData(true);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert(at('error_auth'));
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
                                  throw new Error(result.error || at('error_revoke_failed'));
                                }

                                alert(at('success_request_revoked'));
                                loadAccessRequests();
                              } catch (error: any) {
console.error(at('error_revoke_failed'), error);
                                  alert(error.message || at('error_revoke_failed'));
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
                            {at('revoke_btn')}
                          </button>
                        </div>
                      )}
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '12px',
                      }}>
                        요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                        {request.approved_at && ` | ${at('approved_at_label')} ${new Date(request.approved_at).toLocaleString('ko-KR')}`}
                        {request.rejected_at && ` | ${at('rejected_at_label')} ${new Date(request.rejected_at).toLocaleString('ko-KR')}`}
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

                {/* 새 접근 요청 모달 */}
                {showNewAccessRequestModal && (
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
                    setShowNewAccessRequestModal(false);
                    setNewAccessRequestGroupId('');
                    setNewAccessRequestReason('');
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
                        새 접근 요청
                      </h3>
                      <div style={{
                        marginBottom: '16px',
                      }}>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '8px',
                        }}>
                          그룹 선택
                        </label>
                        <select
                          value={newAccessRequestGroupId}
                          onChange={(e) => setNewAccessRequestGroupId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                          }}
                        >
                          <option value="">그룹을 선택하세요</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{
                        marginBottom: '16px',
                      }}>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '8px',
                        }}>
                          요청 이유
                        </label>
                        <textarea
                          value={newAccessRequestReason}
                          onChange={(e) => setNewAccessRequestReason(e.target.value)}
                          placeholder={at('placeholder_reason')}
                          style={{
                            width: '100%',
                            minHeight: '150px',
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                          }}
                        />
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                      }}>
                        <button
                          onClick={() => {
                            setShowNewAccessRequestModal(false);
                            setNewAccessRequestGroupId('');
                            setNewAccessRequestReason('');
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          {at('cancel_btn')}
                        </button>
                        <button
                          onClick={async () => {
                            if (!newAccessRequestGroupId) {
                              alert(at('select_group_prompt'));
                              return;
                            }
                            if (!newAccessRequestReason.trim()) {
                              alert(at('placeholder_reason'));
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(at('error_auth'));
                                return;
                              }

                              const response = await fetch('/api/admin/dashboard-access-requests', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  group_id: newAccessRequestGroupId,
                                  reason: newAccessRequestReason.trim(),
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || at('error_create_request_failed'));
                              }

                              alert(at('success_request_created'));
                              setShowNewAccessRequestModal(false);
                              setNewAccessRequestGroupId('');
                              setNewAccessRequestReason('');
                              loadAccessRequests();
                            } catch (error: any) {
                              console.error(at('error_create_request_failed'), error);
                              alert(error.message || at('error_create_request_failed'));
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
                          요청하기
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 감사 로그 탭 */}
            {activeTab === 'audit-log' && (
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '24px' }}>
                  관리자 감사 로그
                </h2>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}>
                  <label style={{ fontSize: '13px', color: '#475569' }}>기간</label>
                  <input
                    type="date"
                    value={auditLogFilters.from}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, from: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
                  />
                  <span style={{ color: '#94a3b8' }}>~</span>
                  <input
                    type="date"
                    value={auditLogFilters.to}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, to: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
                  />
                  <select
                    value={auditLogFilters.resource_type}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, resource_type: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '140px' }}
                  >
                    <option value="">전체 유형</option>
                    <option value="group">그룹</option>
                    <option value="user">사용자</option>
                    <option value="announcement">공지</option>
                    <option value="dashboard_access_request">접근 요청</option>
                    <option value="support_ticket">문의</option>
                    <option value="system_admin">시스템 관리자</option>
                  </select>
                  <input
                    type="text"
                    placeholder={at('placeholder_admin_id')}
                    value={auditLogFilters.admin_id}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, admin_id: e.target.value.trim() }))}
                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', width: '220px' }}
                  />
                  <input
                    type="text"
                    placeholder={at('placeholder_group_id')}
                    value={auditLogFilters.group_id}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, group_id: e.target.value.trim() }))}
                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', width: '220px' }}
                  />
                  <button
                    onClick={() => loadAuditLogs(1)}
                    disabled={auditLogLoading}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#9333ea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: auditLogLoading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {auditLogLoading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : null}
                    조회
                  </button>
                  <button
                    onClick={exportAuditLogsCsv}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download style={{ width: '16px', height: '16px' }} />
                    CSV 내보내기
                  </button>
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        {getAdminAuditHeaders(adminLang).slice(0, 9).map((h, i) => (
                          <th key={i} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogLoading && auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                            <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                            {at('loading')}
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                            {at('no_audit_log')}
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                            <td style={{ padding: '10px 12px' }}>{log.action}</td>
                            <td style={{ padding: '10px 12px' }}>{log.resource_type}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>{log.resource_id || '-'}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>{log.admin_id}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>{log.group_id || '-'}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>{log.target_user_id || '-'}</td>
                            <td style={{ padding: '10px 12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {log.details ? JSON.stringify(log.details) : '-'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>{log.ip_address || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {auditLogTotal > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '16px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      총 {auditLogTotal.toLocaleString()}건 ({(auditLogPage - 1) * auditLogLimit + 1}–{Math.min(auditLogPage * auditLogLimit, auditLogTotal)})
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => loadAuditLogs(auditLogPage - 1)}
                        disabled={auditLogPage <= 1 || auditLogLoading}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          cursor: auditLogPage <= 1 || auditLogLoading ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        이전
                      </button>
                      <span style={{ alignSelf: 'center', fontSize: '13px', color: '#475569' }}>{auditLogPage} / {Math.ceil(auditLogTotal / auditLogLimit) || 1}</span>
                      <button
                        onClick={() => loadAuditLogs(auditLogPage + 1)}
                        disabled={auditLogPage >= Math.ceil(auditLogTotal / auditLogLimit) || auditLogLoading}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          cursor: auditLogPage >= Math.ceil(auditLogTotal / auditLogLimit) || auditLogLoading ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
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

