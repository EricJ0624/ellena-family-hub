'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getGroupAdminTranslation } from '@/lib/translations/groupAdmin';
import { getCommonTranslation } from '@/lib/translations/common';
import { 
  Users, 
  Settings, 
  BarChart3, 
  Shield, 
  Loader2, 
  AlertCircle,
  X,
  Search,
  Crown,
  Trash2,
  Image as ImageIcon,
  MapPin,
  Home,
  Megaphone,
  MessageSquare,
  Key,
  Plus,
  Check,
  PiggyBank
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MemberManagement from '@/app/components/MemberManagement';
import GroupSettings from '@/app/components/GroupSettings';
import AnnouncementBanner from '@/app/components/AnnouncementBanner';
import { getAdminTranslation } from '@/lib/translations/admin';
import { getAnnouncementTexts } from '@/lib/announcement-i18n';
import { parseMessageThread } from '@/lib/support-ticket-thread';
import { parseMemberSupportMessageThread } from '@/lib/member-support-ticket-thread';
import { getFamilyRoleEmoji, getFamilyRoleLabel } from '@/lib/translations/memberManagement';

export type GroupAdminPanelVariant = 'standalone' | 'embedded';

export interface GroupAdminPanelProps {
  variant?: GroupAdminPanelVariant;
  embeddedGroupId?: string | null;
  embeddedGroupName?: string | null;
  onEmbeddedClose?: () => void;
  showPiggyArchivesTab?: boolean;
  adminLangForPiggy?: 'ko' | 'en';
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
  last_updated: string;
  email: string | null;
  nickname: string | null;
  familyRole?: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null;
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
  is_read?: boolean;
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
}

interface MemberSupportTicketInfo {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  content: string;
  status: 'pending' | 'answered' | 'closed';
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  message_thread?: unknown;
  created_at: string;
  updated_at: string;
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
}

type GroupAdminTabId =
  | 'dashboard'
  | 'members'
  | 'settings'
  | 'content'
  | 'announcements'
  | 'support-tickets'
  | 'member-support-tickets'
  | 'dashboard-access-requests'
  | 'piggy-archives';

export function GroupAdminPanel({
  variant = 'standalone',
  embeddedGroupId = null,
  embeddedGroupName = null,
  onEmbeddedClose,
  showPiggyArchivesTab = false,
  adminLangForPiggy = 'ko',
}: GroupAdminPanelProps = {}) {
  const router = useRouter();
  const isEmbedded = variant === 'embedded';

  const { lang } = useLanguage();
  const gat = (key: keyof import('@/lib/translations/groupAdmin').GroupAdminTranslations) => getGroupAdminTranslation(lang, key);
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
  const atPiggy = (key: keyof import('@/lib/translations/admin').AdminTranslations) =>
    getAdminTranslation(adminLangForPiggy, key);

  let contextGroupId: string | null = null;
  let currentGroup: any = null;
  let userRole: string | null = null;
  let isOwner = false;
  let groupList: any[] = [];
  let groupMemberships: any[] = [];
  let setCurrentGroupId: ((groupId: string | null) => void) | null = null;
  try {
    const groupContext = useGroup();
    contextGroupId = groupContext.currentGroupId;
    currentGroup = groupContext.currentGroup;
    userRole = groupContext.userRole;
    isOwner = groupContext.isOwner;
    groupList = groupContext.groups || [];
    groupMemberships = groupContext.memberships || [];
    setCurrentGroupId = groupContext.setCurrentGroupId;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('GroupProvider 없음 — 컨텍스트 null 처리');
    }
  }

  const effectiveGroupId = isEmbedded ? embeddedGroupId : contextGroupId;
  const displayGroupName = isEmbedded ? embeddedGroupName ?? currentGroup?.name : currentGroup?.name;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<GroupAdminTabId>('dashboard');
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [photos, setPhotos] = useState<PhotoInfo[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ??�쎈�?????�쏙???? ??�쎈�?? ???�쎌??????�쎌?�占???�승??????�쏙????
  const [announcements, setAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketInfo[]>([]);
  const [memberSupportTickets, setMemberSupportTickets] = useState<MemberSupportTicketInfo[]>([]);
  const [accessRequests, setAccessRequests] = useState<DashboardAccessRequestInfo[]>([]);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketContent, setTicketContent] = useState('');
  const [accessRequestReason, setAccessRequestReason] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showAccessRequestForm, setShowAccessRequestForm] = useState(false);
  const [editingMemberTicket, setEditingMemberTicket] = useState<MemberSupportTicketInfo | null>(null);
  const [memberTicketAnswer, setMemberTicketAnswer] = useState('');
  const [deletingMemberTicketId, setDeletingMemberTicketId] = useState<string | null>(null);
  const [followUpForTicket, setFollowUpForTicket] = useState<SupportTicketInfo | null>(null);
  const [followUpBody, setFollowUpBody] = useState('');
  const [deletingSupportTicketId, setDeletingSupportTicketId] = useState<string | null>(null);

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

  const loadPiggyArchivesSnapshots = useCallback(async (groupId: string) => {
    try {
      setPiggyArchivesLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(atPiggy('error_session_expired'));
        setPiggyArchivesLoading(false);
        return;
      }
      const response = await fetch(`/api/group-admin/piggy-archives?group_id=${encodeURIComponent(groupId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || atPiggy('error_piggy_archive_fetch'));
      const list = result.data?.snapshots ?? [];
      const gname = embeddedGroupName ?? currentGroup?.name ?? '-';
      setPiggyArchivesSnapshots(list.map((s: { id: string; group_id: string; user_id: string; user_nickname: string; deleted_at: string; deleted_by: string | null; deleted_by_nickname: string | null; account_name: string | null }) => ({
        id: s.id,
        group_id: s.group_id,
        group_name: gname,
        user_id: s.user_id,
        user_nickname: s.user_nickname,
        deleted_at: s.deleted_at,
        deleted_by: s.deleted_by,
        deleted_by_nickname: s.deleted_by_nickname,
        account_name: s.account_name,
      })));
    } catch (err: any) {
      console.error('저금통 보관 목록 로드 오류:', err);
      setError(err.message || atPiggy('error_piggy_archive_list'));
      setPiggyArchivesSnapshots([]);
    } finally {
      setPiggyArchivesLoading(false);
    }
  }, [embeddedGroupName, currentGroup?.name]);

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
      if (!response.ok) throw new Error(result.error || atPiggy('error_piggy_archive_detail'));
      setPiggyArchivesDetail(result.data ?? null);
    } catch (err: any) {
      console.error('저금통 보관 상세 로드 오류:', err);
      setPiggyArchivesDetail(null);
    } finally {
      setPiggyArchivesDetailLoading(false);
    }
  }, []);

  const deletePiggyArchivesSnapshot = useCallback(async (groupId: string, snapshotId: string) => {
    if (!confirm(atPiggy('confirm_delete_piggy_archive'))) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(atPiggy('error_session_expired'));
        return;
      }
      const response = await fetch(
        `/api/group-admin/piggy-archives?group_id=${encodeURIComponent(groupId)}&snapshot_id=${encodeURIComponent(snapshotId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || atPiggy('error_piggy_archive_delete'));
      if (piggyArchivesDetailId === snapshotId) {
        setPiggyArchivesDetailId(null);
        setPiggyArchivesDetail(null);
      }
      loadPiggyArchivesSnapshots(groupId);
    } catch (err: any) {
      console.error('저금통 보관 내역 삭제 오류:', err);
      setError(err.message || atPiggy('error_piggy_archive_delete_msg'));
    }
  }, [piggyArchivesDetailId, loadPiggyArchivesSnapshots]);

  useEffect(() => {
    if (isEmbedded) {
      if (embeddedGroupId) {
        setIsAuthorized(true);
        setLoading(false);
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
      return;
    }

    const checkGroupAdmin = async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      if (!contextGroupId) {
        router.push('/dashboard');
        return;
      }

      const isAdmin = userRole === 'ADMIN' || isOwner;

      if (!isAdmin) {
        router.push('/dashboard');
        return;
      }

      setIsAuthorized(true);
      setLoading(false);
    };

    checkGroupAdmin();
  }, [isEmbedded, embeddedGroupId, contextGroupId, userRole, isOwner, router]);

  // ???�쎌??????�쎌?????�≪뮆占?
  const loadStats = useCallback(async () => {
    if (!effectiveGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      // ?�밸챶占????�쎌????�쎛????�쎌???�썲??(???�쎌?????ID ???�쎌????
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', effectiveGroupId)
        .single();

      // ?�밸챶占?筌롢?�占???
      const { count: memberCount } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', effectiveGroupId);

      // 멤버십에 소유자가 포함되어 있으면 중복 집계 방지
      const totalMembers = memberCount || 0;

      // ?�밸챶占?筌롢?�占?ID 筌뤴뫖占?
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', effectiveGroupId);

      const memberIds = membersData?.map(m => m.user_id) || [];
      
      // ?�밸챶占????�쎌???????�쎈???
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      // ?�밸챶占????�쎌?�占???
      const { count: photoCount } = await supabase
        .from('memory_vault')
        .select('*', { count: 'exact', head: true })
        .in('uploader_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

      // 筌ㅼ�??7?????�쎌?�占???
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentPhotoCount } = await supabase
        .from('memory_vault')
        .select('*', { count: 'exact', head: true })
        .in('uploader_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('created_at', sevenDaysAgo.toISOString());

      // ???�쎌??????�쎌??????
      const { count: locationCount } = await supabase
        .from('user_locations')
        .select('*', { count: 'exact', head: true })
        .in('user_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

      setStats({
        totalMembers,
        totalPhotos: photoCount || 0,
        totalLocations: locationCount || 0,
        recentPhotos: recentPhotoCount || 0,
      });
    } catch (err: any) {
      console.error('???�쎌????�≪뮆占????�쎌?�占?', err);
      setError(err.message || '???�쎌???�썲????�쎈?????�쎌???????�쏙??????�쎌?????�쎌???');
    } finally {
      setLoadingData(false);
    }
  }, [effectiveGroupId]);

  // ???�쎌?�占?筌뤴뫖占??�≪뮆占?
  const loadPhotos = useCallback(async () => {
    if (!effectiveGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      // ?�밸챶占????�쎌????�쎛????�쎌???�썲??(???�쎌?????ID ???�쎌????
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', effectiveGroupId)
        .single();

      // ?�밸챶占?筌롢?�占?ID 筌뤴뫖占?
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', effectiveGroupId);

      const memberIds = membersData?.map(m => m.user_id) || [];
      
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      if (memberIds.length === 0) {
        setPhotos([]);
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

      setPhotos(photosData || []);
    } catch (err: any) {
      console.error('???�쎌?�占?筌뤴뫖占??�≪뮆占????�쎌?�占?', err);
      setError(err.message || '???�쎌?�占?筌뤴뫖占????�쎈?????�쎌???????�쏙??????�쎌?????�쎌???');
    } finally {
      setLoadingData(false);
    }
  }, [effectiveGroupId]);

  // ???�쎌??????�쎌?????�≪뮆占?
  const loadLocations = useCallback(async () => {
    if (!effectiveGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      // ?�밸챶占????�쎌????�쎛????�쎌???�썲??(???�쎌?????ID ???�쎌????
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', effectiveGroupId)
        .single();

      // ?�밸챶占?筌롢?�占?ID 筌뤴뫖占?
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', effectiveGroupId);

      const memberIds = membersData?.map(m => m.user_id) || [];
      
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      if (memberIds.length === 0) {
        setLocations([]);
        setLoadingData(false);
        return;
      }

      const { data: locationsData, error: locationsError } = await supabase
        .from('user_locations')
        .select('user_id, latitude, longitude, address, last_updated')
        .in('user_id', memberIds);

      if (locationsError) throw locationsError;

      // ???�쎌?�占?????�쎌????�곌???
      const userIds = (locationsData || []).map(l => l.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds);

      // memberships 테이블에서 family_role 정보 가져오기
      const { data: membershipsData } = await supabase
        .from('memberships')
        .select('user_id, family_role')
        .eq('group_id', effectiveGroupId)
        .in('user_id', userIds);

      const locationsWithProfiles: LocationInfo[] = (locationsData || []).map(location => {
        const profile = profilesData?.find(p => p.id === location.user_id);
        const membership = membershipsData?.find(m => m.user_id === location.user_id);
        return {
          ...location,
          email: profile?.email || null,
          nickname: profile?.nickname || null,
          familyRole: membership?.family_role || null,
        };
      });

      setLocations(locationsWithProfiles);
    } catch (err: any) {
      console.error('???�쎌??????�쎌?????�≪뮆占????�쎌?�占?', err);
      setError(err.message || '???�쎌??????�쎌?????�쎌�?? ??�쎈?????�쎌???????�쏙??????�쎌?????�쎌???');
    } finally {
      setLoadingData(false);
    }
  }, [effectiveGroupId]);

  // ??�쎈�?????�쏙?????�≪뮆占?(?�밸챶占???�승???�싼?�쁽??
  const loadAnnouncements = useCallback(async () => {
    if (!effectiveGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('???�쎌?�占????�쎌????筌띾?�占???�쎌?�肉????�쎌???? ???�쎌????�≪�????�쏙????????�쎄???');
        setLoadingData(false);
        return;
      }

      const response = await fetch(`/api/group-admin/announcements?group_id=${effectiveGroupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '??�쎈�?????�쏙?????�곌???????�쏙??????�쎌?????�쎌???');
      }

      setAnnouncements(result.data || []);
    } catch (err: any) {
      console.error('??�쎈�?????�쏙?????�≪뮆占????�쎌?�占?', err);
      setError(err.message || '??�쎈�?????�쏙???????�쎈?????�쎌???????�쏙??????�쎌?????�쎌???');
      setAnnouncements([]);
    } finally {
      setLoadingData(false);
    }
  }, [effectiveGroupId]);

  // ??�쎈�??筌뤴뫖占??�≪뮆占?(?�밸챶占???�승???�싼?�쁽??
  const loadSupportTickets = useCallback(async () => {
    if (!effectiveGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('???�쎌?�占????�쎌????筌띾?�占???�쎌?�肉????�쎌???? ???�쎌????�≪�????�쏙????????�쎄???');
        setLoadingData(false);
        return;
      }

      const response = await fetch(`/api/group-admin/support-tickets?group_id=${effectiveGroupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '??�쎈�???�곌???????�쏙??????�쎌?????�쎌???');
      }

      setSupportTickets(result.data || []);
    } catch (err: any) {
      console.error('??�쎈�???�≪뮆占????�쎌?�占?', err);
      setError(err.message || '??�쎈�??�썲????�쎈?????�쎌???????�쏙??????�쎌?????�쎌???');
      setSupportTickets([]);
    } finally {
      setLoadingData(false);
    }
  }, [effectiveGroupId]);

  // 멤버 문의 로드 (그룹 관리자)
  const loadMemberSupportTickets = useCallback(async () => {
    if (!effectiveGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('인증이 필요합니다.');
        setLoadingData(false);
        return;
      }

      const response = await fetch(`/api/group-admin/member-support-tickets?group_id=${effectiveGroupId}`, {
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

      setMemberSupportTickets(result.data || []);
    } catch (err: any) {
      console.error('멤버 문의 로드 오류:', err);
      setError(err.message || '멤버 문의를 불러오지 못했습니다.');
      setMemberSupportTickets([]);
    } finally {
      setLoadingData(false);
    }
  }, [effectiveGroupId]);

  const handleDeleteMemberSupportTicket = async (ticketId: string) => {
    if (!effectiveGroupId) return;
    if (
      !confirm(
        '이 문의를 삭제할까요? 그룹 관리자 삭제는 감사 로그(시스템 관리자 화면)에 기록됩니다.'
      )
    ) {
      return;
    }
    setDeletingMemberTicketId(ticketId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('인증이 필요합니다.');
        return;
      }
      const res = await fetch(
        `/api/support-tickets?id=${encodeURIComponent(ticketId)}&group_id=${encodeURIComponent(effectiveGroupId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : '문의 삭제에 실패했습니다.');
        return;
      }
      setMemberSupportTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch (e) {
      console.error('멤버 문의 삭제 오류:', e);
      alert('문의 삭제에 실패했습니다.');
    } finally {
      setDeletingMemberTicketId(null);
    }
  };

  // ???�쎌??????�쎌?�占?筌뤴뫖占??�≪뮆占?(?�밸챶占???�승???�싼?�쁽??
  const loadAccessRequests = useCallback(async () => {
    if (!effectiveGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('???�쎌?�占????�쎌????筌띾?�占???�쎌?�肉????�쎌???? ???�쎌????�≪�????�쏙????????�쎄???');
        setLoadingData(false);
        return;
      }

      const response = await fetch(`/api/group-admin/dashboard-access-requests?group_id=${effectiveGroupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '???�쎌??????�쎌?�占??�곌???????�쏙??????�쎌?????�쎌???');
      }

      setAccessRequests(result.data || []);
    } catch (err: any) {
      console.error('???�쎌??????�쎌?�占??�≪뮆占????�쎌?�占?', err);
      setError(err.message || '???�쎌??????�쎌?�占????�쎈?????�쎌???????�쏙??????�쎌?????�쎌???');
      setAccessRequests([]);
    } finally {
      setLoadingData(false);
    }
  }, [effectiveGroupId]);

  // ???�궰????????�쎌?????�≪뮆占?
  // 공지사항은 페이지 로드 시 항상 로드 (배너 표시용)
  useEffect(() => {
    if (!isAuthorized || !effectiveGroupId) return;
    loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, effectiveGroupId]);

  // 탭별 데이터 로드
  useEffect(() => {
    if (!isAuthorized || !effectiveGroupId) return;

    if (activeTab === 'dashboard') {
      loadStats();
    } else if (activeTab === 'content') {
      loadPhotos();
      loadLocations();
    } else if (activeTab === 'support-tickets') {
      loadSupportTickets();
    } else if (activeTab === 'member-support-tickets') {
      loadMemberSupportTickets();
    } else if (activeTab === 'dashboard-access-requests') {
      loadAccessRequests();
    } else if (activeTab === 'piggy-archives' && showPiggyArchivesTab) {
      loadPiggyArchivesSnapshots(effectiveGroupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthorized, effectiveGroupId, showPiggyArchivesTab]);

  // ???�쎌?�占?????�쎌�??
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm(gat('confirm_delete_photo'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('memory_vault')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      alert(gat('photo_deleted'));
      loadPhotos();
      loadStats();
    } catch (err: any) {
      console.error('???�쎌?�占?????�쎌�?????�쎌?�占?', err);
      alert(err.message || gat('error_delete_photo'));
    }
  };

  // ?�꺜??????�쏙???�ｅ??
  const filteredPhotos = photos.filter((photo) => {
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
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin" />
          <p className="text-base text-slate-500">{gat('checking_permission')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const adminGroups = groupList.filter((group: any) => {
    const membership = groupMemberships.find((m: any) => m.group_id === group.id);
    return membership?.role === 'ADMIN';
  });
  const canSwitchAdminGroups = adminGroups.length > 1 && !!setCurrentGroupId && !isEmbedded;
  const tabButtonClass = (tab: GroupAdminTabId) =>
    `cursor-pointer border-b-[3px] border-x-0 border-t-0 bg-transparent px-6 py-3 text-base transition-all duration-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
      activeTab === tab
        ? 'border-b-blue-500 font-semibold text-blue-500'
        : 'border-b-transparent font-medium text-slate-500'
    }`;

  return (
    <div
      className="group-admin-page min-h-screen bg-[#f5f7fa] p-5"
    >
      {/* ???�쎌???*/}
      <div className="group-admin-header mb-6 rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500 p-3 text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="m-0 text-2xl font-bold text-slate-800">
                그룹 관리자 페이지
              </h1>
              <p className="m-0 mt-1 text-sm text-slate-500">
                {displayGroupName || gat('group_label')} {gat('group_manage')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isEmbedded && onEmbeddedClose) {
                onEmbeddedClose();
                return;
              }
              router.push('/dashboard');
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
          >
            <X className="h-4 w-4" />
            닫기
          </button>
        </div>

        {canSwitchAdminGroups && (
          <div className="mb-4">
            <div className="mb-1.5 text-xs text-slate-500">
              관리할 그룹 선택
            </div>
            <select
              value={effectiveGroupId || ''}
              onChange={(e) => {
                const nextGroupId = e.target.value;
                if (setCurrentGroupId) {
                  setCurrentGroupId(nextGroupId);
                  setActiveTab('dashboard');
                }
              }}
              className="w-full max-w-80 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-800"
            >
              {adminGroups.map((group: any) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ??筌롫?�??*/}
        <div className="flex flex-wrap gap-2 overflow-x-auto border-b-2 border-slate-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={tabButtonClass('dashboard')}
          >
            <BarChart3 className="mr-2 inline h-[18px] w-[18px] align-middle" />
            대시보드
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={tabButtonClass('members')}
          >
            <Users className="mr-2 inline h-[18px] w-[18px] align-middle" />
            멤버 관리
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={tabButtonClass('settings')}
          >
            <Settings className="mr-2 inline h-[18px] w-[18px] align-middle" />
            그룹 설정
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={tabButtonClass('content')}
          >
            <ImageIcon className="mr-2 inline h-[18px] w-[18px] align-middle" />
            콘텐츠 관리
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`relative ${tabButtonClass('announcements')}`}
          >
            <Megaphone className="mr-2 inline h-[18px] w-[18px] align-middle" />
            {gat('announcements_tab')}
            {announcements.filter(a => !a.is_read).length > 0 && (
              <span className="absolute right-2 top-2 rounded-[10px] bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {announcements.filter(a => !a.is_read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('support-tickets')}
            className={tabButtonClass('support-tickets')}
          >
            <MessageSquare className="mr-2 inline h-[18px] w-[18px] align-middle" />
            문의하기
          </button>
          <button
            onClick={() => setActiveTab('member-support-tickets')}
            className={tabButtonClass('member-support-tickets')}
          >
            <MessageSquare className="mr-2 inline h-[18px] w-[18px] align-middle" />
            멤버 문의
          </button>
          <button
            onClick={() => setActiveTab('dashboard-access-requests')}
            className={tabButtonClass('dashboard-access-requests')}
          >
            <Key className="mr-2 inline h-[18px] w-[18px] align-middle" />
            접근 요청
          </button>
          {showPiggyArchivesTab && (
            <button
              type="button"
              onClick={() => setActiveTab('piggy-archives')}
              className={tabButtonClass('piggy-archives')}
            >
              <PiggyBank className="mr-2 inline h-[18px] w-[18px] align-middle" />
              저금통 보관 내역
            </button>
          )}
        </div>
      </div>

      {/* ??�쎌�??�썲?????�쎌?�占?*/}
      <div className="group-admin-content rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-100 px-4 py-3 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-500">{gat('loading')}</span>
          </div>
        ) : (
          <>
            {/* ?????�쎌??????*/}
            {activeTab === 'dashboard' && stats && (
              <div>
                {/* 공지사항 배너 */}
                <AnnouncementBanner 
                  announcements={announcements.map((announcement) => ({
                    ...announcement,
                    ...getAnnouncementTexts(announcement, lang),
                  }))}
                  label={gat('announcements_tab')}
                  onMarkAsRead={async (announcementId) => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.access_token) return;

                      await fetch('/api/group-admin/announcements', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          announcement_id: announcementId,
                          group_id: effectiveGroupId,
                        }),
                      });

                      loadAnnouncements();
                    } catch (error) {
                      console.error('읽음 처리 오류:', error);
                    }
                  }}
                />

                <h2
                  className={`mb-6 text-[20px] font-semibold text-slate-800 ${
                    announcements.filter(a => !a.is_read).length > 0 ? 'mt-6' : 'mt-0'
                  }`}
                >
                  그룹 통계
                </h2>
                <div className="group-admin-grid grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-sky-200 bg-sky-50 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-sky-700">
                      그룹 멤버
                    </div>
                    <div className="text-[32px] font-bold text-sky-900">
                      {stats.totalMembers}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl border border-amber-200 bg-amber-100 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-amber-800">
                      전체 사진
                    </div>
                    <div className="text-[32px] font-bold text-amber-900">
                      {stats.totalPhotos}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl border border-purple-300 bg-purple-100 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-purple-800">
                      위치 공유
                    </div>
                    <div className="text-[32px] font-bold text-purple-900">
                      {stats.totalLocations}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl border border-pink-200 bg-pink-100 p-6"
                  >
                    <div className="mb-2 text-sm font-medium text-pink-800">
                      최근 사진 (7일)
                    </div>
                    <div className="text-[32px] font-bold text-pink-900">
                      {stats.recentPhotos}
                    </div>
                  </motion.div>
                </div>
              </div>
            )}

            {/* 筌롢?�占???�승?????*/}
            {activeTab === 'members' && (
              <div>
                <MemberManagement onClose={() => setShowMemberManagement(false)} />
              </div>
            )}

            {/* ?�밸챶占????�쎌?????*/}
            {activeTab === 'settings' && (
              <div>
                <GroupSettings
                  onClose={() => setShowGroupSettings(false)}
                  forceAdminAccess={isAuthorized}
                />
              </div>
            )}

            {/* ??�쎌�??�썲????�승?????*/}
            {activeTab === 'content' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-[20px] font-semibold text-slate-800">
                    콘텐츠 관리
                  </h2>
                  <div className="group-admin-search relative w-[300px]">
                    <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={gat('search_photo_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pl-10 text-sm"
                    />
                  </div>
                </div>

                {/* ???�쎌?�占?筌뤴뫖占?*/}
                <div className="mb-8">
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">
                    사진 (${filteredPhotos.length}개)
                  </h3>
                  <div className="group-admin-grid grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {filteredPhotos.map((photo, index) => (
                      <motion.div
                        key={photo.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <img
                          src={photo.image_url || photo.s3_original_url || ''}
                          alt={photo.original_filename || gat('photo_label')}
                          className="mb-2 h-[150px] w-full rounded-lg object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="mb-1 text-xs text-slate-500">
                          {photo.original_filename || gat('no_filename')}
                        </div>
                        <div className="mb-2 text-[11px] text-slate-400">
                          {new Date(photo.created_at).toLocaleDateString('ko-KR')}
                        </div>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border-0 bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800"
                        >
                          <Trash2 className="h-[14px] w-[14px]" />
                          삭제
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  {filteredPhotos.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <ImageIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{gat('no_photos')}</p>
                    </div>
                  )}
                </div>

                {/* ???�쎌??????�쎌????筌뤴뫖占?*/}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">
                    위치 데이터 (${locations.length}개)
                  </h3>
                  <div className="group-admin-grid grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                    {locations.map((location, index) => (
                      <motion.div
                        key={location.user_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <div className="text-sm font-semibold text-slate-800">
                            {location.nickname || location.email || gat('no_name')}
                            {location.familyRole && (
                              <span className="ml-1.5">
                                {getFamilyRoleEmoji(location.familyRole)} {getFamilyRoleLabel(lang, location.familyRole)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mb-1 text-xs text-slate-500">
                          {location.address || `${location.latitude}, ${location.longitude}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                        {new Date(location.last_updated).toLocaleString('ko-KR')}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  {locations.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <MapPin className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{gat('no_locations')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ??�쎈�?????�쏙??????*/}
            {activeTab === 'announcements' && (
              <div>
                <h2 className="mb-6 text-[20px] font-semibold text-slate-800">
                  {gat('announcements_section_unread').replace(/\$\{count\}/g, String(announcements.filter(a => !a.is_read).length))}
                </h2>

                <div className="flex flex-col gap-4">
                  {announcements.map((announcement) => (
                    <motion.div
                      key={announcement.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`cursor-pointer rounded-xl border p-5 ${
                        announcement.is_read
                          ? 'border-slate-200 bg-slate-50'
                          : 'border-amber-200 bg-amber-100'
                      }`}
                      onClick={async () => {
                        if (announcement.is_read) return;

                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session?.access_token) {
                            alert('???�쎌?�占????�쎌???�썲???�쎛????�쎌????????�쎌?????�쎌???');
                            return;
                          }

                          const response = await fetch('/api/group-admin/announcements', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${session.access_token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              announcement_id: announcement.id,
                              group_id: effectiveGroupId,
                            }),
                          });

                          const result = await response.json();

                          if (!response.ok) {
                            throw new Error(result.error || '??�쎈�?? ???�쎌???筌ｌ�??????�쏙??????�쎌?????�쎌???');
                          }

                          loadAnnouncements();
                        } catch (error: any) {
                          console.error('??�쎈�?? ???�쎌???筌ｌ�?????�쎌?�占?', error);
                          alert(error.message || '??�쎈�?? ???�쎌???筌ｌ�???????�쎌?�履?�첎? ?�쏆뮇占???�쎌?????�쎌???');
                        }
                      }}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <h3 className="m-0 text-lg font-semibold text-slate-800">
                              {getAnnouncementTexts(announcement, lang).title || announcement.title}
                            </h3>
                            {!announcement.is_read && (
                              <span className="rounded-xl bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-white">
                                공지
                              </span>
                            )}
                          </div>
                          <p className="m-0 whitespace-pre-wrap text-sm text-slate-500">
                            {getAnnouncementTexts(announcement, lang).content || announcement.content}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">
                        {gat('written_at')} {new Date(announcement.created_at).toLocaleString('ko-KR')}
                      </div>
                    </motion.div>
                  ))}
                  {announcements.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <Megaphone className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{gat('no_announcements')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ??�쎈�????�쎌?�占???*/}
            {activeTab === 'support-tickets' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="m-0 text-[20px] font-semibold text-slate-800">
                      문의하기
                    </h2>
                    <p className="m-0 mt-1.5 text-[13px] text-slate-500">
                      시스템 관리자에게 보내는 문의입니다. 가족 멤버 문의는 &quot;멤버 문의&quot; 탭에서 확인하세요.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowTicketForm(true);
                      setTicketTitle('');
                      setTicketContent('');
                    }}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    시스템 관리자에게 문의
                  </button>
                </div>

                {/* ??�쎈�??筌뤴뫖占?*/}
                <div className="flex flex-col gap-4">
                  {supportTickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-5 ${
                        ticket.status === 'pending'
                          ? 'border-amber-200 bg-amber-100'
                          : 'border-slate-200 bg-slate-50'
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
                              {ticket.status === "pending" ? gat('status_pending') : ticket.status === "answered" ? gat('status_answered') : gat('status_closed')}
                            </span>
                          </div>
                          <p className="m-0 mb-3 whitespace-pre-wrap text-sm text-slate-500">
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
                                entry.role === 'group_admin'
                                  ? 'border-amber-200 bg-amber-50'
                                  : 'border-sky-200 bg-sky-50'
                              }`}
                            >
                              <div
                                className={`mb-1.5 text-xs font-semibold ${
                                  entry.role === 'group_admin' ? 'text-amber-700' : 'text-sky-700'
                                }`}
                              >
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
                        <div className="flex shrink-0 flex-col gap-2">
                          {(ticket.status === 'answered' || ticket.status === 'closed') && ticket.answer && (
                            <button
                              type="button"
                              onClick={() => {
                                setFollowUpForTicket(ticket);
                                setFollowUpBody('');
                              }}
                              className="cursor-pointer whitespace-nowrap rounded-lg border-0 bg-sky-500 px-3 py-2 text-xs font-semibold text-white"
                            >
                              추가 문의
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={deletingSupportTicketId === ticket.id}
                            onClick={async () => {
                              if (!effectiveGroupId) {
                                alert(gat('alert_group_info'));
                                return;
                              }
                              if (!confirm('이 문의를 삭제할까요?')) return;
                              try {
                                setDeletingSupportTicketId(ticket.id);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert(gat('alert_auth'));
                                  return;
                                }
                                const response = await fetch(
                                  `/api/group-admin/support-tickets?id=${encodeURIComponent(ticket.id)}&group_id=${encodeURIComponent(effectiveGroupId)}`,
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
                                setDeletingSupportTicketId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 ${
                              deletingSupportTicketId === ticket.id ? 'cursor-wait' : 'cursor-pointer'
                            }`}
                          >
                            {deletingSupportTicketId === ticket.id ? (
                              <Loader2 className="h-[14px] w-[14px] animate-spin" />
                            ) : (
                              <Trash2 className="h-[14px] w-[14px]" />
                            )}
                            삭제
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">
                        {gat('written_at')} {new Date(ticket.created_at).toLocaleString('ko-KR')}
                        {ticket.answered_at && ` | ${gat('answered_at')} ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {supportTickets.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{gat('no_tickets')}</p>
                    </div>
                  )}
                </div>

                {/* ??�쎈�?????�쎌?�占?筌뤴뫀??*/}
                {showTicketForm && (
                  <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                  onClick={() => setShowTicketForm(false)}
                  >
                    <div
                    className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6"
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-4 text-[20px] font-semibold text-slate-800">
                        문의 작성
                      </h3>
                      <input
                        type="text"
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        placeholder={gat('title_placeholder')}
                        className="mb-4 w-full rounded-lg border border-slate-200 p-3 text-base"
                      />
                      <textarea
                        value={ticketContent}
                        onChange={(e) => setTicketContent(e.target.value)}
                        placeholder={gat('content_placeholder')}
                        className="mb-4 min-h-[300px] w-full rounded-lg border border-slate-200 p-3 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setShowTicketForm(false);
                            setTicketTitle('');
                            setTicketContent('');
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
                        >
                          취소
                        </button>
                        <button
                          onClick={async () => {
                            if (!ticketTitle.trim() || !ticketContent.trim()) {
                              alert(gat('alert_title_content_required'));
                              return;
                            }

                            if (!effectiveGroupId) {
                              alert(gat('alert_group_info'));
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(gat('alert_auth'));
                                return;
                              }

                              const response = await fetch('/api/group-admin/support-tickets', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  group_id: effectiveGroupId,
                                  title: ticketTitle,
                                  content: ticketContent,
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || gat('error_ticket_create'));
                              }

                              alert(gat('ticket_created'));
                              setShowTicketForm(false);
                              setTicketTitle('');
                              setTicketContent('');
                              loadSupportTickets();
                            } catch (error: any) {
                              console.error('??�쎈�?????�쎌?�占????�쎌?�占?', error);
                              alert(error.message || gat('error_ticket_create'));
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white"
                        >
                          작성
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {followUpForTicket && (
                  <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                  onClick={() => {
                    setFollowUpForTicket(null);
                    setFollowUpBody('');
                  }}
                  >
                    <div
                    className="max-h-[80vh] w-[90%] max-w-[560px] overflow-auto rounded-xl bg-white p-6"
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-3 text-lg font-semibold text-slate-800">
                        추가 문의
                      </h3>
                      <p className="mb-3 text-[13px] text-slate-500">
                        {followUpForTicket.title}
                      </p>
                      <textarea
                        value={followUpBody}
                        onChange={(e) => setFollowUpBody(e.target.value)}
                        placeholder="추가로 남길 내용을 입력하세요."
                        className="mb-4 min-h-[160px] w-full rounded-lg border border-slate-200 p-3 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFollowUpForTicket(null);
                            setFollowUpBody('');
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!followUpBody.trim()) {
                              alert('내용을 입력해 주세요.');
                              return;
                            }
                            if (!effectiveGroupId || !followUpForTicket) {
                              alert(gat('alert_group_info'));
                              return;
                            }
                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(gat('alert_auth'));
                                return;
                              }
                              const response = await fetch('/api/group-admin/support-tickets', {
                                method: 'PATCH',
                                headers: {
                                  Authorization: `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  id: followUpForTicket.id,
                                  group_id: effectiveGroupId,
                                  follow_up: followUpBody.trim(),
                                }),
                              });
                              const result = await response.json();
                              if (!response.ok) {
                                throw new Error(result.error || '추가 문의 전송에 실패했습니다.');
                              }
                              setFollowUpForTicket(null);
                              setFollowUpBody('');
                              loadSupportTickets();
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : '추가 문의 전송에 실패했습니다.');
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white"
                        >
                          보내기
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 멤버 문의 (일반멤버 <-> 그룹관리자) */}
            {activeTab === 'member-support-tickets' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-[20px] font-semibold text-slate-800">
                    멤버 문의
                  </h2>
                </div>

                <div className="flex flex-col gap-4">
                  {memberSupportTickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-5 ${
                        ticket.status === 'pending'
                          ? 'border-amber-200 bg-amber-100'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
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
                              {ticket.status === 'pending' ? '대기중' : ticket.status === 'answered' ? '답변완료' : '종료'}
                            </span>
                          </div>
                          <p className="m-0 mb-3 whitespace-pre-wrap text-sm text-slate-500">
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
                          {parseMemberSupportMessageThread(ticket.message_thread).map((entry, idx) => (
                            <div
                              key={`mst-${entry.created_at}-${idx}`}
                              className={`mt-3 rounded-lg border p-3.5 ${
                                entry.role === 'member'
                                  ? 'border-amber-200 bg-amber-50'
                                  : 'border-sky-200 bg-sky-50'
                              }`}
                            >
                              <div
                                className={`mb-1.5 text-xs font-semibold ${
                                  entry.role === 'member' ? 'text-amber-700' : 'text-sky-700'
                                }`}
                              >
                                {entry.role === 'member' ? '추가 문의' : '답변'}
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
                      </div>

                      {ticket.status === 'pending' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingMemberTicket(ticket);
                              setMemberTicketAnswer('');
                            }}
                            className="cursor-pointer rounded-md border-0 bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white"
                          >
                            답변하기
                          </button>
                        </div>
                      )}

                      <div
                        className="mt-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="text-xs text-slate-400">
                          작성일: {new Date(ticket.created_at).toLocaleString('ko-KR')}
                          {ticket.answered_at && ` | 답변일: ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
                        </div>
                        <button
                          type="button"
                          disabled={deletingMemberTicketId === ticket.id}
                          onClick={() => void handleDeleteMemberSupportTicket(ticket.id)}
                          className={`rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ${
                            deletingMemberTicketId === ticket.id ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                          }`}
                        >
                          {deletingMemberTicketId === ticket.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {memberSupportTickets.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>멤버 문의가 없습니다.</p>
                    </div>
                  )}
                </div>

                {editingMemberTicket && (
                  <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                    onClick={() => setEditingMemberTicket(null)}
                  >
                    <div
                      className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-4 text-[20px] font-semibold text-slate-800">
                        답변 작성
                      </h3>
                      {editingMemberTicket && (
                        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-[13px] text-slate-600">
                          <div className="mb-1.5 font-semibold text-slate-800">{editingMemberTicket.title}</div>
                          <div className="mb-2 whitespace-pre-wrap">{editingMemberTicket.content}</div>
                          {editingMemberTicket.answer && (
                            <div className="mt-2 border-t border-slate-200 pt-2">
                              <span className="text-[11px] font-semibold text-sky-700">첫 답변</span>
                              <div className="mt-1 whitespace-pre-wrap">{editingMemberTicket.answer}</div>
                            </div>
                          )}
                          {parseMemberSupportMessageThread(editingMemberTicket.message_thread).map((entry, i) => (
                            <div key={`emt-${i}`} className="mt-2 border-t border-slate-200 pt-2">
                              <span
                                className={`text-[11px] font-semibold ${
                                  entry.role === 'member' ? 'text-amber-700' : 'text-sky-700'
                                }`}
                              >
                                {entry.role === 'member' ? '추가 문의' : '이전 답변'}
                              </span>
                              <div className="mt-1 whitespace-pre-wrap">{entry.body}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <textarea
                        value={memberTicketAnswer}
                        onChange={(e) => setMemberTicketAnswer(e.target.value)}
                        placeholder="답변 내용을 입력하세요"
                        className="mb-4 min-h-[220px] w-full rounded-lg border border-slate-200 p-3 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingMemberTicket(null);
                            setMemberTicketAnswer('');
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
                        >
                          취소
                        </button>
                        <button
                          onClick={async () => {
                            if (!editingMemberTicket || !memberTicketAnswer.trim()) {
                              alert('답변 내용을 입력해주세요.');
                              return;
                            }
                            if (!effectiveGroupId) return;
                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert('인증이 필요합니다.');
                                return;
                              }
                              const response = await fetch('/api/group-admin/member-support-tickets', {
                                method: 'PUT',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  id: editingMemberTicket.id,
                                  group_id: effectiveGroupId,
                                  answer: memberTicketAnswer.trim(),
                                  status: 'answered',
                                }),
                              });
                              const result = await response.json();
                              if (!response.ok) {
                                throw new Error(result.error || '답변 저장에 실패했습니다.');
                              }
                              alert('답변이 저장되었습니다.');
                              setEditingMemberTicket(null);
                              setMemberTicketAnswer('');
                              loadMemberSupportTickets();
                            } catch (e: any) {
                              console.error('멤버 문의 답변 저장 오류:', e);
                              alert(e.message || '답변 저장에 실패했습니다.');
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ???�쎌??????�쎌?�占???*/}
            {activeTab === 'dashboard-access-requests' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="m-0 text-[20px] font-semibold text-slate-800">
                    대시보드 접근 요청
                  </h2>
                  <button
                    onClick={() => {
                      setShowAccessRequestForm(true);
                      setAccessRequestReason('');
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    접근 요청
                  </button>
                </div>

                {/* ???�쎌??????�쎌?�占?筌뤴뫖占?*/}
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
                              {request.status === 'pending'
                                ? gat('status_pending')
                                : request.status === 'approved'
                                  ? gat('status_approved')
                                  : request.status === 'rejected'
                                    ? gat('status_rejected')
                                    : request.status === 'expired'
                                      ? gat('status_expired')
                                      : gat('status_cancelled')}
                            </span>
                          </div>
                          <p className="m-0 mb-3 whitespace-pre-wrap text-sm text-slate-500">
                            {request.reason}
                          </p>
                          {request.status === 'approved' && request.expires_at && (
                            <div className="mb-2 text-sm text-emerald-600">
                              만료일: {new Date(request.expires_at).toLocaleString('ko-KR')}
                            </div>
                          )}
                          {request.status === 'rejected' && request.rejection_reason && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-100 p-3">
                              <div className="mb-1 text-xs font-semibold text-red-800">
                                거절 사유:
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
                              if (!confirm(gat('confirm_cancel_request'))) {
                                return;
                              }

                              try {
                                setLoadingData(true);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert(gat('alert_auth'));
                                  return;
                                }

                                const response = await fetch(`/api/group-admin/dashboard-access-requests?id=${request.id}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || gat('error_request_cancel'));
                                }

                                alert(gat('request_cancelled'));
                                loadAccessRequests();
                              } catch (error: any) {
                                console.error('???�쎌??????�쎌?�占???�썩�?????�쎌?�占?', error);
                                alert(error.message || gat('error_request_cancel'));
                              } finally {
                                setLoadingData(false);
                              }
                            }}
                            className="cursor-pointer rounded-md border-0 bg-red-500 px-4 py-2 text-[13px] font-semibold text-white"
                          >
                            취소
                          </button>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-400">
                        요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                        {request.approved_at && ` | 승인일: ${new Date(request.approved_at).toLocaleString('ko-KR')}`}
                        {request.rejected_at && ` | 거절일: ${new Date(request.rejected_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {accessRequests.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>{gat('no_requests')}</p>
                    </div>
                  )}
                </div>

                {/* ???�쎌??????�쎌?�占????�쎌?�占?筌뤴뫀??*/}
                {showAccessRequestForm && (
                  <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                  onClick={() => setShowAccessRequestForm(false)}
                  >
                    <div
                    className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6"
                    onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-4 text-[20px] font-semibold text-slate-800">
                        대시보드 접근 요청
                      </h3>
                      <p className="mb-4 text-sm text-slate-500">
                        시스템 관리자가 본인 가족 대시보드에 접근하도록 요청합니다.
                      </p>
                      <textarea
                        value={accessRequestReason}
                        onChange={(e) => setAccessRequestReason(e.target.value)}
                        placeholder={gat('reason_placeholder')}
                        className="mb-4 min-h-[200px] w-full rounded-lg border border-slate-200 p-3 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setShowAccessRequestForm(false);
                            setAccessRequestReason('');
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
                        >
                          취소
                        </button>
                        <button
                          onClick={async () => {
                            if (!accessRequestReason.trim()) {
                              alert(gat('alert_reason_required'));
                              return;
                            }

                            if (!effectiveGroupId) {
                              alert(gat('alert_group_info'));
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert(gat('alert_auth'));
                                return;
                              }

                              const response = await fetch('/api/group-admin/dashboard-access-requests', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  group_id: effectiveGroupId,
                                  reason: accessRequestReason,
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || gat('error_request_create'));
                              }

                              alert(gat('request_created'));
                              setShowAccessRequestForm(false);
                              setAccessRequestReason('');
                              loadAccessRequests();
                            } catch (error: any) {
                              console.error('???�쎌??????�쎌?�占????�쎌?�占????�쎌?�占?', error);
                              alert(error.message || gat('error_request_create'));
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          className="cursor-pointer rounded-lg border-0 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white"
                        >
                          요청
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'piggy-archives' && showPiggyArchivesTab && effectiveGroupId && (
              <div>
                <h2 className="mb-6 text-[20px] font-semibold text-slate-800">
                  {atPiggy('piggy_archive_section_title')}
                </h2>
                <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border-b-2 border-slate-200 px-3 py-2.5 text-left">{atPiggy('piggy_archive_deleted_at')}</th>
                        <th className="border-b-2 border-slate-200 px-3 py-2.5 text-left">{atPiggy('nickname')}</th>
                        <th className="border-b-2 border-slate-200 px-3 py-2.5 text-left">{atPiggy('piggy_archive_account_name')}</th>
                        <th className="border-b-2 border-slate-200 px-3 py-2.5 text-left">{atPiggy('piggy_archive_deleted_by')}</th>
                        <th className="border-b-2 border-slate-200 px-3 py-2.5 text-left">{atPiggy('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {piggyArchivesLoading && piggyArchivesSnapshots.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                            {gat('loading')}
                          </td>
                        </tr>
                      ) : piggyArchivesSnapshots.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            {atPiggy('no_piggy_archives')}
                          </td>
                        </tr>
                      ) : (
                        piggyArchivesSnapshots.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="whitespace-nowrap px-3 py-2.5">{new Date(s.deleted_at).toLocaleString('ko-KR')}</td>
                            <td className="px-3 py-2.5">{s.user_nickname}</td>
                            <td className="px-3 py-2.5">{s.account_name || '-'}</td>
                            <td className="px-3 py-2.5">{s.deleted_by_nickname ?? '-'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPiggyArchivesDetailId(s.id);
                                    loadPiggyArchivesDetail(effectiveGroupId, s.id);
                                  }}
                                  className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                                >
                                  {atPiggy('view_transactions_btn')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePiggyArchivesSnapshot(effectiveGroupId, s.id)}
                                  className="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700"
                                >
                                  {atPiggy('archive_delete_btn')}
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
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="m-0 text-base font-semibold">{atPiggy('piggy_archive_transactions_title')}</h3>
                      <button
                        type="button"
                        onClick={() => { setPiggyArchivesDetailId(null); setPiggyArchivesDetail(null); }}
                        className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs"
                      >
                        닫기
                      </button>
                    </div>
                    {piggyArchivesDetailLoading ? (
                      <div className="p-6 text-center text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                        {gat('loading')}
                      </div>
                    ) : piggyArchivesDetail && (piggyArchivesDetail.walletTransactions.length > 0 || piggyArchivesDetail.bankTransactions.length > 0) ? (
                      <>
                        <h4 className="my-2 text-sm text-slate-600">용돈 내역</h4>
                        {piggyArchivesDetail.walletTransactions.length === 0 ? (
                          <p className="m-0 text-[13px] text-slate-400">없음</p>
                        ) : (
                          <table className="mb-4 w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="p-2 text-left">일시</th>
                                <th className="p-2 text-left">유형</th>
                                <th className="p-2 text-right">금액</th>
                                <th className="p-2 text-left">메모</th>
                                <th className="p-2 text-left">행위자</th>
                              </tr>
                            </thead>
                            <tbody>
                              {piggyArchivesDetail.walletTransactions.map((tx) => (
                                <tr key={tx.id} className="border-b border-slate-200">
                                  <td className="p-2">{tx.dateLabel}</td>
                                  <td className="p-2">{tx.typeLabel}</td>
                                  <td className="p-2 text-right">{tx.amount.toLocaleString()}원</td>
                                  <td className="p-2">{tx.memo || '-'}</td>
                                  <td className="p-2">{tx.actor_nickname}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <h4 className="my-2 text-sm text-slate-600">저금통 내역</h4>
                        {piggyArchivesDetail.bankTransactions.length === 0 ? (
                          <p className="m-0 text-[13px] text-slate-400">없음</p>
                        ) : (
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="p-2 text-left">일시</th>
                                <th className="p-2 text-left">유형</th>
                                <th className="p-2 text-right">금액</th>
                                <th className="p-2 text-left">메모</th>
                                <th className="p-2 text-left">행위자</th>
                              </tr>
                            </thead>
                            <tbody>
                              {piggyArchivesDetail.bankTransactions.map((tx) => (
                                <tr key={tx.id} className="border-b border-slate-200">
                                  <td className="p-2">{tx.dateLabel}</td>
                                  <td className="p-2">{tx.typeLabel}</td>
                                  <td className="p-2 text-right">{tx.amount.toLocaleString()}원</td>
                                  <td className="p-2">{tx.memo || '-'}</td>
                                  <td className="p-2">{tx.actor_nickname}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    ) : (
                      <p className="m-0 text-[13px] text-slate-400">{atPiggy('no_transactions')}</p>
                    )}
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


