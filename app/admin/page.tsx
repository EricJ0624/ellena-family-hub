'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { fetchAuthBootstrapWithCache, getCachedAuthBootstrap } from '@/lib/auth-bootstrap';
import { getValidatedUserWithSessionFallback } from '@/lib/auth-session-resilience';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAdminTranslation, getAdminAuditHeaders, formatAdminTranslation } from '@/lib/translations/admin';
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
  PiggyBank,
  Ban
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GroupAdminPanel } from '@/app/components/group-admin/GroupAdminPanel';
import { GlassSafeModal } from '@/app/components/GlassSafeModal';
import { useGroup } from '@/app/contexts/GroupContext';
import { getAnnouncementTexts } from '@/lib/announcement-i18n';
import { getGroupAdminTranslation } from '@/lib/translations/groupAdmin';
import { LANG_CODES, LANG_OPTIONS, LANG_LABELS, ANNOUNCEMENT_PRIMARY_LANG_CODES, ANNOUNCEMENT_EXTRA_LANG_CODES, isValidLang, intlLocaleForLang, type LangCode } from '@/lib/language-fonts';
import { getCountryDisplayName } from '@/lib/countries';
import { parseMessageThread } from '@/lib/support-ticket-thread';
import { parseMemberSupportMessageThread } from '@/lib/member-support-ticket-thread';
import { getGroupSelectorLabel, getGroupDisplayNameRaw } from '@/lib/group-display-name';
import { FeatureUsageSection } from '@/app/components/admin/FeatureUsageSection';
import { SignupSettingsSection } from '@/app/components/admin/SignupSettingsSection';
import { AdminModerationInbox } from '@/app/components/admin/AdminModerationInbox';
import { AdminSuspendModals, type AdminSuspendTarget } from '@/app/components/admin/AdminSuspendModals';
import { AdminForceLeaveModal, type AdminForceLeaveTarget } from '@/app/components/admin/AdminForceLeaveModal';
import { SystemAdminTransferModal } from '@/app/components/admin/SystemAdminTransferModal';
import { getAdminTransferTranslation } from '@/lib/translations/adminTransfer';
import { getAdminSuspendTranslation } from '@/lib/translations/adminSuspend';
import { brandSystemAdminCopy } from '@/lib/system-admin-brand';
import { userSuspendBadgeKind, type SuspendSummary } from '@/lib/admin-suspend';
import { ALL_APP_IDS, getAppIdBadgeClass, getAppIdLabel, type AppId } from '@/lib/apps';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

interface UserInfo {
  id: string;
  email: string | null;
  nickname: string | null;
  preferred_language: string | null;
  country_code: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  groups_count: number;
  app_ids: string[];
  is_active: boolean;
  recent_30day_login: boolean;
  beta_rank: number | null;
  is_beta_qualified: boolean;
}

type UserSortField =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'last_sign_in_at'
  | 'country_code'
  | 'preferred_language'
  | 'recent_30day'
  | 'beta_rank';

interface GroupInfo {
  id: string;
  name: string;
  app_id?: string | null;
  owner_id?: string;
  invite_code?: string | null;
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
  groupsByApp?: Record<string, number>;
  usersByApp?: Record<string, number>;
  supportTicketsByApp?: Record<string, number>;
  memberTicketsByApp?: Record<string, number>;
  totalSupportTickets?: number;
  totalMemberTickets?: number;
  totalAdmins: number;
  languageDistribution: Record<string, number>;
  countryDistribution: Record<string, number>;
  languageDistributionByApp?: Record<string, Record<string, number>>;
  countryDistributionByApp?: Record<string, Record<string, number>>;
  activeUsersByApp?: Record<string, number>;
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
  /** null/undefined = 전역(모든 앱) */
  app_id?: string | null;
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
  app_id?: string | null;
  groups?: {
    id: string;
    name: string;
    app_id?: string | null;
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
  app_id?: string | null;
  groups?: { id: string; name: string; app_id?: string | null };
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
  app_id?: string | null;
  groups?: {
    id: string;
    name: string;
    app_id?: string | null;
  };
}

const ADMIN_LANG_STORAGE_KEY = 'admin_preferred_language';

function getStoredAdminLang(): LangCode {
  if (typeof window === 'undefined') return 'ko';
  const s = localStorage.getItem(ADMIN_LANG_STORAGE_KEY);
  return isValidLang(s) ? s : 'ko';
}

export default function AdminPage() {
  const router = useRouter();
  const { setCurrentGroupId } = useGroup();
  const [adminLang, setAdminLangState] = useState<LangCode>('ko');
  useLanguage(); // ensure provider is present; admin UI uses adminLang (9 locales)
  useEffect(() => {
    setAdminLangState(getStoredAdminLang());
  }, []);
  const adminLocale = intlLocaleForLang(adminLang);
  const at = (key: keyof import('@/lib/translations/admin').AdminTranslations) => getAdminTranslation(adminLang, key);
  const fat = (
    key: keyof import('@/lib/translations/admin').AdminTranslations,
    vars: Record<string, string | number>,
  ) => formatAdminTranslation(adminLang, key, vars);
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(adminLang, key);
  const gat = (key: keyof import('@/lib/translations/groupAdmin').GroupAdminTranslations) =>
    getGroupAdminTranslation(adminLang, key);
  const st = (key: Parameters<typeof getAdminSuspendTranslation>[1]) =>
    getAdminSuspendTranslation(adminLang, key);
  const adminGroupLabel = (group: { name: string }) =>
    getGroupDisplayNameRaw(group) ?? st('name_pending');
  const setAdminLang = useCallback((lang: LangCode) => {
    setAdminLangState(lang);
    if (typeof window !== 'undefined') localStorage.setItem(ADMIN_LANG_STORAGE_KEY, lang);
  }, []);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'groups' | 'group-admin' | 'announcements' | 'all-support-tickets' | 'member-inquiries' | 'support-tickets' | 'dashboard-access-requests' | 'audit-log'>('dashboard');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [manageableGroups, setManageableGroups] = useState<GroupInfo[]>([]); // 관리 가능한 그룹만 (소유자 또는 ADMIN인 그룹)
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [appFilter, setAppFilter] = useState<'all' | 'global' | AppId>('all');
  const [userSortField, setUserSortField] = useState<UserSortField>('created_at_desc');
  const [showBetaOnly, setShowBetaOnly] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 그룹 관리 관련 상태
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetailInfo | null>(null);

  // 공지사항, 문의, 접근 요청 관련 상태
  const [announcements, setAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketInfo[]>([]);
  const [deletingMemberInquiryId, setDeletingMemberInquiryId] = useState<string | null>(null);
  /** 멤버 문의 예외 단건 조회 폼 */
  const [memberInquiryTicketId, setMemberInquiryTicketId] = useState('');
  const [memberInquiryReasonCode, setMemberInquiryReasonCode] = useState<
    'report' | 'dispute' | 'legal' | 'admin_absent' | 'other'
  >('report');
  const [memberInquiryReason, setMemberInquiryReason] = useState('');
  const [memberInquiryLookup, setMemberInquiryLookup] = useState<MemberGroupInquiryInfo | null>(null);
  const [memberInquiryLookupLoading, setMemberInquiryLookupLoading] = useState(false);
  const [memberInquiryActionError, setMemberInquiryActionError] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<DashboardAccessRequestInfo[]>([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementInfo | null | undefined>(undefined);
  const [editingTicket, setEditingTicket] = useState<SupportTicketInfo | null>(null);
  const [announcementTitleI18n, setAnnouncementTitleI18n] = useState<Record<string, string>>(() => Object.fromEntries(LANG_CODES.map((l) => [l, ''])));
  const [announcementContentI18n, setAnnouncementContentI18n] = useState<Record<string, string>>(() => Object.fromEntries(LANG_CODES.map((l) => [l, ''])));
  const [announcementTarget, setAnnouncementTarget] = useState<'ADMIN_ONLY' | 'ALL_MEMBERS'>('ADMIN_ONLY');
  /** null = 전역 공지 */
  const [announcementAppId, setAnnouncementAppId] = useState<string | null>(null);
  const [announcementLangTab, setAnnouncementLangTab] = useState<LangCode>('ko');
  const [announcementExtraEnabled, setAnnouncementExtraEnabled] = useState<Set<LangCode>>(() => new Set());
  const [announcementExtraExpanded, setAnnouncementExtraExpanded] = useState(false);
  const [ticketAnswer, setTicketAnswer] = useState('');
  const [deletingSystemSupportTicketId, setDeletingSystemSupportTicketId] = useState<string | null>(null);
  const [accessRequestExpiresHours, setAccessRequestExpiresHours] = useState(24);
  const [showNewAccessRequestModal, setShowNewAccessRequestModal] = useState(false);
  const [newAccessRequestGroupId, setNewAccessRequestGroupId] = useState('');
  const [newAccessRequestReason, setNewAccessRequestReason] = useState('');
  
  // 시스템 관리자 관리 관련 상태
  const [systemAdmins, setSystemAdmins] = useState<string[]>([]); // 시스템 관리자 user_id 목록

  // 감사 로그 조회 상태
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    admin_id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    group_id: string | null;
    app_id?: string | null;
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
    app_id: '' as '' | AppId,
  });
  const auditLogLimit = 50;
  const [suspendSummary, setSuspendSummary] = useState<SuspendSummary>({
    userGroupPairs: [],
    groupIds: [],
  });
  const [suspendTarget, setSuspendTarget] = useState<AdminSuspendTarget | null>(null);
  const [forceLeaveTarget, setForceLeaveTarget] = useState<AdminForceLeaveTarget | null>(null);
  const [transferSuccessorId, setTransferSuccessorId] = useState<string | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const resetAnnouncementForm = useCallback(() => {
    setAnnouncementTitleI18n(Object.fromEntries(LANG_CODES.map((l) => [l, ''])));
    setAnnouncementContentI18n(Object.fromEntries(LANG_CODES.map((l) => [l, ''])));
    setAnnouncementTarget('ADMIN_ONLY');
    setAnnouncementAppId(null);
    setAnnouncementLangTab('ko');
    setAnnouncementExtraEnabled(new Set());
    setAnnouncementExtraExpanded(false);
  }, []);

  const openAnnouncementEdit = useCallback((announcement: AnnouncementInfo) => {
    const ti =
      announcement.title_i18n && typeof announcement.title_i18n === 'object'
        ? announcement.title_i18n
        : { ko: announcement.title };
    const ci =
      announcement.content_i18n && typeof announcement.content_i18n === 'object'
        ? announcement.content_i18n
        : { ko: announcement.content };
    setAnnouncementTitleI18n(Object.fromEntries(LANG_CODES.map((l) => [l, ti[l] ?? ''])));
    setAnnouncementContentI18n(Object.fromEntries(LANG_CODES.map((l) => [l, ci[l] ?? ''])));
    setAnnouncementTarget(announcement.target || 'ADMIN_ONLY');
    setAnnouncementAppId(announcement.app_id ?? null);
    setAnnouncementLangTab('ko');
    const extra = new Set<LangCode>();
    for (const l of ANNOUNCEMENT_EXTRA_LANG_CODES) {
      if ((ti[l] ?? '').trim() || (ci[l] ?? '').trim()) extra.add(l);
    }
    setAnnouncementExtraEnabled(extra);
    setAnnouncementExtraExpanded(extra.size > 0);
  }, []);

  const toggleAnnouncementExtraLang = useCallback((l: LangCode) => {
    setAnnouncementExtraEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(l)) {
        next.delete(l);
        setAnnouncementLangTab((tab) => (tab === l ? 'ko' : tab));
      } else {
        next.add(l);
        setAnnouncementLangTab(l);
        setAnnouncementExtraExpanded(true);
      }
      return next;
    });
  }, []);

  const showAnnouncementEditor =
    ANNOUNCEMENT_PRIMARY_LANG_CODES.includes(announcementLangTab) ||
    announcementExtraEnabled.has(announcementLangTab);

  const announcementExtraSectionLabel =
    adminLang === 'ko' ? '추가 언어 (선택)' : 'Additional languages (optional)';
  const announcementExtraHint =
    adminLang === 'ko'
      ? '필요한 언어만 선택한 뒤 번역문을 붙여넣을 수 있습니다.'
      : 'Select only the languages you need and paste translated text.';

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

  // 관리자 권한 확인 — bootstrap으로 이미 관리자면 즉시 진입, RPC는 백그라운드 검증
  useEffect(() => {
    let cancelled = false;

    const authorize = (userId: string) => {
      if (cancelled) return;
      setCurrentAdminUserId(userId);
      setIsAuthorized(true);
      setLoading(false);
    };

    const deny = () => {
      if (cancelled) return;
      setLoading(false);
      router.replace('/dashboard');
    };

    const checkAdmin = async () => {
      try {
        const session = await waitForSupabaseSession(supabase, { maxWaitMs: 4000 });
        if (!session?.access_token) {
          deny();
          return;
        }

        const { user } = await getValidatedUserWithSessionFallback(supabase, session);
        if (!user) {
          deny();
          return;
        }

        // 1) 캐시/bootstrap이 관리자면 즉시 UI 진입 (RPC 대기하지 않음)
        const cached = getCachedAuthBootstrap(user.id);
        if (cached?.isSystemAdmin) {
          authorize(user.id);
          void (async () => {
            try {
              await supabase.rpc('update_admin_last_access');
            } catch {
              // ignore
            }
          })();
          // 백그라운드 확인 — 실패해도 캐시 신뢰 유지(대시보드와 동일 소스)
          void supabase.rpc('is_system_admin', { user_id_param: user.id }).then(({ data, error }) => {
            if (error || cancelled) return;
            if (data !== true) {
              console.warn('[admin] RPC가 관리자 아님을 반환 — bootstrap 캐시와 불일치');
            }
          });
          return;
        }

        const bootstrap = await fetchAuthBootstrapWithCache(session.access_token, user.id);
        if (cancelled) return;
        if (bootstrap?.isSystemAdmin) {
          authorize(user.id);
          void (async () => {
            try {
              await supabase.rpc('update_admin_last_access');
            } catch {
              // ignore
            }
          })();
          return;
        }

        // 2) 캐시 없을 때만 RPC로 판정 (짧게 1~2회)
        let rpcAdmin = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 300));
          const { data, error: adminError } = await supabase.rpc('is_system_admin', {
            user_id_param: user.id,
          });
          if (!adminError && data === true) {
            rpcAdmin = true;
            break;
          }
          if (adminError) {
            console.error('관리자 권한 확인 오류:', adminError);
          }
        }

        if (cancelled) return;
        if (!rpcAdmin) {
          deny();
          return;
        }

        authorize(user.id);
        void (async () => {
          try {
            await supabase.rpc('update_admin_last_access');
          } catch {
            // ignore
          }
        })();
      } catch (err) {
        console.error('관리자 권한 확인 오류:', err);
        deny();
      }
    };

    void checkAdmin();
    return () => {
      cancelled = true;
    };
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

      const session = await waitForSupabaseSession(supabase);
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
        totalSupportTickets: Number(result?.data?.totalSupportTickets || 0),
        totalMemberTickets: Number(result?.data?.totalMemberTickets || 0),
        languageDistribution: result?.data?.languageDistribution || {},
        countryDistribution: result?.data?.countryDistribution || {},
        languageDistributionByApp: result?.data?.languageDistributionByApp || {},
        countryDistributionByApp: result?.data?.countryDistributionByApp || {},
        activeUsersByApp: result?.data?.activeUsersByApp || {},
        groupsByApp: result?.data?.groupsByApp || {},
        usersByApp: result?.data?.usersByApp || {},
        supportTicketsByApp: result?.data?.supportTicketsByApp || {},
        memberTicketsByApp: result?.data?.memberTicketsByApp || {},
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
        preferred_language: user.preferred_language ?? null,
        country_code: user.country_code ?? null,
        created_at: user.created_at || new Date().toISOString(),
        last_sign_in_at: user.last_sign_in_at ?? null,
        groups_count: user.groups_count || 0,
        app_ids: Array.isArray(user.app_ids) ? user.app_ids : [],
        is_active: user.is_active !== false,
        recent_30day_login: user.recent_30day_login === true,
        beta_rank: user.beta_rank ?? null,
        is_beta_qualified: user.is_beta_qualified === true,
      }));

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

  // 시스템 관리자 콘솔: 전 앱 그룹을 관리 대상으로 사용 (대시보드 그룹 접속 격리와 별개)
  const loadManageableGroups = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setManageableGroups([]);
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
      setManageableGroups(result.data || []);
    } catch (err: any) {
      console.error('관리 가능한 그룹 로드 오류:', err);
      setManageableGroups([]);
    }
  }, []);

  // 선택된 그룹 정보 로드 (시스템 관리자: service role API로 전 앱 허용 — 클라이언트 RLS 우회)
  const loadSelectedGroup = useCallback(async (groupId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(at('error_auth'));
        setSelectedGroup(null);
        setSelectedGroupId(null);
        return;
      }

      const fromCache =
        groups.find((g) => g.id === groupId) ||
        manageableGroups.find((g) => g.id === groupId);

      let groupRow = fromCache;
      if (!groupRow?.owner_id) {
        const response = await fetch('/api/admin/group-storage', {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || at('error_groups'));
        }
        const list: GroupInfo[] = result.data || [];
        setManageableGroups(list);
        groupRow = list.find((g) => g.id === groupId);
      }

      if (!groupRow || !groupRow.owner_id) {
        setError(at('error_no_permission'));
        setSelectedGroup(null);
        setSelectedGroupId(null);
        return;
      }

      setSelectedGroup({
        id: groupRow.id,
        name: groupRow.name,
        owner_id: groupRow.owner_id,
        owner_email: groupRow.owner_email,
        created_at: groupRow.created_at,
        invite_code: groupRow.invite_code ?? null,
      });
      setError(null);

      fetch('/api/admin/audit/dashboard-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ group_id: groupId }),
      }).catch(() => {});
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

  const loadSuspendSummary = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch('/api/admin/suspend', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.data) return;
      setSuspendSummary({
        userGroupPairs: Array.isArray(result.data.userGroupPairs) ? result.data.userGroupPairs : [],
        groupIds: Array.isArray(result.data.groupIds) ? result.data.groupIds : [],
      });
    } catch (err) {
      console.error('정지 현황 로드 오류:', err);
    }
  }, []);

  const suspendedGroupIds = useMemo(() => new Set(suspendSummary.groupIds), [suspendSummary.groupIds]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (!isAuthorized) return;

    if (activeTab === 'dashboard') {
      loadStats();
      // loadStats와 loadingData를 공유하면 먼저 끝난 쪽이 스피너를 끄고 stats=null인 빈 화면이 잠깐/계속 보일 수 있음
      loadAllSupportTickets({ skipLoadingGate: true });
    } else if (activeTab === 'users') {
      loadUsers();
      loadSuspendSummary();
    } else if (activeTab === 'groups') {
      loadGroups(); // 모든 그룹 조회 (그룹 목록 탭용)
      loadManageableGroups(); // 관리 가능한 그룹 조회 (관리하기 버튼용)
      loadSuspendSummary();
    } else if (activeTab === 'group-admin' && selectedGroupId) {
      /* GroupAdminPanel이 탭별 데이터를 자체 로드 */
    } else if (activeTab === 'announcements') {
      loadAnnouncements();
    } else if (activeTab === 'all-support-tickets') {
      loadAllSupportTickets();
    } else if (activeTab === 'member-inquiries') {
      setLoadingData(false);
      setError(null);
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
  const loadAllSupportTickets = useCallback(async (options?: { skipLoadingGate?: boolean }) => {
    const manageLoading = !options?.skipLoadingGate;
    try {
      if (manageLoading) {
        setLoadingData(true);
        setError(null);
      }

      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) {
        if (manageLoading) {
          setError(at('error_session_expired'));
          setLoadingData(false);
        }
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
      if (manageLoading) {
        setLoadingData(false);
      }
    }
  }, [at]);

  const lookupMemberInquiryException = useCallback(async () => {
    setMemberInquiryActionError(null);
    const ticketId = memberInquiryTicketId.trim();
    const reason = memberInquiryReason.trim();
    if (!ticketId) {
      setMemberInquiryActionError(adminLang === 'ko' ? '문의 ID를 입력해 주세요.' : 'Enter a ticket ID.');
      return;
    }
    if (reason.length < 10) {
      setMemberInquiryActionError(
        adminLang === 'ko' ? '접근 사유를 10자 이상 입력해 주세요.' : 'Enter a reason (at least 10 characters).'
      );
      return;
    }
    try {
      setMemberInquiryLookupLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMemberInquiryActionError(at('error_session_expired'));
        return;
      }
      const response = await fetch('/api/admin/member-support-tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          reason_code: memberInquiryReasonCode,
          reason,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMemberInquiryLookup(null);
        setMemberInquiryActionError(
          typeof result.error === 'string' ? result.error : at('error_member_inquiries')
        );
        return;
      }
      setMemberInquiryLookup(result.data || null);
    } catch (err) {
      console.error('멤버 문의 예외 조회 오류:', err);
      setMemberInquiryLookup(null);
      setMemberInquiryActionError(at('error_member_inquiries'));
    } finally {
      setMemberInquiryLookupLoading(false);
    }
  }, [adminLang, at, memberInquiryReason, memberInquiryReasonCode, memberInquiryTicketId]);

  const deleteMemberInquiryException = useCallback(async () => {
    if (!memberInquiryLookup) return;
    setMemberInquiryActionError(null);
    const reason = memberInquiryReason.trim();
    if (reason.length < 10) {
      setMemberInquiryActionError(
        adminLang === 'ko' ? '삭제 사유를 10자 이상 입력해 주세요.' : 'Enter a delete reason (at least 10 characters).'
      );
      return;
    }
    if (
      !confirm(
        adminLang === 'ko'
          ? '이 멤버 문의를 예외 삭제할까요? 사유와 함께 감사 로그에 기록됩니다.'
          : 'Delete this member inquiry as an exception? Reason will be audit-logged.'
      )
    ) {
      return;
    }
    try {
      setDeletingMemberInquiryId(memberInquiryLookup.id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMemberInquiryActionError(at('error_session_expired'));
        return;
      }
      const response = await fetch('/api/admin/member-support-tickets', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: memberInquiryLookup.id,
          reason_code: memberInquiryReasonCode,
          reason,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMemberInquiryActionError(
          typeof result.error === 'string' ? result.error : at('error_member_inquiries')
        );
        return;
      }
      setMemberInquiryLookup(null);
      alert(adminLang === 'ko' ? '삭제되었습니다. 감사 로그에 기록되었습니다.' : 'Deleted and audit-logged.');
    } catch (err) {
      console.error('멤버 문의 예외 삭제 오류:', err);
      setMemberInquiryActionError(at('error_member_inquiries'));
    } finally {
      setDeletingMemberInquiryId(null);
    }
  }, [
    adminLang,
    at,
    memberInquiryLookup,
    memberInquiryReason,
    memberInquiryReasonCode,
  ]);

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
      if (auditLogFilters.app_id) params.set('app_id', auditLogFilters.app_id);

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
      if (auditLogFilters.app_id) params.set('app_id', auditLogFilters.app_id);

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

  // 검색 필터링 + 정렬
  const filteredUsers = useMemo(() => {
    let list = users.filter((user) => {
      if (appFilter !== 'all' && appFilter !== 'global' && !(user.app_ids || []).includes(appFilter)) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !user.email?.toLowerCase().includes(q) &&
          !user.nickname?.toLowerCase().includes(q) &&
          !user.id.toLowerCase().includes(q) &&
          !user.preferred_language?.toLowerCase().includes(q) &&
          !user.country_code?.toLowerCase().includes(q) &&
          !(user.app_ids || []).some((id) => getAppIdLabel(id).toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      if (showBetaOnly && !user.is_beta_qualified) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (userSortField) {
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_at_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'last_sign_in_at': {
          if (!a.last_sign_in_at && !b.last_sign_in_at) return 0;
          if (!a.last_sign_in_at) return 1;
          if (!b.last_sign_in_at) return -1;
          return new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime();
        }
        case 'country_code':
          return (a.country_code ?? '').localeCompare(b.country_code ?? '');
        case 'preferred_language':
          return (a.preferred_language ?? '').localeCompare(b.preferred_language ?? '');
        case 'recent_30day':
          return (b.recent_30day_login ? 1 : 0) - (a.recent_30day_login ? 1 : 0);
        case 'beta_rank': {
          if (a.beta_rank === null && b.beta_rank === null) return 0;
          if (a.beta_rank === null) return 1;
          if (b.beta_rank === null) return -1;
          return a.beta_rank - b.beta_rank;
        }
        default:
          return 0;
      }
    });

    return list;
  }, [users, searchQuery, showBetaOnly, userSortField, appFilter]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      if (appFilter !== 'all' && appFilter !== 'global' && group.app_id !== appFilter) return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        group.name.toLowerCase().includes(query) ||
        adminGroupLabel(group).toLowerCase().includes(query) ||
        group.owner_email?.toLowerCase().includes(query) ||
        group.id.toLowerCase().includes(query) ||
        getAppIdLabel(group.app_id).toLowerCase().includes(query)
      );
    });
  }, [groups, searchQuery, appFilter, adminGroupLabel]);

  /** 그룹 목록을 앱별 섹션으로 묶음 (필터 적용 후) */
  const groupsByAppSections = useMemo(() => {
    const known = new Set<string>(ALL_APP_IDS);
    const sections = ALL_APP_IDS.map((appId) => ({
      appId: appId as string,
      label: getAppIdLabel(appId),
      groups: filteredGroups.filter((g) => g.app_id === appId),
    })).filter((s) => s.groups.length > 0);

    const other = filteredGroups.filter((g) => !g.app_id || !known.has(g.app_id));
    if (other.length > 0) {
      sections.push({
        appId: 'unknown',
        label: adminLang === 'ko' ? '기타/미분류' : 'Other',
        groups: other,
      });
    }
    return sections;
  }, [filteredGroups, adminLang]);

  const filteredManageableGroups = useMemo(() => {
    return manageableGroups.filter((group) => {
      if (appFilter !== 'all' && appFilter !== 'global' && group.app_id !== appFilter) return false;
      return true;
    });
  }, [manageableGroups, appFilter]);

  const matchesScopedApp = useCallback(
    (appId: string | null | undefined) => {
      if (appFilter === 'all') return true;
      if (appFilter === 'global') return !appId;
      return appId === appFilter;
    },
    [appFilter]
  );

  const filteredAnnouncements = useMemo(
    () => announcements.filter((a) => matchesScopedApp(a.app_id)),
    [announcements, matchesScopedApp]
  );

  const filteredSupportTickets = useMemo(
    () =>
      supportTickets.filter((t) =>
        matchesScopedApp(t.app_id ?? t.groups?.app_id ?? null)
      ),
    [supportTickets, matchesScopedApp]
  );

  const filteredAccessRequests = useMemo(
    () =>
      accessRequests.filter((r) =>
        matchesScopedApp(r.app_id ?? r.groups?.app_id ?? null)
      ),
    [accessRequests, matchesScopedApp]
  );

  const statsForFilter = useMemo(() => {
    if (!stats) return null;
    if (appFilter === 'all' || appFilter === 'global') {
      return {
        users: stats.totalUsers,
        groups: stats.totalGroups,
        activeUsers: stats.activeUsers,
        supportTickets: stats.totalSupportTickets || 0,
        memberTickets: stats.totalMemberTickets || 0,
        languageDistribution: stats.languageDistribution,
        countryDistribution: stats.countryDistribution,
      };
    }
    return {
      users: stats.usersByApp?.[appFilter] || 0,
      groups: stats.groupsByApp?.[appFilter] || 0,
      activeUsers: stats.activeUsersByApp?.[appFilter] || 0,
      supportTickets: stats.supportTicketsByApp?.[appFilter] || 0,
      memberTickets: stats.memberTicketsByApp?.[appFilter] || 0,
      languageDistribution: stats.languageDistributionByApp?.[appFilter] || {},
      countryDistribution: stats.countryDistributionByApp?.[appFilter] || {},
    };
  }, [stats, appFilter]);

  const recentSupportTickets = useMemo(
    () => filteredSupportTickets.slice(0, 5),
    [filteredSupportTickets]
  );

  const pendingSupportTicketCount = useMemo(
    () => filteredSupportTickets.filter((t) => t.status === 'pending').length,
    [filteredSupportTickets]
  );

  // 그룹 관리 탭으로 전환 (시스템 관리자: 전 앱 그룹)
  const handleSelectGroupForAdmin = async (groupId: string) => {
    const exists = groups.some((g) => g.id === groupId) || manageableGroups.some((mg) => mg.id === groupId);
    if (!exists) {
      alert(at('error_no_permission'));
      return;
    }

    setSelectedGroupId(groupId);
    setActiveTab('group-admin');
    // 그룹 정보 로드 (권한 검증 포함)
    await loadSelectedGroup(groupId);
  };

  const renderAppFilterChips = (includeGlobal = false) => (
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setAppFilter('all')}
        className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
          appFilter === 'all'
            ? 'border-purple-600 bg-purple-600 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        {at('filter_all')}
      </button>
      {includeGlobal && (
        <button
          type="button"
          onClick={() => setAppFilter('global')}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
            appFilter === 'global'
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {adminLang === 'ko' ? '전역' : 'Global'}
        </button>
      )}
      {ALL_APP_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setAppFilter(id)}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
            appFilter === id
              ? 'border-slate-800 bg-slate-800 text-white'
              : `border-transparent ${getAppIdBadgeClass(id)} hover:opacity-90`
          }`}
        >
          {getAppIdLabel(id)}
        </button>
      ))}
    </div>
  );

  const renderAppBadge = (appId: string | null | undefined, globalLabel = true) => {
    if (!appId) {
      if (!globalLabel) return null;
      return (
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
          {adminLang === 'ko' ? '전역' : 'Global'}
        </span>
      );
    }
    return (
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${getAppIdBadgeClass(appId)}`}>
        {getAppIdLabel(appId)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
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
      className="admin-page min-h-screen w-full max-w-full overflow-x-hidden bg-[var(--surface-base)] p-5"
    >
      {/* 헤더 */}
      <div
        className="admin-header glass-panel mb-6 rounded-xl p-6"
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
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 hover:underline">
                {adminLang === 'ko' ? '이용약관' : 'Terms'}
              </Link>
              <span aria-hidden>|</span>
              <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 hover:underline">
                {adminLang === 'ko' ? '개인정보 처리방침' : 'Privacy'}
              </Link>
            </div>
            <label className="sr-only" htmlFor="admin-lang-select">
              Language
            </label>
            <select
              id="admin-lang-select"
              value={adminLang}
              onChange={(e) => setAdminLang(e.target.value as LangCode)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
            >
              {LANG_OPTIONS.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex cursor-pointer items-center gap-2 rounded-lg border-none bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70"
            >
              <X className="h-4 w-4" />
              {ct('close')}
            </button>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div
          className="admin-tabs flex max-w-full flex-wrap gap-1 overflow-x-auto border-b-2 border-slate-200 sm:gap-2"
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
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
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
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
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
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
            className={`border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
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
            className={`cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
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
            className={`relative cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
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
            className={`relative cursor-pointer border-none border-b-[3px] bg-transparent px-6 py-3 text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
              activeTab === 'member-inquiries'
                ? 'border-purple-600 font-semibold text-purple-600'
                : 'border-transparent font-medium text-slate-500'
            }`}
          >
            <MessageSquare className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {at('tab_member_inquiries')}
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
        className="admin-content glass-panel rounded-xl p-6"
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
                <h2 className="mb-4 text-xl font-semibold text-slate-800">
                  {at('system_stats')}
                </h2>
                {renderAppFilterChips(false)}
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
                      {appFilter !== 'all' && appFilter !== 'global' ? ` (${getAppIdLabel(appFilter)})` : ''}
                    </div>
                    <div className="text-[32px] font-bold text-sky-900">
                      {(statsForFilter?.users ?? stats.totalUsers).toLocaleString()}
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
                      {appFilter !== 'all' && appFilter !== 'global' ? ` (${getAppIdLabel(appFilter)})` : ''}
                    </div>
                    <div className="text-[32px] font-bold text-amber-900">
                      {(statsForFilter?.activeUsers ?? stats.activeUsers).toLocaleString()}
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
                      {appFilter !== 'all' && appFilter !== 'global' ? ` (${getAppIdLabel(appFilter)})` : ''}
                    </div>
                    <div className="text-[32px] font-bold text-purple-900">
                      {(statsForFilter?.groups ?? stats.totalGroups).toLocaleString()}
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

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="rounded-xl border border-orange-200 bg-orange-50 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-orange-800">
                      {adminLang === 'ko' ? '전체 문의' : 'Support tickets'}
                    </div>
                    <div className="text-[32px] font-bold text-orange-900">
                      {(statsForFilter?.supportTickets ?? 0).toLocaleString()}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="rounded-xl border border-teal-200 bg-teal-50 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-teal-800">
                      {adminLang === 'ko' ? '멤버 문의' : 'Member inquiries'}
                    </div>
                    <div className="text-[32px] font-bold text-teal-900">
                      {(statsForFilter?.memberTickets ?? 0).toLocaleString()}
                    </div>
                  </motion.div>
                </div>

                {stats.groupsByApp && Object.keys(stats.groupsByApp).length > 0 && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="mb-4 text-base font-semibold text-slate-800">
                      {adminLang === 'ko' ? '앱별 요약' : 'By app'}
                    </h3>
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                      {ALL_APP_IDS.map((appId) => (
                        <li
                          key={appId}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                          <span className={`rounded px-2 py-0.5 text-[12px] font-bold ${getAppIdBadgeClass(appId)}`}>
                            {getAppIdLabel(appId)}
                          </span>
                          <span>{adminLang === 'ko' ? '그룹' : 'Groups'}: <strong>{(stats.groupsByApp?.[appId] || 0).toLocaleString()}</strong></span>
                          <span>{adminLang === 'ko' ? '유저' : 'Users'}: <strong>{(stats.usersByApp?.[appId] || 0).toLocaleString()}</strong></span>
                          <span>{adminLang === 'ko' ? '활성(30일)' : 'Active(30d)'}: <strong>{(stats.activeUsersByApp?.[appId] || 0).toLocaleString()}</strong></span>
                          <span>{adminLang === 'ko' ? '문의' : 'Tickets'}: <strong>{(stats.supportTicketsByApp?.[appId] || 0).toLocaleString()}</strong></span>
                          <span>{adminLang === 'ko' ? '멤버문의' : 'Member'}: <strong>{(stats.memberTicketsByApp?.[appId] || 0).toLocaleString()}</strong></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <SignupSettingsSection lang={adminLang} />

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="mb-4 text-base font-semibold text-slate-800">
                      {at('stats_language_distribution')}
                      {appFilter !== 'all' && appFilter !== 'global' ? ` (${getAppIdLabel(appFilter)})` : ''}
                    </h3>
                    {appFilter === 'all' || appFilter === 'global' ? (
                      <div className="flex flex-col gap-4">
                        {ALL_APP_IDS.map((appId) => {
                          const dist = stats.languageDistributionByApp?.[appId] || {};
                          const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
                          return (
                            <div key={appId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <div className="mb-2">
                                <span className={`rounded px-2 py-0.5 text-[12px] font-bold ${getAppIdBadgeClass(appId)}`}>
                                  {getAppIdLabel(appId)}
                                </span>
                              </div>
                              {entries.length === 0 ? (
                                <p className="m-0 text-xs text-slate-400">—</p>
                              ) : (
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                  {entries.map(([code, count]) => (
                                    <li key={code} className="flex items-center justify-between text-sm text-slate-700">
                                      <span>{isValidLang(code) ? (LANG_LABELS[code] || code) : code}</span>
                                      <span className="font-semibold">{count}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {Object.entries(statsForFilter?.languageDistribution ?? {})
                          .sort((a, b) => b[1] - a[1])
                          .map(([code, count]) => (
                            <li key={code} className="flex items-center justify-between text-sm text-slate-700">
                              <span>{isValidLang(code) ? (LANG_LABELS[code] || code) : code}</span>
                              <span className="font-semibold">{count}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="mb-4 text-base font-semibold text-slate-800">
                      {at('stats_country_distribution')}
                      {appFilter !== 'all' && appFilter !== 'global' ? ` (${getAppIdLabel(appFilter)})` : ''}
                    </h3>
                    {appFilter === 'all' || appFilter === 'global' ? (
                      <div className="flex flex-col gap-4">
                        {ALL_APP_IDS.map((appId) => {
                          const dist = stats.countryDistributionByApp?.[appId] || {};
                          const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
                          return (
                            <div key={appId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <div className="mb-2">
                                <span className={`rounded px-2 py-0.5 text-[12px] font-bold ${getAppIdBadgeClass(appId)}`}>
                                  {getAppIdLabel(appId)}
                                </span>
                              </div>
                              {entries.length === 0 ? (
                                <p className="m-0 text-xs text-slate-400">—</p>
                              ) : (
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                  {entries.map(([code, count]) => (
                                    <li key={code} className="flex items-center justify-between text-sm text-slate-700">
                                      <span>
                                        {code === 'unknown'
                                          ? adminLang === 'ko'
                                            ? '미설정'
                                            : 'Unset'
                                          : getCountryDisplayName(code, adminLocale)}
                                      </span>
                                      <span className="font-semibold">{count}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <ul className="m-0 flex max-h-64 list-none flex-col gap-2 overflow-y-auto p-0">
                        {Object.entries(statsForFilter?.countryDistribution ?? {})
                          .sort((a, b) => b[1] - a[1])
                          .map(([code, count]) => (
                            <li key={code} className="flex items-center justify-between text-sm text-slate-700">
                              <span>{getCountryDisplayName(code, adminLocale)}</span>
                              <span className="font-semibold">{count}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>

                <FeatureUsageSection lang={adminLang} appFilter={appFilter} />
                <AdminModerationInbox lang={adminLang} appFilter={appFilter} />

                {/* 최근 문의 위젯 */}
                <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="mb-1 text-base font-semibold text-slate-800">
                        {at('recent_inquiries_title')}
                      </div>
                      <div className={`text-[13px] ${pendingSupportTicketCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {fat('pending_inquiries_count', {
                          count: pendingSupportTicketCount,
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('all-support-tickets')}
                      className="cursor-pointer rounded-md border-none bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                    >
                      {at('view_all_btn')}
                    </button>
                  </div>
                  {recentSupportTickets.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      {at('no_inquiries')}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {recentSupportTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
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
                            {renderAppBadge(ticket.app_id ?? ticket.groups?.app_id, false)}
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">
                              {ticket.groups?.name || ct('unknown')}
                            </span>
                            <span>•</span>
                            <span>{new Date(ticket.created_at).toLocaleDateString(adminLocale)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 가족 생성/가입 기능 버튼 */}
                <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
                  <div className="mb-3 text-base font-semibold text-slate-800">
                    {at('family_onboarding_section_title')}
                  </div>
                  <div className="mb-4 text-sm text-slate-500">
                    {at('users_empty_hint')}
                  </div>
                  <button
                    onClick={() => router.push('/onboarding?from=admin')}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_4px_rgba(147,51,234,0.2)] transition-all duration-200 hover:bg-purple-700 hover:shadow-[0_4px_8px_rgba(147,51,234,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                  >
                    <UserPlus className="h-[18px] w-[18px]" />
                    {at('family_onboarding_btn')}
                  </button>
                </div>
              </div>
            )}

            {/* 회원 관리 탭 */}
            {activeTab === 'users' && (
              <div>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    {fat('user_list_count_title', { count: filteredUsers.length })}
                  </h2>
                  <div className="admin-search relative w-[300px] max-w-full">
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

                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAppFilter('all')}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
                      appFilter === 'all'
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {at('filter_all')}
                  </button>
                  {ALL_APP_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAppFilter(id)}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
                        appFilter === id
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : `border-transparent ${getAppIdBadgeClass(id)} hover:opacity-90`
                      }`}
                    >
                      {getAppIdLabel(id)}
                    </button>
                  ))}
                </div>

                {/* 정렬 컨트롤 + 베타 필터 */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                    {adminLang === 'ko' ? '정렬:' : 'Sort:'}
                    <select
                      value={userSortField}
                      onChange={(e) => setUserSortField(e.target.value as UserSortField)}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                    >
                      <option value="created_at_desc">{adminLang === 'ko' ? '가입일 최신순' : 'Newest signup'}</option>
                      <option value="created_at_asc">{adminLang === 'ko' ? '가입일 오래된순' : 'Oldest signup'}</option>
                      <option value="last_sign_in_at">{adminLang === 'ko' ? '최근 로그인' : 'Last login'}</option>
                      <option value="country_code">{adminLang === 'ko' ? '거주지' : 'Country'}</option>
                      <option value="preferred_language">{adminLang === 'ko' ? '언어' : 'Language'}</option>
                      <option value="recent_30day">{adminLang === 'ko' ? '최근 30일 접속' : 'Active (30d)'}</option>
                      <option value="beta_rank">{adminLang === 'ko' ? '베타 순번' : 'Beta rank'}</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowBetaOnly((v) => !v)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
                      showBetaOnly
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🎯 {adminLang === 'ko' ? '베타 자격자만' : 'Beta only'}
                    {showBetaOnly && (
                      <span className="ml-1 rounded bg-white/30 px-1 text-[11px]">
                        {filteredUsers.length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-50">
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {adminLang === 'ko' ? '베타' : 'Beta'}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {at('email')}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {adminLang === 'ko' ? '앱 소속' : 'Apps'}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {at('nickname')}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {at('col_preferred_language')}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {at('col_country_code')}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {at('joined_at')}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {adminLang === 'ko' ? '최근 로그인' : 'Last login'}
                        </th>
                        <th className="p-3 text-left text-sm font-semibold text-slate-600">
                          {at('groups_count_header')}
                        </th>
                        <th className="p-3 text-center text-sm font-semibold text-slate-600">
                          {at('role')}
                        </th>
                        <th className="p-3 text-right text-sm font-semibold text-slate-600">
                          {at('actions')}
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
                          {/* 베타 순번 셀 */}
                          <td className="p-3">
                            {user.beta_rank !== null && user.beta_rank <= 100 ? (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[12px] font-bold text-purple-700">
                                #{user.beta_rank}
                              </span>
                            ) : user.beta_rank !== null ? (
                              <span className="text-[12px] text-slate-400">#{user.beta_rank}</span>
                            ) : (
                              <span className="text-[12px] text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-slate-800">
                            {user.email || '-'}
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            <div className="flex flex-wrap gap-1">
                              {(user.app_ids || []).length === 0 ? (
                                <span className="text-[12px] text-slate-300">
                                  {adminLang === 'ko' ? '미소속' : 'None'}
                                </span>
                              ) : (
                                (user.app_ids || []).map((id) => (
                                  <span
                                    key={id}
                                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${getAppIdBadgeClass(id)}`}
                                  >
                                    {getAppIdLabel(id)}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-slate-800">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{user.nickname || '-'}</span>
                              {(() => {
                                const kind = userSuspendBadgeKind(
                                  user.id,
                                  user.groups_count,
                                  suspendSummary.userGroupPairs,
                                );
                                if (kind === 'none') return null;
                                return (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                      kind === 'all'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {kind === 'all' ? st('badge_suspended') : st('badge_partial')}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            {user.preferred_language && isValidLang(user.preferred_language)
                              ? LANG_LABELS[user.preferred_language]
                              : user.preferred_language || '-'}
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            {user.country_code
                              ? getCountryDisplayName(user.country_code, adminLocale)
                              : '-'}
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            {new Date(user.created_at).toLocaleDateString(adminLocale)}
                          </td>
                          {/* 최근 로그인 */}
                          <td className="p-3 text-sm text-slate-500">
                            <div className="flex flex-col gap-0.5">
                              <span>
                                {user.last_sign_in_at
                                  ? new Date(user.last_sign_in_at).toLocaleDateString(adminLocale)
                                  : '-'}
                              </span>
                              {user.recent_30day_login && (
                                <span className="w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  {adminLang === 'ko' ? '30일 이내' : '30d active'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            {fat('count_suffix', { count: user.groups_count })}
                          </td>
                          <td className="p-3 text-center">
                            {systemAdmins.includes(user.id) || user.id === currentAdminUserId ? (
                              <span className="rounded-xl bg-purple-700 px-3 py-1 text-xs font-semibold text-white">
                                {at('role_system_admin_badge')}
                              </span>
                            ) : (
                              <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                {at('role_regular_user')}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {/* 시스템 관리자 승격/해제 버튼 */}
                              {systemAdmins.includes(user.id) || user.id === currentAdminUserId ? (
                                <button
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                                  onClick={() => {
                                    setTransferSuccessorId(null);
                                    setTransferModalOpen(true);
                                  }}
                                >
                                  <Shield className="h-4 w-4" />
                                  {at('revoke_admin_btn')}
                                </button>
                              ) : (
                                <button
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-purple-700 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                                  onClick={() => {
                                    setTransferSuccessorId(user.id);
                                    setTransferModalOpen(true);
                                  }}
                                >
                                  <Shield className="h-4 w-4" />
                                  {at('promote_admin_btn')}
                                </button>
                              )}
                              
                              {/* {at('force_leave_btn')} 버튼 */}
                              {(() => {
                                const isTargetSysAdmin =
                                  systemAdmins.includes(user.id) || user.id === currentAdminUserId;
                                const userSuspended =
                                  userSuspendBadgeKind(
                                    user.id,
                                    user.groups_count,
                                    suspendSummary.userGroupPairs,
                                  ) !== 'none';
                                if (isTargetSysAdmin && !userSuspended) return null;
                                return (
                              <button
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ${
                                userSuspended
                                  ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400/70'
                                  : 'bg-orange-600 hover:bg-orange-700 focus-visible:ring-orange-400/70'
                              } focus-visible:outline-none focus-visible:ring-2`}
                              onClick={() => {
                                setSuspendTarget({
                                  kind: 'user',
                                  userId: user.id,
                                  displayName: user.nickname || user.email || at('user_fallback'),
                                  currentlySuspended: userSuspended,
                                });
                              }}
                              >
                                <Ban className="h-[14px] w-[14px]" />
                                {userSuspended ? st('unsuspend_btn') : st('suspend_btn')}
                              </button>
                                );
                              })()}
                              {!systemAdmins.includes(user.id) && user.id !== currentAdminUserId && (
                              <button
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                              onClick={() => {
                                setForceLeaveTarget({
                                  userId: user.id,
                                  displayName: user.email || user.nickname || at('user_fallback'),
                                });
                              }}
                            >
                              <UserX className="h-[14px] w-[14px]" />
                              {at('force_leave_btn')}
                            </button>
                              )}
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
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    {at('tab_groups')} ({filteredGroups.length})
                  </h2>
                  <div className="admin-search relative w-[300px] max-w-full">
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

                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAppFilter('all')}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
                      appFilter === 'all'
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {at('filter_all')}
                  </button>
                  {ALL_APP_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAppFilter(id)}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${
                        appFilter === id
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : `border-transparent ${getAppIdBadgeClass(id)} hover:opacity-90`
                      }`}
                    >
                      {getAppIdLabel(id)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-8">
                  {groupsByAppSections.map((section) => (
                    <section key={section.appId} className="min-w-0">
                      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                        <span
                          className={`rounded px-2 py-1 text-sm font-bold ${getAppIdBadgeClass(section.appId)}`}
                        >
                          {section.label}
                        </span>
                        <span className="text-sm font-medium text-slate-500">
                          {section.groups.length}
                        </span>
                      </div>
                      <div className="admin-grid grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                        {section.groups.map((group, index) => {
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
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-lg font-semibold text-slate-800">
                          <span className="min-w-0 truncate">{adminGroupLabel(group)}</span>
                          {group.app_id && (
                            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${getAppIdBadgeClass(group.app_id)}`}>
                              {getAppIdLabel(group.app_id)}
                            </span>
                          )}
                          {suspendedGroupIds.has(group.id) && (
                            <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold bg-red-100 text-red-800">
                              {st('badge_suspended')}
                            </span>
                          )}
                        </h3>
                        <Crown className="h-5 w-5 shrink-0 text-amber-500" />
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
                        {at('created_at')}: {new Date(group.created_at).toLocaleDateString(adminLocale)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                          <button
                            className="flex-[1_1_120px] cursor-pointer rounded-lg border-none bg-sky-100 px-3 py-2 text-[13px] font-semibold text-sky-700 transition-colors hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
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
                        {/* 시스템 관리자: 전 앱 그룹 관리 가능 */}
                        <button
                            className="flex-1 cursor-pointer rounded-lg border-none bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                            onClick={() => handleSelectGroupForAdmin(group.id)}
                          >
{at('manage_btn')}
                            </button>
                        <button
                          className={`cursor-pointer rounded-lg border-none px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                            suspendedGroupIds.has(group.id)
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 focus-visible:ring-emerald-400/70'
                              : 'bg-orange-100 text-orange-800 hover:bg-orange-200 focus-visible:ring-orange-400/70'
                          } flex-1`}
                          onClick={() => {
                            setSuspendTarget({
                              kind: 'group',
                              groupId: group.id,
                              groupName: adminGroupLabel(group),
                              currentlySuspended: suspendedGroupIds.has(group.id),
                            });
                          }}
                        >
                          {suspendedGroupIds.has(group.id) ? st('unsuspend_btn') : st('suspend_btn')}
                        </button>
                        <button
                          className={`cursor-pointer rounded-lg border-none bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 ${
                            manageableGroups.some(mg => mg.id === group.id) ? 'flex-1' : 'w-full'
                          }`}
                          onClick={async () => {
                            const msg = at('confirm_delete_group').replace(/\$\{groupName\}/g, adminGroupLabel(group));
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
                    </section>
                  ))}
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
                  <div className="mb-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-[160px] flex-1">
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
                        className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                      >
                        <option value="">{at('select_group_option')}</option>
                        {filteredManageableGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            [{getAppIdLabel(group.app_id)}] {getGroupSelectorLabel(group, ct('app_title'))} ({fat('count_suffix', { count: group.member_count })})
                          </option>
                        ))}
                      </select>
                    </div>
                    <select
                      value={appFilter}
                      onChange={(e) => setAppFilter(e.target.value as 'all' | AppId)}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-[13px] text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                      aria-label={adminLang === 'ko' ? '앱 필터' : 'App filter'}
                    >
                      <option value="all">{at('filter_all')}</option>
                      {ALL_APP_IDS.map((id) => (
                        <option key={id} value={id}>{getAppIdLabel(id)}</option>
                      ))}
                    </select>
                  </div>
                  {filteredManageableGroups.length === 0 && (
                    <p className="mt-2 text-[13px] italic text-amber-500">
                      {at('no_manageable_groups')}
                    </p>
                  )}
                </div>

                {selectedGroup && selectedGroupId && (
                  <div className="min-w-0 max-w-full overflow-x-hidden">
                    <GroupAdminPanel
                      variant="embedded"
                      embeddedGroupId={selectedGroupId}
                      embeddedGroupName={getGroupSelectorLabel(selectedGroup, ct('app_title'))}
                      showPiggyArchivesTab
                      adminLangForPiggy={adminLang}
                      onEmbeddedClose={() => setActiveTab('dashboard')}
                    />
                  </div>
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
                      resetAnnouncementForm();
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    {at('new_announcement_btn')}
                  </button>
                </div>

                {renderAppFilterChips(true)}
                <p className="mb-4 text-[13px] text-slate-500">
                  {adminLang === 'ko'
                    ? '전역 공지는 모든 앱에, 앱 지정 공지는 해당 앱에만 노출됩니다.'
                    : 'Global notices appear in all apps; app-targeted notices only in that app.'}
                </p>

                {/* 공지 목록 */}
                <div className="flex flex-col gap-4">
                  {filteredAnnouncements.map((announcement) => (
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
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="m-0 text-lg font-semibold text-slate-800">
                              {getAnnouncementTexts(announcement, adminLang).title}
                            </h3>
                            {renderAppBadge(announcement.app_id)}
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
                            {getAnnouncementTexts(announcement, adminLang).content}
                          </p>
                        </div>
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingAnnouncement(announcement);
                              openAnnouncementEdit(announcement);
                            }}
                            className="cursor-pointer rounded-md border-none bg-indigo-100 px-3 py-2 text-[13px] font-semibold text-indigo-800 transition-colors hover:bg-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
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
                              className="cursor-pointer rounded-md border-none bg-amber-100 px-3 py-2 text-[13px] font-semibold text-amber-800 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
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
                              className="cursor-pointer rounded-md border-none bg-red-100 px-3 py-2 text-[13px] font-semibold text-red-800 transition-colors hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                            >
                              {at('permanent_delete_btn')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">
                        {at('written_at')} {new Date(announcement.created_at).toLocaleString(adminLocale)}
                        {announcement.updated_at !== announcement.created_at && ` | ${at('updated_at_label')} ${new Date(announcement.updated_at).toLocaleString(adminLocale)}`}
                      </div>
                    </motion.div>
                  ))}
                  {filteredAnnouncements.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <Megaphone className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{at('no_announcements')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 문의 관리 탭 */}
            {/* 전체 문의 탭 */}
            {activeTab === 'all-support-tickets' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    {fat('support_all_pending_title', { count: filteredSupportTickets.filter(t => t.status === 'pending').length })}
                  </h2>
                  <div className="flex gap-2">
                    <select
                      className="cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                      onChange={(e) => {
                        const status = e.target.value;
                        if (status === 'all') {
                          loadAllSupportTickets();
                        }
                      }}
                    >
                      <option value="all">{at('filter_all')}</option>
                      <option value="pending">{at('status_pending')}</option>
                      <option value="answered">{at('status_answered')}</option>
                      <option value="closed">{at('status_closed')}</option>
                    </select>
                  </div>
                </div>

                {renderAppFilterChips(false)}

                <div className="flex flex-col gap-4">
                  {filteredSupportTickets.map((ticket) => (
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
                            {renderAppBadge(ticket.app_id ?? ticket.groups?.app_id, false)}
                          </div>
                          <p className="mb-3 mt-0 whitespace-pre-wrap text-sm text-slate-500">
                            {ticket.content}
                          </p>
                          {ticket.answer && (
                            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                              <div className="mb-2 text-xs font-semibold text-sky-700">
                                {at('answer_label')}
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
                                {entry.role === 'group_admin' ? gat('thread_role_follow_up') : gat('thread_role_system_reply')}
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                                {entry.body}
                              </p>
                              <div className="mt-2 text-[11px] text-slate-400">
                                {new Date(entry.created_at).toLocaleString(adminLocale)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={deletingSystemSupportTicketId === ticket.id}
                          onClick={async () => {
                            if (!confirm(at('confirm_delete_support_ticket'))) return;
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
                                throw new Error(result.error || at('error_delete_inquiry'));
                              }
                              loadAllSupportTickets();
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : at('error_delete_inquiry'));
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
                          {ct('delete')}
                        </button>
                      </div>
                      {ticket.status === 'pending' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTicket(ticket);
                              setTicketAnswer('');
                            }}
                            className="cursor-pointer rounded-md border-none bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                          >
                            {at('answer_btn')}
                          </button>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        {at('written_at')} {new Date(ticket.created_at).toLocaleString(adminLocale)}
                        {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString(adminLocale)}`}
                      </div>
                    </motion.div>
                  ))}
                  {supportTickets.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{at('no_inquiries')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'member-inquiries' && (
              <div>
                <div className="mb-6">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    {at('tab_member_inquiries')}
                  </h2>
                  <p className="mt-2 mb-0 max-w-3xl text-sm leading-relaxed text-slate-500">
                    {brandSystemAdminCopy(
                      adminLang === 'ko'
                        ? '일상적인 멤버 문의는 그룹 관리자만 처리합니다. 시스템 관리자는 신고·분쟁·법령 협조·그룹 관리자 부재 등 예외 사유가 있을 때만, 문의 ID로 단건 조회·삭제할 수 있습니다. 모든 접근은 감사 로그에 기록됩니다.'
                        : 'Day-to-day member inquiries are handled by group admins only. System admins may look up or delete a single ticket by ID only for exception reasons (report, dispute, legal, absent admin, etc.). Every access is audit-logged.',
                    )}
                  </p>
                </div>

                <div className="mb-6 max-w-xl space-y-4 rounded-xl border border-amber-200 bg-amber-50/80 p-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="member-inquiry-ticket-id">
                      {adminLang === 'ko' ? '문의 ID (UUID)' : 'Ticket ID (UUID)'}
                    </label>
                    <input
                      id="member-inquiry-ticket-id"
                      type="text"
                      value={memberInquiryTicketId}
                      onChange={(e) => setMemberInquiryTicketId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="member-inquiry-reason-code">
                      {adminLang === 'ko' ? '사유 유형' : 'Reason type'}
                    </label>
                    <select
                      id="member-inquiry-reason-code"
                      value={memberInquiryReasonCode}
                      onChange={(e) =>
                        setMemberInquiryReasonCode(
                          e.target.value as typeof memberInquiryReasonCode
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="report">{adminLang === 'ko' ? '신고 처리' : 'Report'}</option>
                      <option value="dispute">{adminLang === 'ko' ? '분쟁 처리' : 'Dispute'}</option>
                      <option value="legal">{adminLang === 'ko' ? '법령·수사 협조' : 'Legal / authority'}</option>
                      <option value="admin_absent">{adminLang === 'ko' ? '그룹 관리자 부재·미사용' : 'Group admin absent'}</option>
                      <option value="other">{adminLang === 'ko' ? '기타(사유 상세 필수)' : 'Other (detail required)'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="member-inquiry-reason">
                      {adminLang === 'ko' ? '접근 사유 (10자 이상)' : 'Access reason (min. 10 chars)'}
                    </label>
                    <textarea
                      id="member-inquiry-reason"
                      value={memberInquiryReason}
                      onChange={(e) => setMemberInquiryReason(e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                      placeholder={
                        adminLang === 'ko'
                          ? '예: 그룹 관리자 미응답으로 방치된 문의 확인 (티켓 신고 #…)'
                          : 'e.g. Review orphaned ticket after group admin inactivity (case #…)'
                      }
                    />
                  </div>
                  {memberInquiryActionError && (
                    <p className="m-0 text-sm font-medium text-red-600">{memberInquiryActionError}</p>
                  )}
                  <button
                    type="button"
                    disabled={memberInquiryLookupLoading}
                    onClick={() => void lookupMemberInquiryException()}
                    className={`rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white ${
                      memberInquiryLookupLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-purple-700'
                    }`}
                  >
                    {memberInquiryLookupLoading
                      ? '…'
                      : adminLang === 'ko'
                        ? '사유 기록 후 단건 조회'
                        : 'Look up (audit-logged)'}
                  </button>
                </div>

                {memberInquiryLookup && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-3xl rounded-xl border p-5 ${
                      memberInquiryLookup.status === 'pending'
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <h3 className="m-0 text-lg font-semibold text-slate-800">
                        {memberInquiryLookup.title}
                      </h3>
                      {memberInquiryLookup.groups && (
                        <span className="rounded-md bg-gray-100 px-2 py-1 text-[13px] font-medium text-gray-600">
                          📁 {memberInquiryLookup.groups.name}
                        </span>
                      )}
                      {renderAppBadge(
                        memberInquiryLookup.app_id ?? memberInquiryLookup.groups?.app_id,
                        false
                      )}
                      <span
                        className={`rounded-xl px-3 py-1 text-xs font-semibold text-white ${
                          memberInquiryLookup.status === 'pending'
                            ? 'bg-orange-500'
                            : memberInquiryLookup.status === 'answered'
                              ? 'bg-emerald-500'
                              : 'bg-slate-400'
                        }`}
                      >
                        {memberInquiryLookup.status === 'pending'
                          ? at('status_pending')
                          : memberInquiryLookup.status === 'answered'
                            ? at('status_answered')
                            : at('status_closed')}
                      </span>
                    </div>
                    <p className="mb-1 font-mono text-xs text-slate-400">{memberInquiryLookup.id}</p>
                    <p className="mb-3 mt-0 whitespace-pre-wrap text-sm text-slate-500">
                      {memberInquiryLookup.content}
                    </p>
                    {memberInquiryLookup.answer && (
                      <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3.5">
                        <div className="mb-1.5 text-xs font-semibold text-sky-700">
                          {at('answer_label')}
                        </div>
                        <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                          {memberInquiryLookup.answer}
                        </p>
                      </div>
                    )}
                    {parseMemberSupportMessageThread(memberInquiryLookup.message_thread).map(
                      (entry, idx) => (
                        <div
                          key={`mgi-ex-${entry.created_at}-${idx}`}
                          className={`mt-2.5 rounded-lg border p-3 ${
                            entry.role === 'member'
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-sky-200 bg-sky-50'
                          }`}
                        >
                          <div
                            className={`mb-1 text-xs font-semibold ${
                              entry.role === 'member' ? 'text-amber-700' : 'text-sky-700'
                            }`}
                          >
                            {entry.role === 'member' ? gat('thread_role_follow_up') : at('answer_label')}
                          </div>
                          <p className="m-0 whitespace-pre-wrap text-[13px] text-slate-800">
                            {entry.body}
                          </p>
                        </div>
                      )
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-400">
                        {at('written_at')}{' '}
                        {new Date(memberInquiryLookup.created_at).toLocaleString(adminLocale)}
                        {memberInquiryLookup.answered_at &&
                          ` | ${at('answered_at')} ${new Date(memberInquiryLookup.answered_at).toLocaleString(adminLocale)}`}
                      </div>
                      <button
                        type="button"
                        disabled={deletingMemberInquiryId === memberInquiryLookup.id}
                        onClick={() => void deleteMemberInquiryException()}
                        className={`rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] font-semibold text-red-700 ${
                          deletingMemberInquiryId === memberInquiryLookup.id
                            ? 'cursor-not-allowed opacity-70'
                            : 'cursor-pointer opacity-100'
                        }`}
                      >
                        {deletingMemberInquiryId === memberInquiryLookup.id
                          ? '…'
                          : adminLang === 'ko'
                            ? '예외 삭제 (감사 기록)'
                            : 'Exception delete (audit)'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === 'support-tickets' && (
              <div>
                <h2 className="mb-6 text-xl font-semibold text-slate-800">
                  {fat('support_manage_pending_title', { count: supportTickets.filter(t => t.status === 'pending').length })}
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
                                {at('group_prefix_label')} {ticket.groups.name}
                              </span>
                            )}
                          </div>
                          <p className="mb-3 mt-0 whitespace-pre-wrap text-sm text-slate-500">
                            {ticket.content}
                          </p>
                          {ticket.answer && (
                            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                              <div className="mb-2 text-xs font-semibold text-sky-700">
                                {at('answer_label')}
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
                                {entry.role === 'group_admin' ? gat('thread_role_follow_up') : gat('thread_role_system_reply')}
                              </div>
                              <p className="m-0 whitespace-pre-wrap text-sm text-slate-800">
                                {entry.body}
                              </p>
                              <div className="mt-2 text-[11px] text-slate-400">
                                {new Date(entry.created_at).toLocaleString(adminLocale)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={deletingSystemSupportTicketId === ticket.id}
                          onClick={async () => {
                            if (!confirm(at('confirm_delete_support_ticket'))) return;
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
                                throw new Error(result.error || at('error_delete_inquiry'));
                              }
                              loadSupportTickets();
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : at('error_delete_inquiry'));
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
                          {ct('delete')}
                        </button>
                      </div>
                      {ticket.status === 'pending' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTicket(ticket);
                              setTicketAnswer('');
                            }}
                            className="cursor-pointer rounded-md border-none bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                          >
                            {at('answer_btn')}
                          </button>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        {at('written_at')} {new Date(ticket.created_at).toLocaleString(adminLocale)}
                        {ticket.answered_at && ` | ${at('answered_at')} ${new Date(ticket.answered_at).toLocaleString(adminLocale)}`}
                      </div>
                    </motion.div>
                  ))}
                  {supportTickets.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{at('no_inquiries')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 접근 요청 관리 탭 */}
            {activeTab === 'dashboard-access-requests' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-xl font-semibold text-slate-800">
                    {fat('access_requests_pending_title', { count: filteredAccessRequests.filter(r => r.status === 'pending').length })}
                  </h2>
                  <button
                    onClick={() => {
                      setShowNewAccessRequestModal(true);
                      setNewAccessRequestGroupId('');
                      setNewAccessRequestReason('');
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    {at('new_access_request_btn')}
                  </button>
                </div>

                {renderAppFilterChips(false)}

                <div className="flex flex-col gap-4">
                  {filteredAccessRequests.map((request) => (
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
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            {request.groups && (
                              <h3 className="m-0 text-lg font-semibold text-slate-800">
                                {request.groups.name}
                              </h3>
                            )}
                            {renderAppBadge(request.app_id ?? request.groups?.app_id, false)}
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
                              {at('expires_at_label')} {new Date(request.expires_at).toLocaleString(adminLocale)}
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
                            className="cursor-pointer rounded-md border-none bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
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
                            className="cursor-pointer rounded-md border-none bg-red-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
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
                            className="cursor-pointer rounded-md border-none bg-red-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                          >
                            {at('revoke_btn')}
                          </button>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        {at('requested_at_label')} {new Date(request.created_at).toLocaleString(adminLocale)}
                        {request.approved_at && ` | ${at('approved_at_label')} ${new Date(request.approved_at).toLocaleString(adminLocale)}`}
                        {request.rejected_at && ` | ${at('rejected_at_label')} ${new Date(request.rejected_at).toLocaleString(adminLocale)}`}
                      </div>
                    </motion.div>
                  ))}
                  {filteredAccessRequests.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <KeyRound className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{at('no_access_requests')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 감사 로그 탭 */}
            {activeTab === 'audit-log' && (
              <div>
                <h2 className="mb-6 text-xl font-semibold text-slate-800">
                  {at('audit_log_page_title')}
                </h2>
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="text-[13px] text-slate-600">{at('audit_period_label')}</label>
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
                    value={auditLogFilters.app_id}
                    onChange={(e) =>
                      setAuditLogFilters((f) => ({
                        ...f,
                        app_id: e.target.value as '' | AppId,
                      }))
                    }
                    className="min-w-[120px] cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">{adminLang === 'ko' ? '앱: 전체' : 'App: All'}</option>
                    {ALL_APP_IDS.map((id) => (
                      <option key={id} value={id}>{getAppIdLabel(id)}</option>
                    ))}
                  </select>
                  <select
                    value={auditLogFilters.resource_type}
                    onChange={(e) => setAuditLogFilters((f) => ({ ...f, resource_type: e.target.value }))}
                    className="min-w-[140px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">{at('audit_filter_all_types')}</option>
                    <option value="group">{at('audit_type_group')}</option>
                    <option value="user">{at('audit_type_user')}</option>
                    <option value="announcement">{at('audit_type_announcement')}</option>
                    <option value="dashboard_access_request">{at('audit_type_dashboard_access_request')}</option>
                    <option value="support_ticket">{at('audit_type_support_ticket')}</option>
                    <option value="member_support_ticket">{at('audit_type_member_support_ticket')}</option>
                    <option value="system_admin">{at('audit_type_system_admin')}</option>
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
                    {at('search_btn')}
                  </button>
                  <button
                    onClick={exportAuditLogsCsv}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                  >
                    <Download className="h-4 w-4" />
                    {at('export_csv_btn')}
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
                            <td className="whitespace-nowrap px-3 py-2.5">{new Date(log.created_at).toLocaleString(adminLocale)}</td>
                            <td className="px-3 py-2.5">{log.action}</td>
                            <td className="px-3 py-2.5">{log.resource_type}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{log.resource_id || '-'}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{log.admin_id}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-xs">{log.group_id || '-'}</span>
                                {log.app_id ? renderAppBadge(log.app_id, false) : null}
                              </div>
                            </td>
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
                        {at('pagination_prev')}
                      </button>
                      <span className="self-center text-[13px] text-slate-600">{auditLogPage} / {Math.ceil(auditLogTotal / auditLogLimit) || 1}</span>
                      <button
                        onClick={() => loadAuditLogs(auditLogPage + 1)}
                        disabled={auditLogPage >= Math.ceil(auditLogTotal / auditLogLimit) || auditLogLoading}
                        className={`rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] ${
                          auditLogPage >= Math.ceil(auditLogTotal / auditLogLimit) || auditLogLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        {at('pagination_next')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </div>

      {/* glass-panel 밖 portal 모달 — loadingData와 무관하게 유지 */}
      <AdminSuspendModals
        lang={adminLang}
        target={suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onApplied={() => {
          void loadSuspendSummary();
        }}
      />
      <AdminForceLeaveModal
        lang={adminLang}
        target={forceLeaveTarget}
        onClose={() => setForceLeaveTarget(null)}
        onApplied={() => {
          void loadUsers();
        }}
      />
      <SystemAdminTransferModal
        open={transferModalOpen}
        lang={adminLang}
        candidates={users.filter((item) => item.id !== currentAdminUserId)}
        preselectedUserId={transferSuccessorId}
        intent="keep_account"
        onClose={() => {
          setTransferModalOpen(false);
          setTransferSuccessorId(null);
        }}
        onTransferred={async () => {
          setTransferModalOpen(false);
          setTransferSuccessorId(null);
          alert(getAdminTransferTranslation(adminLang, 'success_keep'));
          router.replace('/dashboard');
        }}
      />
      <GlassSafeModal
        open={editingAnnouncement !== undefined}
        onClose={() => {
          setEditingAnnouncement(undefined);
          resetAnnouncementForm();
        }}
      >
        <h3 className="mb-4 text-xl font-semibold text-slate-800">
          {editingAnnouncement ? at('edit_announcement_modal_title') : at('new_announcement_modal_title')}
        </h3>
        <div className="mb-3 flex gap-1 border-b border-slate-200">
          {ANNOUNCEMENT_PRIMARY_LANG_CODES.map((l) => (
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
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
        {showAnnouncementEditor && (
          <>
            <p className="mb-2 text-xs font-medium text-slate-500">
              {LANG_LABELS[announcementLangTab]}
            </p>
            <input
              type="text"
              value={announcementTitleI18n[announcementLangTab] ?? ''}
              onChange={(e) =>
                setAnnouncementTitleI18n((prev) => ({ ...prev, [announcementLangTab]: e.target.value }))
              }
              placeholder={at('placeholder_title')}
              className="mb-4 w-full rounded-lg border border-slate-200 p-3 text-base font-inherit"
            />
            <textarea
              value={announcementContentI18n[announcementLangTab] ?? ''}
              onChange={(e) =>
                setAnnouncementContentI18n((prev) => ({ ...prev, [announcementLangTab]: e.target.value }))
              }
              placeholder={at('placeholder_content')}
              className="mb-4 min-h-[200px] w-full rounded-lg border border-slate-200 p-3 text-sm font-inherit"
            />
          </>
        )}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setAnnouncementExtraExpanded((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-4 py-3 text-left text-sm font-semibold text-slate-700"
          >
            {announcementExtraSectionLabel}
            <span className="text-xs font-normal text-slate-400">
              {announcementExtraExpanded ? '▲' : '▼'}
            </span>
          </button>
          {announcementExtraExpanded && (
            <div className="border-t border-slate-200 px-4 pb-4 pt-3">
              <p className="mb-3 text-xs text-slate-500">{announcementExtraHint}</p>
              <div className="flex flex-wrap gap-2">
                {ANNOUNCEMENT_EXTRA_LANG_CODES.map((l) => {
                  const enabled = announcementExtraEnabled.has(l);
                  const hasContent =
                    !!(announcementTitleI18n[l] ?? '').trim() ||
                    !!(announcementContentI18n[l] ?? '').trim();
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleAnnouncementExtraLang(l)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        enabled || announcementLangTab === l
                          ? 'border-purple-500 bg-purple-100 text-purple-800'
                          : 'border-slate-300 bg-white text-slate-600 hover:border-purple-300'
                      } ${hasContent && !enabled ? 'ring-1 ring-amber-300' : ''}`}
                    >
                      {LANG_LABELS[l]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="mb-3 block text-sm font-semibold text-slate-700">
            {adminLang === 'ko' ? '앱 대상' : 'App scope'}
          </label>
          <select
            value={announcementAppId ?? 'global'}
            onChange={(e) => {
              const v = e.target.value;
              setAnnouncementAppId(v === 'global' ? null : v);
            }}
            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
          >
            <option value="global">{adminLang === 'ko' ? '전역 (모든 앱)' : 'Global (all apps)'}</option>
            {ALL_APP_IDS.map((id) => (
              <option key={id} value={id}>{getAppIdLabel(id)}</option>
            ))}
          </select>
          <p className="mb-0 mt-2 text-xs text-slate-500">
            {adminLang === 'ko'
              ? '전역은 4개 앱 모두에 표시됩니다. 특정 앱을 고르면 그 앱에만 표시됩니다.'
              : 'Global shows in all 4 apps. A specific app only shows there.'}
          </p>
        </div>
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="mb-3 block text-sm font-semibold text-slate-700">
            {at('announcement_target_label')}
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
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
              />
              <span className={`text-sm text-slate-700 ${announcementTarget === 'ADMIN_ONLY' ? 'font-semibold' : 'font-normal'}`}>
                {at('target_admin_only')}
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
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
              />
              <span className={`text-sm text-slate-700 ${announcementTarget === 'ALL_MEMBERS' ? 'font-semibold' : 'font-normal'}`}>
                {at('target_all_members')}
              </span>
            </label>
          </div>
          <p className="mb-0 mt-2 text-xs text-slate-500">
            {announcementTarget === 'ADMIN_ONLY'
              ? at('target_admin_only_hint')
              : at('target_all_members_hint')}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setEditingAnnouncement(undefined);
              resetAnnouncementForm();
            }}
            className="cursor-pointer rounded-lg border-none bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70"
          >
            {ct('cancel')}
          </button>
          <button
            onClick={async () => {
              const titleObj: Record<string, string> = {};
              const contentObj: Record<string, string> = {};
              for (const l of LANG_CODES) {
                if (
                  ANNOUNCEMENT_EXTRA_LANG_CODES.includes(l) &&
                  !announcementExtraEnabled.has(l)
                ) {
                  continue;
                }
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
                      Authorization: `Bearer ${session.access_token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      id: editingAnnouncement.id,
                      title_i18n: titleObj,
                      content_i18n: contentObj,
                      is_active: true,
                      target: announcementTarget,
                      app_id: announcementAppId,
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
                      Authorization: `Bearer ${session.access_token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      title_i18n: titleObj,
                      content_i18n: contentObj,
                      is_active: true,
                      target: announcementTarget,
                      app_id: announcementAppId,
                    }),
                  });

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.error || at('error_announcement_create_failed'));
                  }

                  alert(at('success_announcement_created'));
                }

                setEditingAnnouncement(undefined);
                resetAnnouncementForm();
                loadAnnouncements();
              } catch (error: unknown) {
                console.error(at('error_announcement_update_failed'), error);
                alert(error instanceof Error ? error.message : at('error_announcement_update_failed'));
              } finally {
                setLoadingData(false);
              }
            }}
            className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
          >
            {editingAnnouncement ? at('edit_btn') : at('write_btn')}
          </button>
        </div>
      </GlassSafeModal>

      <GlassSafeModal
        open={
          !!editingTicket &&
          (activeTab === 'all-support-tickets' || activeTab === 'support-tickets')
        }
        onClose={() => {
          setEditingTicket(null);
          setTicketAnswer('');
        }}
      >
        {editingTicket && (
          <>
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
                  <div className="mb-1 font-semibold">{at('first_answer_label')}</div>
                  <div className="whitespace-pre-wrap text-slate-600">{editingTicket.answer}</div>
                </div>
              )}
              {parseMessageThread(editingTicket.message_thread).map((entry, idx) => (
                <div key={`ticket-modal-${idx}`} className="mt-2.5 text-xs">
                  <div className={`font-semibold ${entry.role === 'group_admin' ? 'text-amber-700' : 'text-sky-700'}`}>
                    {entry.role === 'group_admin' ? gat('thread_role_follow_up') : gat('thread_role_system_reply')}
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
                className="cursor-pointer rounded-lg border-none bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70"
              >
                {at('cancel_btn')}
              </button>
              <button
                onClick={async () => {
                  const isAllSupportTab = activeTab === 'all-support-tickets';
                  if (!ticketAnswer.trim()) {
                    alert(isAllSupportTab ? at('answer_required') : at('answer_content_required'));
                    return;
                  }

                  try {
                    if (!isAllSupportTab) {
                      setLoadingData(true);
                    }
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) {
                      alert(isAllSupportTab ? at('error_session_expired') : at('error_auth'));
                      return;
                    }

                    const response = await fetch('/api/admin/support-tickets', {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
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
                      throw new Error(
                        result.error ||
                          (isAllSupportTab ? at('answer_save_failed') : at('error_answer_failed')),
                      );
                    }

                    alert(isAllSupportTab ? at('answer_saved') : at('success_answer_submitted'));
                    setEditingTicket(null);
                    setTicketAnswer('');
                    if (isAllSupportTab) {
                      loadAllSupportTickets();
                    } else {
                      loadSupportTickets();
                    }
                  } catch (err: unknown) {
                    console.error('답변 저장 오류:', err);
                    alert(
                      err instanceof Error
                        ? err.message
                        : activeTab === 'all-support-tickets'
                          ? at('answer_save_error')
                          : at('error_answer_failed'),
                    );
                  } finally {
                    if (activeTab === 'support-tickets') {
                      setLoadingData(false);
                    }
                  }
                }}
                className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
              >
                {activeTab === 'all-support-tickets' ? ct('save') : at('submit_answer_btn')}
              </button>
            </div>
          </>
        )}
      </GlassSafeModal>

      <GlassSafeModal
        open={showNewAccessRequestModal}
        onClose={() => {
          setShowNewAccessRequestModal(false);
          setNewAccessRequestGroupId('');
          setNewAccessRequestReason('');
        }}
      >
        <h3 className="mb-4 text-xl font-semibold text-slate-800">
          {at('new_access_request_modal_title')}
        </h3>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-800">
            {at('select_group_label')}
          </label>
          <select
            value={newAccessRequestGroupId}
            onChange={(e) => setNewAccessRequestGroupId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-3 text-sm font-inherit"
          >
            <option value="">{at('select_group_option')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                [{getAppIdLabel(group.app_id)}] {adminGroupLabel(group)}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-800">
            {at('placeholder_reason')}
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
            className="cursor-pointer rounded-lg border-none bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70"
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
                    Authorization: `Bearer ${session.access_token}`,
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
              } catch (error: unknown) {
                console.error(at('error_create_request_failed'), error);
                alert(error instanceof Error ? error.message : at('error_create_request_failed'));
              } finally {
                setLoadingData(false);
              }
            }}
            className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
          >
            {at('submit_request_btn')}
          </button>
        </div>
      </GlassSafeModal>
    </div>
  );
}

