'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MemberManagement from '@/app/components/MemberManagement';
import GroupSettings from '@/app/components/GroupSettings';

// ?�적 ?�더�?강제
export const dynamic = 'force-dynamic';

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

export default function GroupAdminPage() {
  const router = useRouter();
  
  // 그룹 컨텍?�트?�서 ?�보 가?�오�?(?�전?�게 처리)
  let currentGroupId: string | null = null;
  let currentGroup: any = null;
  let userRole: string | null = null;
  let isOwner = false;
  try {
    const groupContext = useGroup();
    currentGroupId = groupContext.currentGroupId;
    currentGroup = groupContext.currentGroup;
    userRole = groupContext.userRole;
    isOwner = groupContext.isOwner;
  } catch (error) {
    // GroupProvider가 ?�을 ?�는 null�?처리 (빌드 ?�점)
    if (process.env.NODE_ENV === 'development') {
      console.warn('GroupProvider가 ?�습?�다.');
    }
  }
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'settings' | 'content' | 'announcements' | 'support-tickets' | 'dashboard-access-requests'>('dashboard');
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [photos, setPhotos] = useState<PhotoInfo[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 공�??�항, 문의, ?�근 ?�청 관???�태
  const [announcements, setAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketInfo[]>([]);
  const [accessRequests, setAccessRequests] = useState<DashboardAccessRequestInfo[]>([]);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketContent, setTicketContent] = useState('');
  const [accessRequestReason, setAccessRequestReason] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showAccessRequestForm, setShowAccessRequestForm] = useState(false);

  // 그룹 관리자 권한 ?�인
  useEffect(() => {
    const checkGroupAdmin = async () => {
      // ?�라?�언???�이?�에?�만 ?�행
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      if (!currentGroupId) {
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
  }, [currentGroupId, userRole, isOwner, router]);

  // ?�계 ?�이??로드
  const loadStats = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      // 그룹 ?�보 가?�오�?(?�유??ID ?�인??
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', currentGroupId)
        .single();

      // 그룹 멤버 ??
      const { count: memberCount } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', currentGroupId);

      // 그룹 ?�유???�함
      const totalMembers = (memberCount || 0) + 1;

      // 그룹 멤버 ID 목록
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', currentGroupId);

      const memberIds = membersData?.map(m => m.user_id) || [];
      
      // 그룹 ?�유??추�?
      if (groupData?.owner_id && !memberIds.includes(groupData.owner_id)) {
        memberIds.push(groupData.owner_id);
      }

      // 그룹 ?�진 ??
      const { count: photoCount } = await supabase
        .from('memory_vault')
        .select('*', { count: 'exact', head: true })
        .in('uploader_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

      // 최근 7???�진 ??
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentPhotoCount } = await supabase
        .from('memory_vault')
        .select('*', { count: 'exact', head: true })
        .in('uploader_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('created_at', sevenDaysAgo.toISOString());

      // ?�치 ?�이????
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
      console.error('?�계 로드 ?�류:', err);
      setError(err.message || '?�계�?불러?�는???�패?�습?�다.');
    } finally {
      setLoadingData(false);
    }
  }, [currentGroupId]);

  // ?�진 목록 로드
  const loadPhotos = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      // 그룹 ?�보 가?�오�?(?�유??ID ?�인??
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', currentGroupId)
        .single();

      // 그룹 멤버 ID 목록
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', currentGroupId);

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
        .select('id, image_url, cloudinary_url, s3_original_url, original_filename, created_at, uploader_id, caption')
        .in('uploader_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (photosError) throw photosError;

      setPhotos(photosData || []);
    } catch (err: any) {
      console.error('?�진 목록 로드 ?�류:', err);
      setError(err.message || '?�진 목록??불러?�는???�패?�습?�다.');
    } finally {
      setLoadingData(false);
    }
  }, [currentGroupId]);

  // ?�치 ?�이??로드
  const loadLocations = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      // 그룹 ?�보 가?�오�?(?�유??ID ?�인??
      const { data: groupData } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', currentGroupId)
        .single();

      // 그룹 멤버 ID 목록
      const { data: membersData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('group_id', currentGroupId);

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
        .select('user_id, latitude, longitude, address, updated_at')
        .in('user_id', memberIds);

      if (locationsError) throw locationsError;

      // ?�로???�보 조회
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

      setLocations(locationsWithProfiles);
    } catch (err: any) {
      console.error('?�치 ?�이??로드 ?�류:', err);
      setError(err.message || '?�치 ?�이?��? 불러?�는???�패?�습?�다.');
    } finally {
      setLoadingData(false);
    }
  }, [currentGroupId]);

  // 공�??�항 로드 (그룹 관리자??
  const loadAnnouncements = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('?�증 ?�션??만료?�었?�니?? ?�시 로그?�해주세??');
        setLoadingData(false);
        return;
      }

      const response = await fetch('/api/group-admin/announcements', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '공�??�항 조회???�패?�습?�다.');
      }

      setAnnouncements(result.data || []);
    } catch (err: any) {
      console.error('공�??�항 로드 ?�류:', err);
      setError(err.message || '공�??�항??불러?�는???�패?�습?�다.');
      setAnnouncements([]);
    } finally {
      setLoadingData(false);
    }
  }, [currentGroupId]);

  // 문의 목록 로드 (그룹 관리자??
  const loadSupportTickets = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('?�증 ?�션??만료?�었?�니?? ?�시 로그?�해주세??');
        setLoadingData(false);
        return;
      }

      const response = await fetch(`/api/group-admin/support-tickets?group_id=${currentGroupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '문의 조회???�패?�습?�다.');
      }

      setSupportTickets(result.data || []);
    } catch (err: any) {
      console.error('문의 로드 ?�류:', err);
      setError(err.message || '문의�?불러?�는???�패?�습?�다.');
      setSupportTickets([]);
    } finally {
      setLoadingData(false);
    }
  }, [currentGroupId]);

  // ?�근 ?�청 목록 로드 (그룹 관리자??
  const loadAccessRequests = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      setLoadingData(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('?�증 ?�션??만료?�었?�니?? ?�시 로그?�해주세??');
        setLoadingData(false);
        return;
      }

      const response = await fetch(`/api/group-admin/dashboard-access-requests?group_id=${currentGroupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '?�근 ?�청 조회???�패?�습?�다.');
      }

      setAccessRequests(result.data || []);
    } catch (err: any) {
      console.error('?�근 ?�청 로드 ?�류:', err);
      setError(err.message || '?�근 ?�청??불러?�는???�패?�습?�다.');
      setAccessRequests([]);
    } finally {
      setLoadingData(false);
    }
  }, [currentGroupId]);

  // ??변�????�이??로드
  useEffect(() => {
    if (!isAuthorized || !currentGroupId) return;

    if (activeTab === 'dashboard') {
      loadStats();
    } else if (activeTab === 'content') {
      loadPhotos();
      loadLocations();
    } else if (activeTab === 'announcements') {
      loadAnnouncements();
    } else if (activeTab === 'support-tickets') {
      loadSupportTickets();
    } else if (activeTab === 'dashboard-access-requests') {
      loadAccessRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthorized, currentGroupId]);

  // ?�진 ??��
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('?�말�????�진????��?�시겠습?�까?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('memory_vault')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      alert('?�진????��?�었?�니??');
      loadPhotos();
      loadStats();
    } catch (err: any) {
      console.error('?�진 ??�� ?�류:', err);
      alert(err.message || '?�진 ??�� �??�류가 발생?�습?�다.');
    }
  };

  // 검???�터�?
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fa',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#64748b', fontSize: '16px' }}>권한 ?�인 �?..</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f7fa',
      padding: '20px',
    }}>
      {/* ?�더 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: '#3b82f6',
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
                그룹 관리자 ?�이지
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: '4px 0 0 0',
              }}>
                {currentGroup?.name || '그룹'} 관�?
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
            ?�기
          </button>
        </div>

        {/* ??메뉴 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
        }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dashboard' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'dashboard' ? '#3b82f6' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'dashboard' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <BarChart3 style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            ?�?�보??
          </button>
          <button
            onClick={() => setActiveTab('members')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'members' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'members' ? '#3b82f6' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'members' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Users style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            멤버 관�?
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'settings' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'settings' ? '#3b82f6' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'settings' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Settings style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            그룹 ?�정
          </button>
          <button
            onClick={() => setActiveTab('content')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'content' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'content' ? '#3b82f6' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'content' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <ImageIcon style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            콘텐�?관�?
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'announcements' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'announcements' ? '#3b82f6' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'announcements' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            <Megaphone style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            공�??�항
            {announcements.filter(a => !a.is_read).length > 0 && (
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
                {announcements.filter(a => !a.is_read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('support-tickets')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'support-tickets' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'support-tickets' ? '#3b82f6' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'support-tickets' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <MessageSquare style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            문의?�기
          </button>
          <button
            onClick={() => setActiveTab('dashboard-access-requests')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dashboard-access-requests' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'dashboard-access-requests' ? '#3b82f6' : '#64748b',
              fontSize: '16px',
              fontWeight: activeTab === 'dashboard-access-requests' ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Key style={{ width: '18px', height: '18px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            ?�근 ?�청
          </button>
        </div>
      </div>

      {/* 콘텐�??�역 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
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
            <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <span style={{ marginLeft: '12px', color: '#64748b' }}>로딩 �?..</span>
          </div>
        ) : (
          <>
            {/* ?�?�보????*/}
            {activeTab === 'dashboard' && stats && (
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '24px',
                }}>
                  그룹 ?�계
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                }}>
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
                      그룹 멤버
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#0c4a6e',
                    }}>
                      {stats.totalMembers}
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
                      ?�체 ?�진
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#78350f',
                    }}>
                      {stats.totalPhotos}
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
                      ?�치 공유
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#581c87',
                    }}>
                      {stats.totalLocations}
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
                      최근 ?�진 (7??
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#831843',
                    }}>
                      {stats.recentPhotos}
                    </div>
                  </motion.div>
                </div>
              </div>
            )}

            {/* 멤버 관�???*/}
            {activeTab === 'members' && (
              <div>
                <MemberManagement onClose={() => setShowMemberManagement(false)} />
              </div>
            )}

            {/* 그룹 ?�정 ??*/}
            {activeTab === 'settings' && (
              <div>
                <GroupSettings onClose={() => setShowGroupSettings(false)} />
              </div>
            )}

            {/* 콘텐�?관�???*/}
            {activeTab === 'content' && (
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
                    콘텐�?관�?
                  </h2>
                  <div style={{
                    position: 'relative',
                    width: '300px',
                  }}>
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
                      placeholder="?�일�? ?�명?�로 검??.."
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

                {/* ?�진 목록 */}
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '16px',
                  }}>
                    ?�진 ({filteredPhotos.length}�?
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '16px',
                  }}>
                    {filteredPhotos.map((photo, index) => (
                      <motion.div
                        key={photo.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{
                          position: 'relative',
                          padding: '12px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <img
                          src={photo.cloudinary_url || photo.s3_original_url || photo.image_url || ''}
                          alt={photo.original_filename || '?�진'}
                          style={{
                            width: '100%',
                            height: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            marginBottom: '8px',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '4px',
                        }}>
                          {photo.original_filename || '?�름 ?�음'}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          marginBottom: '8px',
                        }}>
                          {new Date(photo.created_at).toLocaleDateString('ko-KR')}
                        </div>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          style={{
                            width: '100%',
                            padding: '6px 12px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                          ??��
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  {filteredPhotos.length === 0 && (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      <ImageIcon style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>?�진???�습?�다.</p>
                    </div>
                  )}
                </div>

                {/* ?�치 ?�이??목록 */}
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '16px',
                  }}>
                    ?�치 ?�이??({locations.length}�?
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px',
                  }}>
                    {locations.map((location, index) => (
                      <motion.div
                        key={location.user_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{
                          padding: '16px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px',
                        }}>
                          <MapPin style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1e293b',
                          }}>
                            {location.nickname || location.email || '?????�음'}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '4px',
                        }}>
                          {location.address || `${location.latitude}, ${location.longitude}`}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                        }}>
                          {new Date(location.updated_at).toLocaleString('ko-KR')}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  {locations.length === 0 && (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      <MapPin style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>?�치 ?�이?��? ?�습?�다.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 공�??�항 ??*/}
            {activeTab === 'announcements' && (
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '24px',
                }}>
                  공�??�항 ({announcements.filter(a => !a.is_read).length}�????�음)
                </h2>

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
                        backgroundColor: announcement.is_read ? '#f8fafc' : '#fef3c7',
                        borderRadius: '12px',
                        border: `1px solid ${announcement.is_read ? '#e2e8f0' : '#fde68a'}`,
                        cursor: 'pointer',
                      }}
                      onClick={async () => {
                        if (announcement.is_read) return;

                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session?.access_token) {
                            alert('?�증 ?�보�?가?�올 ???�습?�다.');
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
                            }),
                          });

                          const result = await response.json();

                          if (!response.ok) {
                            throw new Error(result.error || '공�? ?�음 처리???�패?�습?�다.');
                          }

                          loadAnnouncements();
                        } catch (error: any) {
                          console.error('공�? ?�음 처리 ?�류:', error);
                          alert(error.message || '공�? ?�음 처리 �??�류가 발생?�습?�다.');
                        }
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
                            gap: '8px',
                            marginBottom: '8px',
                          }}>
                            <h3 style={{
                              fontSize: '18px',
                              fontWeight: '600',
                              color: '#1e293b',
                              margin: 0,
                            }}>
                              {announcement.title}
                            </h3>
                            {!announcement.is_read && (
                              <span style={{
                                padding: '2px 8px',
                                backgroundColor: '#fbbf24',
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                              }}>
                                ??공�?
                              </span>
                            )}
                          </div>
                          <p style={{
                            fontSize: '14px',
                            color: '#64748b',
                            margin: 0,
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
                        ?�성?? {new Date(announcement.created_at).toLocaleString('ko-KR')}
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
                      <p>공�??�항???�습?�다.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 문의?�기 ??*/}
            {activeTab === 'support-tickets' && (
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
                    문의?�기
                  </h2>
                  <button
                    onClick={() => {
                      setShowTicketForm(true);
                      setTicketTitle('');
                      setTicketContent('');
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3b82f6',
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
                    ??문의 ?�성
                  </button>
                </div>

                {/* 문의 목록 */}
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
                              {ticket.status === 'pending' ? '?�기�? : ticket.status === 'answered' ? '?��??�료' : '?�힘'}
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
                                ?��?:
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
                        ?�성?? {new Date(ticket.created_at).toLocaleString('ko-KR')}
                        {ticket.answered_at && ` | ?��??? ${new Date(ticket.answered_at).toLocaleString('ko-KR')}`}
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
                      <p>문의가 ?�습?�다.</p>
                    </div>
                  )}
                </div>

                {/* 문의 ?�성 모달 */}
                {showTicketForm && (
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
                  onClick={() => setShowTicketForm(false)}
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
                        ??문의 ?�성
                      </h3>
                      <input
                        type="text"
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        placeholder="?�목???�력?�세??.."
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
                        value={ticketContent}
                        onChange={(e) => setTicketContent(e.target.value)}
                        placeholder="문의 ?�용???�력?�세??.."
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
                            setShowTicketForm(false);
                            setTicketTitle('');
                            setTicketContent('');
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
                            if (!ticketTitle.trim() || !ticketContent.trim()) {
                              alert('?�목�??�용??모두 ?�력?�주?�요.');
                              return;
                            }

                            if (!currentGroupId) {
                              alert('그룹 ?�보�?가?�올 ???�습?�다.');
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert('?�증 ?�보�?가?�올 ???�습?�다.');
                                return;
                              }

                              const response = await fetch('/api/group-admin/support-tickets', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  group_id: currentGroupId,
                                  title: ticketTitle,
                                  content: ticketContent,
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || '문의 ?�성???�패?�습?�다.');
                              }

                              alert('문의가 ?�성?�었?�니??');
                              setShowTicketForm(false);
                              setTicketTitle('');
                              setTicketContent('');
                              loadSupportTickets();
                            } catch (error: any) {
                              console.error('문의 ?�성 ?�류:', error);
                              alert(error.message || '문의 ?�성 �??�류가 발생?�습?�다.');
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          ?�성
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ?�근 ?�청 ??*/}
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
                    ?�?�보???�근 ?�청
                  </h2>
                  <button
                    onClick={() => {
                      setShowAccessRequestForm(true);
                      setAccessRequestReason('');
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3b82f6',
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
                    ???�근 ?�청
                  </button>
                </div>

                {/* ?�근 ?�청 목록 */}
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
                            <span style={{
                              padding: '4px 12px',
                              backgroundColor: request.status === 'pending' ? '#fbbf24' : request.status === 'approved' ? '#10b981' : request.status === 'rejected' ? '#ef4444' : '#94a3b8',
                              color: 'white',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}>
                              {request.status === 'pending' ? '?�기�? : request.status === 'approved' ? '?�인?? : request.status === 'rejected' ? '거절?? : request.status === 'expired' ? '만료?? : '취소??}
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
                              만료?? {new Date(request.expires_at).toLocaleString('ko-KR')}
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
                                거절 ?�유:
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
                              if (!confirm('?�말�????�근 ?�청??취소?�시겠습?�까?')) {
                                return;
                              }

                              try {
                                setLoadingData(true);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  alert('?�증 ?�보�?가?�올 ???�습?�다.');
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
                                  throw new Error(result.error || '?�근 ?�청 취소???�패?�습?�다.');
                                }

                                alert('?�근 ?�청??취소?�었?�니??');
                                loadAccessRequests();
                              } catch (error: any) {
                                console.error('?�근 ?�청 취소 ?�류:', error);
                                alert(error.message || '?�근 ?�청 취소 �??�류가 발생?�습?�다.');
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
                            취소
                          </button>
                        </div>
                      )}
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '12px',
                      }}>
                        ?�청?? {new Date(request.created_at).toLocaleString('ko-KR')}
                        {request.approved_at && ` | ?�인?? ${new Date(request.approved_at).toLocaleString('ko-KR')}`}
                        {request.rejected_at && ` | 거절?? ${new Date(request.rejected_at).toLocaleString('ko-KR')}`}
                      </div>
                    </motion.div>
                  ))}
                  {accessRequests.length === 0 && (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      <Key style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p>?�근 ?�청???�습?�다.</p>
                    </div>
                  )}
                </div>

                {/* ?�근 ?�청 ?�성 모달 */}
                {showAccessRequestForm && (
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
                  onClick={() => setShowAccessRequestForm(false)}
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
                        ?�?�보???�근 ?�청
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: '#64748b',
                        marginBottom: '16px',
                      }}>
                        ?�스??관리자가 본인 가�??�?�보?�에 ?�근?????�도�??�청?�니??
                      </p>
                      <textarea
                        value={accessRequestReason}
                        onChange={(e) => setAccessRequestReason(e.target.value)}
                        placeholder="?�근 ?�청 ?�유�??�력?�세??(?? 기술 지?�이 ?�요?�니?? 문제 ?�결???�요?�니????..."
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
                            setShowAccessRequestForm(false);
                            setAccessRequestReason('');
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
                            if (!accessRequestReason.trim()) {
                              alert('?�근 ?�청 ?�유�??�력?�주?�요.');
                              return;
                            }

                            if (!currentGroupId) {
                              alert('그룹 ?�보�?가?�올 ???�습?�다.');
                              return;
                            }

                            try {
                              setLoadingData(true);
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session?.access_token) {
                                alert('?�증 ?�보�?가?�올 ???�습?�다.');
                                return;
                              }

                              const response = await fetch('/api/group-admin/dashboard-access-requests', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  group_id: currentGroupId,
                                  reason: accessRequestReason,
                                }),
                              });

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || '?�근 ?�청 ?�성???�패?�습?�다.');
                              }

                              alert('?�근 ?�청???�성?�었?�니??');
                              setShowAccessRequestForm(false);
                              setAccessRequestReason('');
                              loadAccessRequests();
                            } catch (error: any) {
                              console.error('?�근 ?�청 ?�성 ?�류:', error);
                              alert(error.message || '?�근 ?�청 ?�성 �??�류가 발생?�습?�다.');
                            } finally {
                              setLoadingData(false);
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          ?�청
                        </button>
                      </div>
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


