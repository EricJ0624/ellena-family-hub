'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAdminTranslation, getAdminAuditHeaders } from '@/lib/translations/admin';
import { getCommonTranslation } from '@/lib/translations/common';
import { 
  Users, 
  User,
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
import { GroupAdminPanel } from '@/app/components/group-admin/GroupAdminPanel';
import { useGroup } from '@/app/contexts/GroupContext';
import { getAnnouncementTexts } from '@/lib/announcement-i18n';
import type { LangCode } from '@/lib/language-fonts';
import { parseMessageThread } from '@/lib/support-ticket-thread';
import { parseMemberSupportMessageThread } from '@/lib/member-support-ticket-thread';

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
  message_thread?: unknown;
  created_at: string;
  updated_at: string;
  groups?: {
    id: string;
    name: string;
  };
}

/** 멤버↔그룹관리자 문의 (member_support_tickets) */
interface MemberGroupInquiryInfo {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  message_thread?: unknown;
  groups?: { id: string; name: string };
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
  const { setCurrentGroupId } = useGroup();
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'groups' | 'group-admin' | 'announcements' | 'all-support-tickets' | 'member-inquiries' | 'support-tickets' | 'dashboard-access-requests' | 'audit-log'>('dashboard');
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

  // 공지사항, 문의, 접근 요청 관련 상태
  const [announcements, setAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketInfo[]>([]);
  const [memberGroupInquiries, setMemberGroupInquiries] = useState<MemberGroupInquiryInfo[]>([]);
  const [deletingMemberInquiryId, setDeletingMemberInquiryId] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<DashboardAccessRequestInfo[]>([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementInfo | null | undefined>(undefined);
  const [editingTicket, setEditingTicket] = useState<SupportTicketInfo | null>(null);
  const [announcementTitleI18n, setAnnouncementTitleI18n] = useState<Record<string, string>>(() => Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
  const [announcementContentI18n, setAnnouncementContentI18n] = useState<Record<string, string>>(() => Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
  const [announcementTarget, setAnnouncementTarget] = useState<'ADMIN_ONLY' | 'ALL_MEMBERS'>('ADMIN_ONLY');
  const [announcementLangTab, setAnnouncementLangTab] = useState<LangCode>('ko');
  const [ticketAnswer, setTicketAnswer] = useState('');
  const [deletingSystemSupportTicketId, setDeletingSystemSupportTicketId] = useState<string | null>(null);
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_auth'));
        setLoadingData(false);
        return;
      }

      const response = await fetch('/api/admin/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || at('error_stats'));
      }

      setStats({
        totalUsers: Number(result?.data?.totalUsers || 0),
        totalGroups: Number(result?.data?.totalGroups || 0),
        activeUsers: Number(result?.data?.activeUsers || 0),
        totalAdmins: Number(result?.data?.totalAdmins || 0),
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

  // 그룹 선택 변경
  useEffect(() => {
    if (selectedGroupId) {
      loadSelectedGroup(selectedGroupId);
    } else {
      setSelectedGroup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  /** 그룹 관리 임베드 시 MemberManagement/GroupSettings가 선택 그룹을 쓰도록 컨텍스트 동기화 */
  useEffect(() => {
    if (activeTab === 'group-admin' && selectedGroupId && setCurrentGroupId) {
      setCurrentGroupId(selectedGroupId);
    }
  }, [activeTab, selectedGroupId, setCurrentGroupId]);

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
      /* GroupAdminPanel이 탭별 데이터를 자체 로드 */
    } else if (activeTab === 'announcements') {
      loadAnnouncements();
    } else if (activeTab === 'all-support-tickets') {
      loadAllSupportTickets();
    } else if (activeTab === 'member-inquiries') {
      loadMemberGroupInquiries();
    } else if (activeTab === 'support-tickets') {
      loadSupportTickets();
    } else if (activeTab === 'dashboard-access-requests') {
      loadAccessRequests();
    } else if (activeTab === 'audit-log') {
      loadAuditLogs(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthorized, selectedGroupId]);

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

  const loadMemberGroupInquiries = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_session_expired'));
        setLoadingData(false);
        return;
      }

      const response = await fetch('/api/admin/member-support-tickets', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || at('error_member_inquiries'));
      }

      setMemberGroupInquiries(result.data || []);
    } catch (err: unknown) {
      console.error('멤버 문의(전체) 로드 오류:', err);
      setError(err instanceof Error ? err.message : at('error_member_inquiries'));
      setMemberGroupInquiries([]);
    } finally {
      setLoadingData(false);
    }
  }, [at]);

  const handleDeleteMemberGroupInquiry = useCallback(
    async (ticket: MemberGroupInquiryInfo) => {
      if (!confirm(at('confirm_delete_member_inquiry'))) return;
      setDeletingMemberInquiryId(ticket.id);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          alert(at('error_session_expired'));
          return;
        }
        const res = await fetch(
          `/api/support-tickets?id=${encodeURIComponent(ticket.id)}&group_id=${encodeURIComponent(ticket.group_id)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(typeof json.error === 'string' ? json.error : at('error_member_inquiries'));
          return;
        }
        setMemberGroupInquiries((prev) => prev.filter((t) => t.id !== ticket.id));
      } catch (e) {
        console.error('멤버 문의 삭제 오류:', e);
        alert(at('error_member_inquiries'));
      } finally {
        setDeletingMemberInquiryId(null);
      }
    },
    [at]
  );

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
    // 그룹 정보 로드 (권한 검증 포함)
    await loadSelectedGroup(groupId);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin" />
          <p className="text-base text-slate-500">{at('checking_permission')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div
      className="admin-page min-h-screen bg-[#f5f7fa] p-5"
    >
      {/* 헤더 */}
      <div
        className="admin-header mb-6 rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
      >
        <div
          className="admin-header-top mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-600 p-3 text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="m-0 text-2xl font-bold text-slate-800">
                {at('page_title')}
              </h1>
              <p className="m-0 mt-1 text-sm text-slate-500">
                {at('page_subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setAdminLang('ko')}
                className={`cursor-pointer rounded-md border-none px-3 py-1.5 text-[13px] font-semibold ${
                  adminLang === 'ko' ? 'bg-purple-600 text-white' : 'bg-transparent text-slate-500'
                }`}
              >
                한국어
              </button>
              <button
                type="button"
                onClick={() => setAdminLang('en')}
                className={`cursor-pointer rounded-md border-none px-3 py-1.5 text-[13px] font-semibold ${
                  adminLang === 'en' ? 'bg-purple-600 text-white' : 'bg-transparent text-slate-500'
                }`}
              >
                English
              </button>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex cursor-pointer items-center gap-2 rounded-lg border-none bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              <X className="h-4 w-4" />
              {ct('close')}
            </button>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div
          className="admin-tabs flex gap-2 border-b-2 border-slate-200"
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <BarChart3 className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_dashboard')}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'users'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <Users className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_users')}
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'groups'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <Settings className="mr-2 inline h-[18px] w-[18px] align-middle" />
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
            className={`border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'group-admin'
                ? 'border-purple-600 font-semibold text-purple-600'
                : manageableGroups.length > 0
                  ? 'border-transparent font-medium text-slate-500'
                  : 'border-transparent font-medium text-slate-400 opacity-50'
            } ${(manageableGroups.length > 0 || activeTab === 'group-admin') ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          >
            <Shield className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_group_admin')} {manageableGroups.length > 0 && `(${manageableGroups.length})`}
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'announcements'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <Megaphone className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_announcements')}
          </button>
          <button
            onClick={() => setActiveTab('all-support-tickets')}
            className={`relative cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'all-support-tickets'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <MessageSquare className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_support')}
            {supportTickets.filter(t => t.status === 'pending').length > 0 && (
              <span className="absolute right-2 top-2 rounded-[10px] bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {supportTickets.filter(t => t.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('member-inquiries')}
            className={`relative cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'member-inquiries'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <MessageSquare className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_member_inquiries')}
            {memberGroupInquiries.filter((t) => t.status === 'pending').length > 0 && (
              <span className="absolute right-2 top-2 rounded-[10px] bg-orange-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {memberGroupInquiries.filter((t) => t.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dashboard-access-requests')}
            className={`relative cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'dashboard-access-requests'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <KeyRound className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_access_requests')}
            {accessRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="absolute right-2 top-2 rounded-[10px] bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {accessRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audit-log')}
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 ${
              activeTab === 'audit-log'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <FileText className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_audit_log')}
          </button>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div
        className="admin-content rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
      >
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-100 px-4 py-3 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-3 text-slate-500">{at('loading')}</span>
          </div>
        ) : (
          <>
            {/* 대시보드 탭 */}
            {activeTab === 'dashboard' && stats && (
              <div>
                <h2 className="mb-6 text-xl font-semibold text-slate-800">
                  {at('system_stats')}
                </h2>
                <div
                  className="admin-grid grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-sky-200 bg-sky-50 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-sky-700">
                      {at('total_users')}
                    </div>
                    <div className="text-[32px] font-bold text-sky-900">
                      {stats.totalUsers.toLocaleString()}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl border border-amber-200 bg-amber-100 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-amber-800">
                      {at('active_users')}
                    </div>
                    <div className="text-[32px] font-bold text-amber-900">
                      {stats.activeUsers.toLocaleString()}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl border border-purple-300 bg-purple-100 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-purple-800">
                      {at('total_groups')}
                    </div>
                    <div className="text-[32px] font-bold text-purple-900">
                      {stats.totalGroups.toLocaleString()}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl border border-pink-200 bg-pink-100 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-pink-800">
                      {at('system_admins')}
                    </div>
                    <div className="text-[32px] font-bold text-pink-900">
                      {stats.totalAdmins.toLocaleString()}
                    </div>
                  </motion.div>
                </div>

                {/* 최근 문의 위젯 */}
                <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="mb-1 text-base font-semibold text-slate-800">
                        최근 문의
                      </div>
                      <div className="text-[13px] text-slate-500">
                        미답변 문의: <span className={supportTickets.filter(t => t.status === 'pending').length > 0 ? 'font-semibold text-red-500' : 'font-semibold text-green-500'}>
                          {supportTickets.filter(t => t.status === 'pending').length}건
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('all-support-tickets')}
                      className="cursor-pointer rounded-md border-none bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-purple-700"
                    >
                      전체 보기
                    </button>
                  </div>
                  {supportTickets.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      문의가 없습니다.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {supportTickets.slice(0, 5).map((ticket) => (
                        <div
                          key={ticket.id}
                          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                          onClick={() => setActiveTab('all-support-tickets')}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-800">
                              {ticket.title}
                            </div>
                            <span className={`rounded px-2 py-1 text-[11px] font-semibold ${
                              ticket.status === 'pending'
                                ? 'bg-red-100 text-red-800'
                                : ticket.status === 'answered'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {ticket.status === 'pending' ? at('status_pending') : ticket.status === 'answered' ? at('status_answered') : at('status_closed')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">
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
                <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
                  <div className="mb-3 text-base font-semibold text-slate-800">
                    가족 생성/가입
                  </div>
                  <div className="mb-4 text-sm text-slate-500">
                    {at('users_empty_hint')}
                  </div>
                  <button
                    onClick={() => router.push('/onboarding?from=admin')}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_4px_rgba(147,51,234,0.2)] transition-all duration-200 hover:bg-purple-700 hover:shadow-[0_4px_8px_rgba(147,51,234,0.3)]"
                  >
                    <UserPlus className="h-[18px] w-[18px]" />
                    가족 생성/가입하기
                  </button>
                </div>
              </div>
            )}

            {/* 회원 관리 탭 */}
            {activeTab === 'users' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    회원 목록 ({filteredUsers.length}명)
                  </h2>
                  <div
                    className="admin-search relative w-[300px]"
                  >
                    <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={at('search_user_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-50">
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          이메일
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          별명
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          가입일
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          그룹 수
                        </th>
                        <th className="p-3 text-center text-sm font-semibold text-slate-600">
                          권한
                        </th>
                        <th className="p-3 text-right text-sm font-semibold text-slate-600">
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
                          className="border-b border-slate-200 transition-colors duration-200 hover:bg-slate-50"
                        >
                          <td className="p-3 text-sm text-slate-800">
                            {user.email || '-'}
                          </td>
                          <td className="p-3 text-sm text-slate-800">
                            {user.nickname || '-'}
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            {new Date(user.created_at).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            {user.groups_count}개
                          </td>
                          <td className="p-3 text-center">
                            {systemAdmins.includes(user.id) ? (
                              <span className="rounded-xl bg-purple-700 px-3 py-1 text-xs font-semibold text-white">
                                시스템 관리자
                              </span>
                            ) : (
                              <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                일반 사용자
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              {/* 시스템 관리자 승격/해제 버튼 */}
                              {systemAdmins.includes(user.id) ? (
                                <button
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-amber-600"
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
                                  <Shield className="h-4 w-4" />
                                  권한 해제
                                </button>
                              ) : (
                                <button
                                  className={`inline-flex items-center gap-1.5 rounded-md border-none px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ${
                                    systemAdminCount >= 1
                                      ? 'cursor-not-allowed bg-slate-400 opacity-60'
                                      : 'cursor-pointer bg-purple-700 opacity-100 hover:bg-purple-800'
                                  }`}
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
                                  <Shield className="h-4 w-4" />
                                  관리자 승격
                                </button>
                              )}
                              
                              {/* {at('force_leave_btn')} 버튼 */}
                              <button
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-red-700"
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
                              <UserX className="h-[14px] w-[14px]" />
                              {at('force_leave_btn')}
                            </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{at('no_users')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 그룹 관리 탭 */}
            {activeTab === 'groups' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    {at('tab_groups')} ({filteredGroups.length})
                  </h2>
                  <div
                    className="admin-search relative w-[300px]"
                  >
                    <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={at('search_group_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
                    />
                  </div>
                </div>

                <div
                  className="admin-grid grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4"
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
                      className="rounded-xl border border-slate-200 bg-slate-50 p-5 transition-all duration-200 hover:border-slate-300 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)]"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="m-0 text-lg font-semibold text-slate-800">
                          {group.name}
                        </h3>
                        <Crown className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="mb-2 text-sm text-slate-500">
                        {at('owner')}: {group.owner_email || '-'}
                      </div>
                      <div className="mb-2 text-sm text-slate-500">
                        {at('members_count')}: {group.member_count}
                      </div>
                        <div className="mb-3 text-sm text-slate-500">
                          {at('storage')}: {formatBytes(usedBytes)} / {formatBytes(quotaBytes)} ({percent.toFixed(0)}%)
                        </div>
                        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div style={{
                            width: `${percent}%`,
                            height: '100%',
                            backgroundColor: percent >= 90 ? '#ef4444' : percent >= 70 ? '#f59e0b' : '#22c55e',
                            transition: 'width 0.2s',
                          }} />
                        </div>
                      <div className="mb-4 text-xs text-slate-400">
                        {at('created_at')}: {new Date(group.created_at).toLocaleDateString(adminLang === 'ko' ? 'ko-KR' : 'en-US')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                          <button
                            className="flex-[1_1_120px] cursor-pointer rounded-lg border-none bg-sky-100 px-3 py-2 text-[13px] font-semibold text-sky-700"
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
                            className="flex-1 cursor-pointer rounded-lg border-none bg-purple-600 px-4 py-2 text-sm font-semibold text-white"
                            onClick={() => handleSelectGroupForAdmin(group.id)}
                          >
{at('manage_btn')}
                            </button>
                        )}
                        <button
                          className={`cursor-pointer rounded-lg border-none bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 ${
                            manageableGroups.some(mg => mg.id === group.id) ? 'flex-1' : 'w-full'
                          }`}
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
                  <div className="p-12 text-center text-slate-400">
                    <Settings className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>{at('no_groups')}</p>
                  </div>
                )}
              </div>
            )}

            {/* 그룹 관리 탭 (시스템 관리자가 그룹을 관리하는 탭) */}
            {activeTab === 'group-admin' && (
              <div>
                {/* 그룹 선택 드롭다운 */}
                <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">
                    {at('select_group_label')}
                  </label>
                  <select
                    value={selectedGroupId || ''}
                    onChange={async (e) => {
                      const groupId = e.target.value;
                      setSelectedGroupId(groupId || null);
                      if (groupId) {
                        await loadSelectedGroup(groupId);
                      } else {
                        setSelectedGroup(null);
                      }
                    }}
                    className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">{at('select_group_option')}</option>
                    {/* 관리 가능한 그룹만 표시 */}
                    {manageableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.member_count}명)
                      </option>
                    ))}
                  </select>
                  {manageableGroups.length === 0 && (
                    <p className="mt-2 text-[13px] italic text-amber-500">
                      {at('no_manageable_groups')}
                    </p>
                  )}
                </div>

                {selectedGroup && selectedGroupId && (
                  <GroupAdminPanel
                    variant="embedded"
                    embeddedGroupId={selectedGroupId}
                    embeddedGroupName={selectedGroup.name}
                    showPiggyArchivesTab
                    adminLangForPiggy={adminLang}
                    onEmbeddedClose={() => setActiveTab('dashboard')}
                  />
                )}

                {!selectedGroup && (
                  <div className="p-12 text-center text-slate-400">
                    <Shield className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>{at('select_group_prompt')}</p>
                  </div>
                )}
              </div>
            )}

            {/* 공지 관리 탭 */}
            {activeTab === 'announcements' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
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
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    {at('new_announcement_btn')}
                  </button>
                </div>

                {/* 공지 목록 */}
                <div className="flex flex-col gap-4">
                  {announcements.map((announcement) => (
                    <motion.div
                      key={announcement.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-5 ${
                        announcement.is_active
                          ? 'border-slate-200 bg-slate-50 opacity-100'
                          : 'border-red-200 bg-red-50 opacity-70'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <h3 className="m-0 text-lg font-semibold text-slate-800">
                              {getAnnouncementTexts(announcement, adminLang).title || announcement.title}
                            </h3>
                            {!announcement.is_active && (
                              <span className="rounded bg-red-200 px-2 py-1 text-[11px] font-semibold text-red-800">
                                {at('disabled_label')}
                              </span>
                            )}
                            <span
                              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                                (announcement as any).target === 'ALL_MEMBERS'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {(announcement as any).target === 'ALL_MEMBERS' ? at('target_all_members') : at('target_admin_only')}
                            </span>
                          </div>
                          <p className="m-0 whitespace-pre-wrap text-sm text-slate-500">
                            {getAnnouncementTexts(announcement, adminLang).content || announcement.content}
                          </p>
                        </div>
                        <div className="ml-4 flex gap-2">
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
                            className="cursor-pointer rounded-md border-none bg-indigo-100 px-3 py-2 text-[13px] font-semibold text-indigo-800"
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
                              className="cursor-pointer rounded-md border-none bg-amber-100 px-3 py-2 text-[13px] font-semibold text-amber-800"
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
                              className="cursor-pointer rounded-md border-none bg-red-100 px-3 py-2 text-[13px] font-semibold text-red-800"
                            >
                              {at('permanent_delete_btn')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">
                        {at('written_at')} {new Date(announcement.created_at).toLocaleString('ko-KR')}
                        {announcement.updated_at !== announcement.created_at && ` | ${at('updated_at_label')} ${new Date(announcement.updated_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {announcements.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <Megaphone className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{at('no_announcements')}</p>
                    </div>
                  )}
                </div>

                {/* 공지 작성/수정 모달 */}
                {editingAnnouncement !== undefined && (
                  <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                  onClick={() => {
                    setEditingAnnouncement(undefined);
                    setAnnouncementTitleI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                    setAnnouncementContentI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                    setAnnouncementTarget('ADMIN_ONLY');
                  }}
                  >
                    <div
                    className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6"
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-4 text-xl font-semibold text-slate-800">
                        {editingAnnouncement ? at('edit_announcement_modal_title') : at('new_announcement_modal_title')}
                      </h3>
                      <div className="mb-4 flex gap-1 border-b border-slate-200">
                        {ANNOUNCEMENT_LANGS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setAnnouncementLangTab(l)}
                            className={`cursor-pointer border-none border-b-2 bg-transparent px-3.5 py-2 text-[13px] ${
                              announcementLangTab === l
                                ? 'border-b-purple-600 font-semibold text-purple-600'
                                : 'border-b-transparent font-normal text-slate-500'
                            }`}
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
                        className="mb-4 w-full rounded-lg border border-slate-200 p-3 text-base font-inherit"
                      />
                      <textarea
                        value={announcementContentI18n[announcementLangTab] ?? ''}
                        onChange={(e) => setAnnouncementContentI18n((prev) => ({ ...prev, [announcementLangTab]: e.target.value }))}
                        placeholder={at('placeholder_content')}
                        className="mb-4 min-h-[280px] w-full rounded-lg border border-slate-200 p-3 text-sm font-inherit"
                      />
                      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <label className="mb-3 block text-sm font-semibold text-slate-700">
                          공지 대상 선택
                        </label>
                        <div className="flex gap-4">
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors duration-200 ${
                              announcementTarget === 'ADMIN_ONLY' ? 'bg-indigo-100' : 'bg-transparent'
                            }`}
                          >
                            <input
                              type="radio"
                              name="announcementTarget"
                              value="ADMIN_ONLY"
                              checked={announcementTarget === 'ADMIN_ONLY'}
                              onChange={(e) => setAnnouncementTarget(e.target.value as 'ADMIN_ONLY' | 'ALL_MEMBERS')}
                              className="cursor-pointer"
                            />
                            <span className={`text-sm text-slate-700 ${announcementTarget === 'ADMIN_ONLY' ? 'font-semibold' : 'font-normal'}`}>
                              관리자만
                            </span>
                          </label>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors duration-200 ${
                              announcementTarget === 'ALL_MEMBERS' ? 'bg-indigo-100' : 'bg-transparent'
                            }`}
                          >
                            <input
                              type="radio"
                              name="announcementTarget"
                              value="ALL_MEMBERS"
                              checked={announcementTarget === 'ALL_MEMBERS'}
                              onChange={(e) => setAnnouncementTarget(e.target.value as 'ADMIN_ONLY' | 'ALL_MEMBERS')}
                              className="cursor-pointer"
                            />
                            <span className={`text-sm text-slate-700 ${announcementTarget === 'ALL_MEMBERS' ? 'font-semibold' : 'font-normal'}`}>
                              모든 멤버
                            </span>
                          </label>
                        </div>
                        <p className="mb-0 mt-2 text-xs text-slate-500">
                          {announcementTarget === 'ADMIN_ONLY' 
                            ? '그룹 관리자와 시스템 관리자만 볼 수 있습니다.' 
                            : '모든 그룹 멤버가 볼 수 있습니다.'}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingAnnouncement(undefined);
                            setAnnouncementTitleI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                            setAnnouncementContentI18n(Object.fromEntries(ANNOUNCEMENT_LANGS.map((l) => [l, ''])));
                            setAnnouncementTarget('ADMIN_ONLY');
                          }}
                          className="cursor-pointer rounded-lg border-none bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
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
                              alert(at('announcement_title_content_required'));
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
                          className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
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
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    전체 문의 ({supportTickets.filter(t => t.status === 'pending').length}개 미답변)
                  </h2>
                  <div className="flex gap-2">
                    <select
                      className="cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm"
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

                <div className="flex flex-col gap-4">
                  {supportTickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-5 ${
                        ticket.status === 'pending' ? 'border-amber-200 bg-amber-100' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <h3 className="m-0 text-lg font-semibold text-slate-800">
                              {ticket.title}
                            </h3>
                            <span
                              className={`rounded-xl px-3 py-1 text-xs font-semibold text-white ${
                                ticket.status === 'pending'
                                  ? 'bg-amber-400'
                                  : ticket.status === 'answered'
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-400'
                              }`}
                            >
                              {ticket.status === 'pending' ? at('status_pending') : ticket.status === 'answered' ? at('status_answered') : at('status_closed')}
                            </span>
                            {ticket.groups && (
                              <span className="rounded-md bg-gray-100 px-2 py-1 text-[13px] font-medium text-gray-600">
                                📁 {ticket.groups.name}
                              </span>
                            )}
                          </div>
                          <p className="mb-3 mt-0 whitespace-pre-wrap text-sm text-slate-500">
                            {ticket.content}
                          </p>
                          {ticket.answer && (
                            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                              <div className="mb-2 text-xs font-semibold text-sky-700">
                                답변:
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                                {ticket.answer}
                              </p>
                            </div>
                          )}
                          {parseMessageThread(ticket.message_thread).map((entry, idx) => (
                            <div
                              key={`${entry.created_at}-${idx}`}
                              className={`mt-3 rounded-lg border p-3.5 ${
                                entry.role === 'group_admin' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'
                              }`}
                            >
                              <div className={`mb-1.5 text-xs font-semibold ${entry.role === 'group_admin' ? 'text-amber-700' : 'text-sky-700'}`}>
                                {entry.role === 'group_admin' ? '추가 문의' : '시스템 답변'}
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                                {entry.body}
                              </p>
                              <div className="mt-2 text-[11px] text-slate-400">
                                {new Date(entry.created_at).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={deletingSystemSupportTicketId === ticket.id}
                          onClick={async () => {
                            if (!confirm('이 문의를 삭제할까요?')) return;
                            try {
                              setDeletingSystemSupportTicketId(ticket.id);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(at('error_auth'));
                                return;
                              }
                              const response = await fetch(
                                `/api/admin/support-tickets?id=${encodeURIComponent(ticket.id)}`,
                                {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${session.access_token}` },
                                }
                              );
                              const result = await response.json();
                              if (!response.ok) {
                                throw new Error(result.error || '삭제에 실패했습니다.');
                              }
                              loadAllSupportTickets();
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
                            } finally {
                              setDeletingSystemSupportTicketId(null);
                            }
                          }}
                          className={`inline-flex h-fit flex-shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 ${
                            deletingSystemSupportTicketId === ticket.id ? 'cursor-wait' : 'cursor-pointer'
                          }`}
                        >
                          {deletingSystemSupportTicketId === ticket.id ? (
                            <Loader2 className="h-[14px] w-[14px] animate-spin" />
                          ) : (
                            <Trash2 className="h-[14px] w-[14px]" />
                          )}
                          삭제
                        </button>
                      </div>
                      {ticket.status === 'pending' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTicket(ticket);
                              setTicketAnswer('');
                            }}
                            className="cursor-pointer rounded-md border-none bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white"
                          >
                            답변하기
                          </button>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        {at('written_at')} {new Date(ticket.created_at).toLocaleString('ko-KR')}
                        {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {supportTickets.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>문의가 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* 답변 모달 */}
                {editingTicket && (
                  <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                  onClick={() => setEditingTicket(null)}
                  >
                    <div
                    className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6"
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-4 text-xl font-semibold text-slate-800">
                        {at('submit_answer_btn')}
                      </h3>
                      <div className="mb-4 rounded-lg bg-slate-50 p-3">
                        <div className="mb-1 text-sm font-semibold text-slate-800">
                          {editingTicket.title}
                        </div>
                        <div className="text-[13px] text-slate-500">
                          {editingTicket.content}
                        </div>
                        {editingTicket.answer && (
                          <div className="mt-3 text-xs text-sky-700">
                            <div className="mb-1 font-semibold">첫 답변</div>
                            <div className="whitespace-pre-wrap text-slate-600">{editingTicket.answer}</div>
                          </div>
                        )}
                        {parseMessageThread(editingTicket.message_thread).map((entry, idx) => (
                          <div key={`m-${idx}`} className="mt-2.5 text-xs">
                            <div className={`font-semibold ${entry.role === 'group_admin' ? 'text-amber-700' : 'text-sky-700'}`}>
                              {entry.role === 'group_admin' ? '추가 문의' : '시스템 답변'}
                            </div>
                            <div className="whitespace-pre-wrap text-slate-600">{entry.body}</div>
                          </div>
                        ))}
                      </div>
                      <textarea
                        value={ticketAnswer}
                        onChange={(e) => setTicketAnswer(e.target.value)}
                        placeholder={at('placeholder_answer')}
                        className="mb-4 min-h-[200px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm font-inherit"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingTicket(null);
                            setTicketAnswer('');
                          }}
                          className="cursor-pointer rounded-lg border-none bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-500"
                        >
                          {at('cancel_btn')}
                        </button>
                        <button
                          onClick={async () => {
                            if (!ticketAnswer.trim()) {
                              alert(at('answer_required'));
                              return;
                            }

                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(at('error_session_expired'));
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
                                  answer: ticketAnswer.trim(),
                                  status: 'answered',
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || at('answer_save_failed'));
                              }

                              alert(at('answer_saved'));
                              setEditingTicket(null);
                              setTicketAnswer('');
                              loadAllSupportTickets();
                            } catch (err: any) {
                              console.error('답변 저장 오류:', err);
                              alert(err.message || at('answer_save_error'));
                            }
                          }}
                          className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'member-inquiries' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    {at('tab_member_inquiries')} ({memberGroupInquiries.filter((t) => t.status === 'pending').length}{adminLang === 'en' ? ' pending' : '건 미답변'})
                  </h2>
                </div>

                <div className="flex flex-col gap-4">
                  {memberGroupInquiries.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-5 ${
                        ticket.status === 'pending' ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <h3 className="m-0 text-lg font-semibold text-slate-800">
                              {ticket.title}
                            </h3>
                            {ticket.groups && (
                              <span className="rounded-md bg-gray-100 px-2 py-1 text-[13px] font-medium text-gray-600">
                                📁 {ticket.groups.name}
                              </span>
                            )}
                            <span
                              className={`rounded-xl px-3 py-1 text-xs font-semibold text-white ${
                                ticket.status === 'pending'
                                  ? 'bg-orange-500'
                                  : ticket.status === 'answered'
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-400'
                              }`}
                            >
                              {ticket.status === 'pending' ? at('status_pending') : ticket.status === 'answered' ? at('status_answered') : at('status_closed')}
                            </span>
                          </div>
                          <p className="mb-3 mt-0 whitespace-pre-wrap text-sm text-slate-500">
                            {ticket.content}
                          </p>
                          {ticket.answer && (
                            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3.5">
                              <div className="mb-1.5 text-xs font-semibold text-sky-700">
                                {at('answer_label')}
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                                {ticket.answer}
                              </p>
                            </div>
                          )}
                          {parseMemberSupportMessageThread(ticket.message_thread).map((entry, idx) => (
                            <div
                              key={`mgi-${entry.created_at}-${idx}`}
                              className={`mt-2.5 rounded-lg border p-3 ${
                                entry.role === 'member' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'
                              }`}
                            >
                              <div className={`mb-1 text-xs font-semibold ${entry.role === 'member' ? 'text-amber-700' : 'text-sky-700'}`}>
                                {entry.role === 'member' ? (adminLang === 'en' ? 'Follow-up' : '추가 문의') : at('answer_label')}
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-[13px] text-slate-800">
                                {entry.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-slate-400">
                          {at('written_at')} {new Date(ticket.created_at).toLocaleString(adminLang === 'en' ? 'en-US' : 'ko-KR')}
                          {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString(adminLang === 'en' ? 'en-US' : 'ko-KR')}`}
                        </div>
                        <button
                          type="button"
                          disabled={deletingMemberInquiryId === ticket.id}
                          onClick={() => void handleDeleteMemberGroupInquiry(ticket)}
                          className={`rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] font-semibold text-red-700 ${
                            deletingMemberInquiryId === ticket.id ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'
                          }`}
                        >
                          {deletingMemberInquiryId === ticket.id ? '…' : ct('delete')}
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {memberGroupInquiries.length === 0 && !loadingData && (
                    <div className="p-12 text-center text-slate-400">
                      <p>{at('no_inquiries')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'support-tickets' && (
              <div>
                <h2 className="mb-6 text-xl font-semibold text-slate-800">
                  문의 관리 ({supportTickets.filter(t => t.status === 'pending').length}개 대기중)
                </h2>

                <div className="flex flex-col gap-4">
                  {supportTickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-5 ${
                        ticket.status === 'pending' ? 'border-amber-200 bg-amber-100' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <h3 className="m-0 text-lg font-semibold text-slate-800">
                              {ticket.title}
                            </h3>
                            <span
                              className={`rounded-xl px-3 py-1 text-xs font-semibold text-white ${
                                ticket.status === 'pending'
                                  ? 'bg-amber-400'
                                  : ticket.status === 'answered'
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-400'
                              }`}
                            >
                              {ticket.status === 'pending' ? at('status_pending') : ticket.status === 'answered' ? at('status_answered') : at('status_closed')}
                            </span>
                            {ticket.groups && (
                              <span className="text-sm text-slate-500">
                                그룹: {ticket.groups.name}
                              </span>
                            )}
                          </div>
                          <p className="mb-3 mt-0 whitespace-pre-wrap text-sm text-slate-500">
                            {ticket.content}
                          </p>
                          {ticket.answer && (
                            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                              <div className="mb-2 text-xs font-semibold text-sky-700">
                                답변:
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                                {ticket.answer}
                              </p>
                            </div>
                          )}
                          {parseMessageThread(ticket.message_thread).map((entry, idx) => (
                            <div
                              key={`st-${entry.created_at}-${idx}`}
                              className={`mt-3 rounded-lg border p-3.5 ${
                                entry.role === 'group_admin' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'
                              }`}
                            >
                              <div className={`mb-1.5 text-xs font-semibold ${entry.role === 'group_admin' ? 'text-amber-700' : 'text-sky-700'}`}>
                                {entry.role === 'group_admin' ? '추가 문의' : '시스템 답변'}
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                                {entry.body}
                              </p>
                              <div className="mt-2 text-[11px] text-slate-400">
                                {new Date(entry.created_at).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={deletingSystemSupportTicketId === ticket.id}
                          onClick={async () => {
                            if (!confirm('이 문의를 삭제할까요?')) return;
                            try {
                              setDeletingSystemSupportTicketId(ticket.id);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(at('error_auth'));
                                return;
                              }
                              const response = await fetch(
                                `/api/admin/support-tickets?id=${encodeURIComponent(ticket.id)}`,
                                {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${session.access_token}` },
                                }
                              );
                              const result = await response.json();
                              if (!response.ok) {
                                throw new Error(result.error || '삭제에 실패했습니다.');
                              }
                              loadSupportTickets();
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
                            } finally {
                              setDeletingSystemSupportTicketId(null);
                            }
                          }}
                          className={`inline-flex h-fit flex-shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 ${
                            deletingSystemSupportTicketId === ticket.id ? 'cursor-wait' : 'cursor-pointer'
                          }`}
                        >
                          {deletingSystemSupportTicketId === ticket.id ? (
                            <Loader2 className="h-[14px] w-[14px] animate-spin" />
                          ) : (
                            <Trash2 className="h-[14px] w-[14px]" />
                          )}
                          삭제
                        </button>
                      </div>
                      {ticket.status === 'pending' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTicket(ticket);
                              setTicketAnswer('');
                            }}
                            className="cursor-pointer rounded-md border-none bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white"
                          >
                            답변하기
                          </button>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        {at('written_at')} {new Date(ticket.created_at).toLocaleString('ko-KR')}
                        {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {supportTickets.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>문의가 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* 답변 모달 */}
                {editingTicket && (
                  <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                  onClick={() => setEditingTicket(null)}
                  >
                    <div
                    className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6"
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-4 text-xl font-semibold text-slate-800">
                        {at('submit_answer_btn')}
                      </h3>
                      <div className="mb-4 rounded-lg bg-slate-50 p-3">
                        <div className="mb-1 text-sm font-semibold text-slate-800">
                          {editingTicket.title}
                        </div>
                        <div className="text-[13px] text-slate-500">
                          {editingTicket.content}
                        </div>
                        {editingTicket.answer && (
                          <div className="mt-3 text-xs text-sky-700">
                            <div className="mb-1 font-semibold">첫 답변</div>
                            <div className="whitespace-pre-wrap text-slate-600">{editingTicket.answer}</div>
                          </div>
                        )}
                        {parseMessageThread(editingTicket.message_thread).map((entry, idx) => (
                          <div key={`modal2-${idx}`} className="mt-2.5 text-xs">
                            <div className={`font-semibold ${entry.role === 'group_admin' ? 'text-amber-700' : 'text-sky-700'}`}>
                              {entry.role === 'group_admin' ? '추가 문의' : '시스템 답변'}
                            </div>
                            <div className="whitespace-pre-wrap text-slate-600">{entry.body}</div>
                          </div>
                        ))}
                      </div>
                      <textarea
                        value={ticketAnswer}
                        onChange={(e) => setTicketAnswer(e.target.value)}
                        placeholder={at('placeholder_answer')}
                        className="mb-4 min-h-[200px] w-full rounded-lg border border-slate-200 p-3 text-sm font-inherit"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingTicket(null);
                            setTicketAnswer('');
                          }}
                          className="cursor-pointer rounded-lg border-none bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
                        >
                          {at('cancel_btn')}
                        </button>
                        <button
                          onClick={async () => {
                            if (!ticketAnswer.trim()) {
                              alert(at('answer_content_required'));
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
                                  answer: ticketAnswer.trim(),
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
                          className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
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
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    대시보드 접근 요청 관리 ({accessRequests.filter(r => r.status === 'pending').length}개 대기중)
                  </h2>
                  <button
                    onClick={() => {
                      setShowNewAccessRequestModal(true);
                      setNewAccessRequestGroupId('');
                      setNewAccessRequestReason('');
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    새 접근 요청
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {accessRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-5 ${
                        request.status === 'pending'
                          ? 'border-amber-200 bg-amber-100'
                          : request.status === 'approved'
                            ? 'border-emerald-200 bg-emerald-100'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            {request.groups && (
                              <h3 className="m-0 text-lg font-semibold text-slate-800">
                                {request.groups.name}
                              </h3>
                            )}
                            <span
                              className={`rounded-xl px-3 py-1 text-xs font-semibold text-white ${
                                request.status === 'pending'
                                  ? 'bg-amber-400'
                                  : request.status === 'approved'
                                    ? 'bg-emerald-500'
                                    : request.status === 'rejected'
                                      ? 'bg-red-500'
                                      : 'bg-slate-400'
                              }`}
                            >
                              {request.status === 'pending' ? at('status_pending') : request.status === 'approved' ? at('status_approved') : request.status === 'rejected' ? at('status_rejected') : request.status === 'expired' ? at('status_expired') : at('status_revoked')}
                            </span>
                          </div>
                          <p className="mb-3 mt-0 whitespace-pre-wrap text-sm text-slate-500">
                            {request.reason}
                          </p>
                          {request.status === 'approved' && request.expires_at && (
                            <div className="mb-2 text-sm text-emerald-600">
                              {at('expires_at_label')} {new Date(request.expires_at).toLocaleString('ko-KR')}
                            </div>
                          )}
                          {request.status === 'rejected' && request.rejection_reason && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-100 p-3">
                              <div className="mb-1 text-xs font-semibold text-red-800">
                                {at('rejection_reason_label')}
                              </div>
                              <p className="m-0 text-sm text-slate-800">
                                {request.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="mt-4 flex gap-2">
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
                            className="cursor-pointer rounded-md border-none bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white"
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
                            className="cursor-pointer rounded-md border-none bg-red-500 px-4 py-2 text-[13px] font-semibold text-white"
                          >
{at('reject_btn')}
                            </button>
                        </div>
                      )}
                      {request.status === 'approved' && request.expires_at && new Date(request.expires_at) > new Date() && (
                        <div className="mt-4 flex gap-2">
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
                            className="cursor-pointer rounded-md border-none bg-red-500 px-4 py-2 text-[13px] font-semibold text-white"
                          >
                            {at('revoke_btn')}
                          </button>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                        {request.approved_at && ` | ${at('approved_at_label')} ${new Date(request.approved_at).toLocaleString('ko-KR')}`}
                        {request.rejected_at && ` | ${at('rejected_at_label')} ${new Date(request.rejected_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {accessRequests.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <KeyRound className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{at('no_access_requests')}</p>
                    </div>
                  )}
                </div>

                {/* 새 접근 요청 모달 */}
                {showNewAccessRequestModal && (
                  <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                  onClick={() => {
                    setShowNewAccessRequestModal(false);
                    setNewAccessRequestGroupId('');
                    setNewAccessRequestReason('');
                  }}
                  >
                    <div
                    className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6"
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-4 text-xl font-semibold text-slate-800">
                        새 접근 요청
                      </h3>
                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-semibold text-slate-800">
                          그룹 선택
                        </label>
                        <select
                          value={newAccessRequestGroupId}
                          onChange={(e) => setNewAccessRequestGroupId(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 p-3 text-sm font-inherit"
                        >
                          <option value="">{at('select_group_option')}</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-semibold text-slate-800">
                          요청 이유
                        </label>
                        <textarea
                          value={newAccessRequestReason}
                          onChange={(e) => setNewAccessRequestReason(e.target.value)}
                          placeholder={at('placeholder_reason')}
                          className="min-h-[150px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm font-inherit"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setShowNewAccessRequestModal(false);
                            setNewAccessRequestGroupId('');
                            setNewAccessRequestReason('');
                          }}
                          className="cursor-pointer rounded-lg border-none bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-500"
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
                          className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
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
                <h2 className="mb-6 text-xl font-semibold text-slate-800">
                  관리자 감사 로그
                </h2>
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="text-[13px] text-slate-600">기간</label>
                  <input
                    type="date"
                    value={auditLogFilters.from}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, from: e.target.value }))}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    type="date"
                    value={auditLogFilters.to}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, to: e.target.value }))}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={auditLogFilters.resource_type}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, resource_type: e.target.value }))}
                    className="min-w-[140px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">전체 유형</option>
                    <option value="group">그룹</option>
                    <option value="user">사용자</option>
                    <option value="announcement">공지</option>
                    <option value="dashboard_access_request">접근 요청</option>
                    <option value="support_ticket">문의</option>
                    <option value="member_support_ticket">멤버 문의(그룹)</option>
                    <option value="system_admin">시스템 관리자</option>
                  </select>
                  <input
                    type="text"
                    placeholder={at('placeholder_admin_id')}
                    value={auditLogFilters.admin_id}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, admin_id: e.target.value.trim() }))}
                    className="w-[220px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder={at('placeholder_group_id')}
                    value={auditLogFilters.group_id}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, group_id: e.target.value.trim() }))}
                    className="w-[220px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => loadAuditLogs(1)}
                    disabled={auditLogLoading}
                    className={`inline-flex items-center gap-1.5 rounded-md border-none px-4 py-2 text-sm font-semibold text-white ${
                      auditLogLoading ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'
                    }`}
                  >
                    {auditLogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    조회
                  </button>
                  <button
                    onClick={exportAuditLogsCsv}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    <Download className="h-4 w-4" />
                    CSV 내보내기
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-slate-100">
                        {getAdminAuditHeaders(adminLang).slice(0, 9).map((h, i) => (
                          <th key={i} className="border-b-2 border-slate-200 px-3 py-2.5 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogLoading && auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-500">
                            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                            {at('loading')}
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            {at('no_audit_log')}
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="border-b border-slate-100">
                            <td className="whitespace-nowrap px-3 py-2.5">{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                            <td className="px-3 py-2.5">{log.action}</td>
                            <td className="px-3 py-2.5">{log.resource_type}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{log.resource_id || '-'}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{log.admin_id}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{log.group_id || '-'}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{log.target_user_id || '-'}</td>
                            <td className="max-w-[200px] overflow-hidden text-ellipsis px-3 py-2.5">
                              {log.details ? JSON.stringify(log.details) : '-'}
                            </td>
                            <td className="px-3 py-2.5">{log.ip_address || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {auditLogTotal > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] text-slate-500">
                      총 {auditLogTotal.toLocaleString()}건 ({(auditLogPage - 1) * auditLogLimit + 1}–{Math.min(auditLogPage * auditLogLimit, auditLogTotal)})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadAuditLogs(auditLogPage - 1)}
                        disabled={auditLogPage <= 1 || auditLogLoading}
                        className={`rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] ${
                          auditLogPage <= 1 || auditLogLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        이전
                      </button>
                      <span className="self-center text-[13px] text-slate-600">{auditLogPage} / {Math.ceil(auditLogTotal / auditLogLimit) || 1}</span>
                      <button
                        onClick={() => loadAuditLogs(auditLogPage + 1)}
                        disabled={auditLogPage >= Math.ceil(auditLogTotal / auditLogLimit) || auditLogLoading}
                        className={`rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] ${
                          auditLogPage >= Math.ceil(auditLogTotal / auditLogLimit) || auditLogLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
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
    </div>
  );
}

