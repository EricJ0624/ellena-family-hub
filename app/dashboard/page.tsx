'use client';

// 동적 렌더링 강제 (GroupProvider 의존성 때문에)
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import CryptoJS from 'crypto-js';
import { supabase, clearAuthStorage, AUTH_STORAGE_KEY } from '@/lib/supabase';
import { getValidatedUserWithSessionFallback } from '@/lib/auth-session-resilience';
import { resolveUserHasGroups } from '@/lib/family-auth-routing';
import { useRouter } from 'next/navigation';
import { 
  getPushToken, 
  registerServiceWorker,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking
} from '@/lib/webpush';
import TitlePage, { TitleStyle } from '@/app/components/TitlePage';
import { AppTitleContent } from '@/app/components/AppTitleContent';
import { useGroup } from '@/app/contexts/GroupContext';
import { useAlbum } from '@/app/contexts/AlbumContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getFontStyle } from '@/lib/language-fonts';
import { getCommonTranslation, isDefaultAppTitleText, type CommonTranslations } from '@/lib/translations/common';
import { getDashboardTranslation, type DashboardTranslations } from '@/lib/translations/dashboard';
import { getTravelTranslation, type TravelTranslations } from '@/lib/translations/travel';
import { getGamesTranslation, type GamesTranslations } from '@/lib/translations/games';
import { getOnboardingTranslation } from '@/lib/translations/onboarding';
import { getFamilyRoleEmoji, getFamilyRoleLabel, getMemberManagementTranslation } from '@/lib/translations/memberManagement';
import AnnouncementBanner from '@/app/components/AnnouncementBanner';
import { getAnnouncementTexts } from '@/lib/announcement-i18n';
import { Shield, Calendar, ChevronLeft, ChevronRight, CalendarDays, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { readSeenMemberTicketIds, type MemberSupportTicketRow } from '@/lib/member-support';
import { isValidUUID } from '@/lib/validation';
import {
  type ChatUiMessage,
} from '@/lib/chat-messages';
import {
  deleteAttachment,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';
import { DB_TABLES } from '@/lib/db-table-names';
import { familyChatDebug } from '@/lib/family-chat-debug';
import { FamilyTasksSection } from '@/app/features/family-tasks/components/FamilyTasksSection';
import type { FamilyTask, FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { FamilyCalendarSection } from '@/app/features/family-calendar/components/FamilyCalendarSection';
import type { FamilyEvent } from '@/app/features/family-calendar/types';
import { FamilyChatSection } from '@/app/features/family-chat/components/FamilyChatSection';
import { useFamilyChatActions } from '@/app/features/family-chat/hooks/useFamilyChatActions';
import { useFamilyChatInitialLoad } from '@/app/features/family-chat/hooks/useFamilyChatInitialLoad';
import { useFamilyChatRealtime } from '@/app/features/family-chat/hooks/useFamilyChatRealtime';
import { useFamilyChatScroll } from '@/app/features/family-chat/hooks/useFamilyChatScroll';
import { FamilyLocationSection } from '@/app/features/family-location/components/FamilyLocationSection';
import { FamilyLocationRequestModal } from '@/app/features/family-location/components/FamilyLocationRequestModal';
import { FamilyAlbumSection } from '@/app/features/family-album/components/FamilyAlbumSection';
import { TravelPlannerSection } from '@/app/features/travel-planner/components/TravelPlannerSection';
import { FamilyGamesSection } from '@/app/features/family-games/components/FamilyGamesSection';
import { useTravelTrips } from '@/app/features/travel-planner/hooks/useTravelTrips';
import { PiggyBankSection } from '@/app/features/piggy-bank/components/PiggyBankSection';
import type { AccountRequest, PiggyMemberOrAccount, PiggySummary } from '@/app/features/piggy-bank/types';
import { usePiggyDisplay } from '@/app/features/piggy-bank/hooks/usePiggyDisplay';
import {
  type DashboardWidgetKey,
  type WidgetConfigDraft,
} from '@/lib/widgets/types';
import { ensureWidgetConfigs } from '@/lib/widgets/widget-configs';
import { useDashboardGridLayout } from '@/lib/widgets/use-dashboard-columns';
import {
  resolveWidgetGridPlacement,
  buildWidgetGridItemStyle,
  getSquareCellRowHeight,
  detectGridOverlaps,
  PORTRAIT_COLS,
  LANDSCAPE_COLS,
} from '@/lib/widgets/grid';
import {
  readStoredPreviewOrientation,
  togglePreviewOrientation,
  type AppPreviewOrientation,
} from '@/lib/widgets/preview-orientation';
import { WidgetChrome } from '@/app/components/dashboard/WidgetChrome';
import { WidgetMagnifyModal } from '@/app/components/dashboard/WidgetMagnifyModal';

// --- [CONFIG & SERVICE] 원본 로직 유지 ---
const CONFIG = { STORAGE: 'SFH_DATA_V5', AUTH: 'SFH_AUTH' };

// 사용자·그룹별 저장소 키 (그룹 전환 시 이전 그룹 캐시 복원 방지)
const getStorageKey = (userId: string, groupId?: string | null) =>
  groupId ? `${CONFIG.STORAGE}_${userId}_${groupId}` : `${CONFIG.STORAGE}_${userId}`;
const getAuthKey = (userId: string) => `${CONFIG.AUTH}_${userId}`;

const CryptoService = {
  encrypt: (data: any, key: string) => CryptoJS.AES.encrypt(JSON.stringify(data), key).toString(),
  decrypt: (cipher: string, key: string) => {
    try {
      if (!cipher || !key) return null;
      
      // 암호화된 문자열인지 확인 (Base64 형식)
      if (!cipher.startsWith('U2FsdGVkX1')) {
        // 암호화되지 않은 텍스트일 수 있음
        return cipher;
      }
      
      const bytes = CryptoJS.AES.decrypt(cipher, key);
      const raw = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!raw || raw.length === 0) {
        // 복호화 실패 - 키가 일치하지 않거나 데이터 손상
        return null;
      }
      
      try {
        const parsed = JSON.parse(raw);
        // 문자열이면 문자열로 반환, 객체면 그대로 반환
        return typeof parsed === 'string' ? parsed : parsed;
      } catch (parseError) {
        // JSON 파싱 실패 - 원본 raw 문자열 반환
        return raw;
      }
    } catch (e: any) {
      // Malformed UTF-8 data 오류 처리 (조용히 처리)
      if (e.message?.includes('Malformed UTF-8') || e.message?.includes('UTF-8')) {
        // 개발 환경에서만 로그 출력 (반복 로그 방지)
        return null;
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn('복호화 실패:', e.message || e);
      }
      return null;
    }
  }
};

// --- [SECURITY] 입력 검증 함수 (XSS 방지) ---
const sanitizeInput = (input: string | null | undefined, maxLength: number = 200): string => {
  if (!input) return '';
  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .substring(0, maxLength);
};

// location_requests 레거시/혼용 스키마(target_user_id) 안전 정규화
function normalizeLocationRequestRow(req: any) {
  return {
    ...req,
    target_id: req?.target_id || req?.target_user_id || req?.target?.id || null,
  };
}

// --- [TYPES] 타입 안정성 추가 ---
type Message = ChatUiMessage;
type ChatAttachment = UploadedAttachment;
type Photo = {
  id: number | string; // 로컬 임시 id 또는 Supabase UUID
  data: string; // 리사이징된 이미지 (표시용) 또는 Cloudinary/S3 URL (업로드 완료 시) 또는 플레이스홀더 (큰 파일)
  originalData?: string; // 원본 이미지 (S3 업로드용, 선택적)
  originalSize?: number; // 원본 파일 크기 (bytes)
  originalFilename?: string; // 원본 파일명
  mimeType?: string; // MIME 타입
  supabaseId?: string | number; // Supabase memory_vault ID (업로드 완료 시)
  isUploaded?: boolean; // 업로드 완료 여부
  isUploading?: boolean; // 업로드 진행 중 여부
  created_by?: string; // 생성자 ID
  description?: string; // 사진 설명
};

interface LocationData {
  address: string;
  latitude?: number;
  longitude?: number;
  userId?: string;
  updatedAt?: string;
}

interface AppState {
  familyName: string;
  location: LocationData;
  familyLocations: Array<{
    userId: string;
    userName: string;
    address: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
    familyRole?: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null;
  }>;
  todos: FamilyTask[];
  album: Photo[];
  events: FamilyEvent[];
  messages: Message[];
  titleStyle?: Partial<TitleStyle>;
}

const INITIAL_STATE: AppState = {
  familyName: "",
  location: { address: "", latitude: 0, longitude: 0, userId: "", updatedAt: "" },
  familyLocations: [],
  todos: [],
  album: [],
  events: [],
  messages: [],
  titleStyle: {
    content: "",
    color: '#9333ea',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 0,
    fontFamily: 'Inter',
  }
};

export default function FamilyHub() {
  const router = useRouter();
  // 그룹 컨텍스트에서 현재 그룹 ID 및 권한 정보 가져오기 (안전하게 처리)
  let currentGroupId: string | null = null;
  let groupUserRole: string | null = null;
  let groupIsOwner = false;
  let groupLoading = false;
  let groupList: any[] = [];
  let groupMemberships: any[] = [];
  let setCurrentGroupId: ((groupId: string | null) => void) | null = null;
  let refreshGroups: (() => Promise<void>) | null = null;
  let refreshMemberships: (() => Promise<void>) | null = null;
  let currentGroup: { family_name?: string | null; title_style?: unknown; piggy_currency?: string } | null = null;
  try {
    const groupContext = useGroup();
    currentGroupId = groupContext.currentGroupId;
    currentGroup = groupContext.currentGroup;
    groupUserRole = groupContext.userRole;
    groupIsOwner = groupContext.isOwner;
    groupLoading = groupContext.loading;
    groupList = groupContext.groups || [];
    groupMemberships = groupContext.memberships || [];
    setCurrentGroupId = groupContext.setCurrentGroupId;
    refreshGroups = groupContext.refreshGroups;
    refreshMemberships = groupContext.refreshMemberships;
  } catch (error) {
    // GroupProvider가 없을 때는 null로 처리 (빌드 시점)
    if (process.env.NODE_ENV === 'development') {
      console.warn('GroupProvider가 없습니다. 그룹 필터링이 비활성화됩니다.');
    }
  }
  const { lang } = useLanguage();
  const { album, albumRef } = useAlbum();
  const stableAlbum = useMemo(
    () => (album || []).filter((p) => p?.data && (p.data.startsWith('http://') || p.data.startsWith('https://') || p.data.startsWith('/api/photo/proxy'))),
    [album]
  );
  const dt = (key: keyof DashboardTranslations) => getDashboardTranslation(lang, key);
  const tt = (key: keyof TravelTranslations) => getTravelTranslation(lang, key);
  const gt = (key: keyof GamesTranslations) => getGamesTranslation(lang, key);
  const ct = (key: keyof CommonTranslations) => getCommonTranslation(lang, key);
  const titleFont = useMemo(() => getFontStyle(lang, 'title'), [lang]);
  const bodyFont = useMemo(() => getFontStyle(lang, 'body'), [lang]);

  /** 돋보기 모달 헤더에서 사용하는 위젯별 레이블 맵 */
  const widgetLabelMap = useMemo<Record<DashboardWidgetKey, string>>(
    () => ({
      tasks: dt('todo_section_title'),
      calendar: dt('section_title_calendar'),
      chat: dt('section_title_chat'),
      location: dt('section_title_location'),
      album: dt('section_title_memories'),
      travel: tt('title'),
      piggy: dt('piggy_section_admin_title'),
      games: gt('section_title'),
    }),
    [lang],
  );
  // --- [STATE] ---
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  /** onAuthStateChange 콜백이 오래된 클로저를 쓰지 않도록, 인증 여부는 ref로 동기화 */
  const isAuthenticatedRef = useRef(false);
  const [masterKey, setMasterKey] = useState('');
  const [userId, setUserId] = useState<string>(''); // 사용자 ID 저장
  /** postgres_changes 콜백은 구독 시점 클로저를 쓰므로, 본인 판별·그룹 필터는 항상 최신 값 사용 */
  const dashboardUserIdRef = useRef<string>('');
  const dashboardCurrentGroupIdRef = useRef<string | null>(null);
  dashboardUserIdRef.current = userId;
  dashboardCurrentGroupIdRef.current = currentGroupId;
  const [familyId, setFamilyId] = useState<string>(''); // 가족 ID 저장 (가족 단위 필터링용)
  const [isMounted, setIsMounted] = useState(false);
  const [userName, setUserName] = useState<string>('');
  /** Presence track·목록에서 표시명이 클로저와 어긋나지 않도록 */
  const dashboardUserNameRef = useRef('');
  dashboardUserNameRef.current = userName;
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const [nicknameModalFamilyRole, setNicknameModalFamilyRole] = useState<'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string; isCurrentUser: boolean }>>([]);
  const [isSystemAdmin, setIsSystemAdmin] = useState<boolean>(false);
  const [adminStatusResolved, setAdminStatusResolved] = useState(false);
  const [showSuccessorModal, setShowSuccessorModal] = useState(false);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; email: string; nickname: string | null }>>([]);
  const [selectedSuccessor, setSelectedSuccessor] = useState<string>('');
  const [eventAuthorNames, setEventAuthorNames] = useState<Record<string, string>>({});
  const [familyRoleByUserId, setFamilyRoleByUserId] = useState<Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>>({});
  const [familyTaskMembers, setFamilyTaskMembers] = useState<FamilyTaskMemberOption[]>([]);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  /** saveLocationToSupabase 스로틀에서 클로저 없이 공유 중 여부 참조 */
  const isLocationSharingRef = useRef(false);
  isLocationSharingRef.current = isLocationSharing;
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [piggySummary, setPiggySummary] = useState<PiggySummary | null>(null);
  const [piggyMemberPiggies, setPiggyMemberPiggies] = useState<PiggyMemberOrAccount[] | null>(null);
  const [piggyLoaded, setPiggyLoaded] = useState(false);
  const [pendingAccountRequests, setPendingAccountRequests] = useState<AccountRequest[]>([]);
  const [piggySummaryError, setPiggySummaryError] = useState<string | null>(null);
  const loadPiggySummaryRef = useRef<() => Promise<void>>(async () => {});
  const piggyAccountRequestsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { trips: travelTrips, loading: travelTripsLoading } = useTravelTrips({
    currentGroupId,
    isAuthenticated,
    errorMessage: dt('piggy_travel_fetch_failed'),
  });
  const { piggyLabel, formatAmount: formatDashboardPiggy } = usePiggyDisplay({
    piggySummary,
    fallbackGroupCurrency: currentGroup?.piggy_currency,
    lang,
  });
  const [locationRequests, setLocationRequests] = useState<Array<{
    id: string;
    requester_id: string;
    target_id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    created_at: string;
    expires_at?: string;
    requester?: { id: string; email: string; nickname?: string | null };
    target?: { id: string; email: string; nickname?: string | null };
  }>>([]);
  const [showLocationRequestModal, setShowLocationRequestModal] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<DashboardWidgetKey | null>(null);
  // 모달 닫힘 직후 구독 race condition 방지:
  // tasks/calendar는 컴포넌트 내부에서 Supabase 구독을 관리하므로
  // 모달 언마운트(구독 해제, 비동기)가 완료되기 전에 그리드에서 리마운트하면
  // 동일 채널 이름으로 재구독 시도 → 에러 발생.
  // 250ms 동안 그리드 플레이스홀더를 유지해 해제 완료 후 리마운트하도록 함.
  const [recentlyClosedWidget, setRecentlyClosedWidget] = useState<DashboardWidgetKey | null>(null);
  const recentlyClosedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMagnifyClose = useCallback(() => {
    if (expandedWidget) {
      if (recentlyClosedTimerRef.current) clearTimeout(recentlyClosedTimerRef.current);
      setRecentlyClosedWidget(expandedWidget);
      recentlyClosedTimerRef.current = setTimeout(() => {
        setRecentlyClosedWidget(null);
        recentlyClosedTimerRef.current = null;
      }, 250);
    }
    setExpandedWidget(null);
  }, [expandedWidget]);
  const [selectedUserForRequest, setSelectedUserForRequest] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const loadingUsersRef = useRef(false); // 중복 호출 방지용 ref
  const modalOpenedRef = useRef(false); // 모달이 이미 열렸는지 추적
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfigDraft[]>([]);
  
  // 공지사항 관련 state
  const [announcements, setAnnouncements] = useState<Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
    is_read?: boolean;
  }>>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  
  // Realtime subscription 참조 (로그아웃 시 정리용) - 기능별 분리 관리
  /** Realtime 채널명 재사용 방지(바인딩 중복 방지). 구독 설정 시점마다 갱신 */
  const realtimeSubscriptionIdRef = useRef<number>(0);
  /** ref만 바뀌면 리렌더가 없어 FamilyTasks/Calendar가 `subscriptionId: '0'`에 묶일 수 있음 → Realtime 바인딩 오류 유발. ref와 함께 갱신 */
  const [realtimeSubscriptionEpoch, setRealtimeSubscriptionEpoch] = useState(0);
  /** epoch가 아직 0일 때 자식 훅이 구독을 건너뛰지 않도록 부트스트랩 id (렌더마다 고정) */
  const realtimeBootstrapIdRef = useRef<number | null>(null);
  /** 순차 구독 지연 타이머 정리용 */
  const realtimeStaggerTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  /** 구독 설정 중 플래그 (중복 방지) */
  const isSettingUpSubscriptionsRef = useRef<boolean>(false);
  /** 처리된 메시지 ID 추적 (중복 방지) - 최근 100개만 유지 */
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  const subscriptionsRef = useRef<{
    messages: any;
    tasks: any;
    events: any;
    photos: any;
    presence: any;
    locations: any;
    locationRequests: any;
    attachments: any;
  }>({
    messages: null,
    tasks: null,
    events: null,
    photos: null,
    presence: null,
    locations: null,
    locationRequests: null,
    attachments: null
  });

  // Inputs Ref (Uncontrolled inputs for cleaner handlers similar to original)
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatCameraInputRef = useRef<HTMLInputElement>(null);
  const chatDropRef = useRef<HTMLDivElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const chatScrollRestoreRef = useRef<{ sh: number; st: number } | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const geolocationWatchIdRef = useRef<number | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const lastSentLatRef = useRef<number | null>(null);
  const lastSentLngRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const googleMapsScriptLoadedRef = useRef<boolean>(false); // Google Maps 스크립트 로드 상태 추적
  const processingRequestsRef = useRef<Set<string>>(new Set()); // 처리 중인 요청 ID 추적 (중복 호출 방지)
  const lastLoadedGroupIdRef = useRef<string | null>(null); // 그룹 변경 시 사진 재로드 중복 방지
  const acceptedUserIdsRef = useRef<Set<string>>(new Set()); // 승인된 위치공유 상대 ID (첫 사라짐 방지용, 취소 시에만 제거)
  const updateMapMarkersDebounceRef = useRef<NodeJS.Timeout | null>(null); // 지도 마커 업데이트 디바운스
  const sessionWaitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // 세션 준비 후 위치 로드용
  const locationLoadStartedRef = useRef(false); // 세션 대기 중 중복 run 방지

  // 타이틀 스타일 상태
  const [titleStyle, setTitleStyle] = useState<Partial<TitleStyle>>({
    content: INITIAL_STATE.familyName,
    color: '#9333ea',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 0,
    fontFamily: 'Inter',
  });
  const [chatDragOver, setChatDragOver] = useState(false);
  const [chatAttachmentsByMessage, setChatAttachmentsByMessage] = useState<Record<string, ChatAttachment[]>>({});
  const [chatHasMoreOlder, setChatHasMoreOlder] = useState(false);
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const chatPhotoUploadingRef = useRef(false); // 사진 업로드 중복 방지
  const chatTextSendingRef = useRef(false); // 텍스트 메시지 전송 중복 방지
  /** 연속 채팅 시 memberships/groups/RPC 왕복을 줄이기 위한 짧은 TTL 캐시 (그룹·uid 키) */
  const chatPostPermissionCacheRef = useRef<{ key: string; expiresAt: number } | null>(null);
  const CHAT_POST_PERMISSION_TTL_MS = 25_000;
  const [chatTextSendingUi, setChatTextSendingUi] = useState(false);
  /** Realtime 첨부 핸들러가 항상 최신 loadChatAttachments를 호출하도록 */
  const loadChatAttachmentsRef = useRef<() => Promise<void>>(async () => {});
  const chatAttachmentsLoadGenRef = useRef(0);
  const chatAttachmentsDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 본인 업로드 중 로컬 미리보기(blob URL) */
  const [chatOutgoingPreviews, setChatOutgoingPreviews] = useState<Record<string, string[]>>({});

  // --- [HANDLERS] App 객체 메서드 이식 ---
  
  // 온라인 사용자 목록은 Realtime presence로 관리 (별도 함수 불필요)
  
  // Supabase에서 사진 데이터 불러오기
  const loadPhotosFromSupabase = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        console.warn('loadPhotosFromSupabase: userId가 없습니다.');
        return [];
      }

      // Multi-tenant 아키텍처: group_id 필수 검증
      if (!currentGroupId) {
        console.warn('loadPhotosFromSupabase: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
        return [];
      }

      // 그룹 필터링: Multi-tenant 아키텍처 - group_id로 직접 필터링
      let query = supabase
        .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
        .select('id, image_url, s3_original_url, file_type, original_filename, mime_type, created_at, uploader_id, caption, group_id')
        .eq('group_id', currentGroupId) // Multi-tenant: group_id로 직접 필터링
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: photos, error } = await query;

      if (error) {
        // 에러 객체를 더 자세히 로깅
        const errorMessage = error?.message || '알 수 없는 오류';
        const errorDetails = error?.details || null;
        const errorHint = error?.hint || null;
        const errorCode = error?.code || null;
        
        // 각 속성을 개별적으로 로깅 (직렬화 문제 방지)
        console.error('=== Supabase 사진 불러오기 오류 ===');
        console.error('에러 메시지:', errorMessage);
        console.error('에러 코드:', errorCode);
        console.error('에러 상세:', errorDetails);
        console.error('에러 힌트:', errorHint);
        console.error('사용자 ID:', userId);
        console.error('전체 에러 객체:', error);
        console.error('=====================================');
        
        // 특정 에러 코드에 대한 안내 메시지
        if (errorCode === '42P01') {
          console.error('❌ 테이블이 존재하지 않습니다.');
          console.error('해결 방법: Supabase SQL Editor에서 memory_vault 테이블을 생성하세요.');
          console.error('SQL 파일: supabase_memory_vault_cloudinary_s3.sql');
        } else if (errorCode === '42501') {
          console.error('❌ 권한이 없습니다.');
          console.error('해결 방법: RLS (Row Level Security) 정책을 확인하세요.');
        } else if (errorMessage?.includes('relation') || errorMessage?.includes('does not exist')) {
          console.error('❌ 테이블 또는 컬럼이 존재하지 않습니다.');
          console.error('해결 방법: Supabase SQL Editor에서 테이블을 생성하세요.');
        }
        
        return [];
      }

      if (!photos || photos.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('loadPhotosFromSupabase: 사진이 없습니다.', { userId });
        }
        return [];
      }

      // Photo 형식으로 변환 (URL: image_url 우선, 없으면 s3_original_url)
      return photos.map((photo: any) => ({
        id: photo.id,
        data: photo.image_url || photo.s3_original_url || '',
        supabaseId: photo.id,
        isUploaded: true,
        isUploading: false,
        description: photo.caption || '', // caption만 사용
        originalFilename: photo.original_filename || '',
        mimeType: photo.mime_type || 'image/jpeg',
        created_by: photo.uploader_id || photo.created_by,
      }));
    } catch (error: any) {
      // catch 블록에서도 더 자세한 에러 정보 로깅
      console.error('사진 불러오기 중 예외 발생:', {
        message: error?.message || '알 수 없는 오류',
        stack: error?.stack,
        name: error?.name,
        userId: userId,
        currentGroupId,
      });
      return [];
    }
  }, [userId, currentGroupId]);

  const loadData = useCallback(async (key: string, userId: string) => {
    /** 이 비동기 로드가 시작된 그룹 — 완료 시점에 그룹이 바뀌었으면 적용하지 않음(경쟁으로 타 그룹 사진이 섞이는 것 방지) */
    const groupIdForThisLoad = currentGroupId;
    if (!groupIdForThisLoad) {
      console.warn('loadData: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
      return;
    }

    const isLoadStale = () => groupIdForThisLoad !== dashboardCurrentGroupIdRef.current;

    const storageKey = getStorageKey(userId, groupIdForThisLoad);
    const saved = localStorage.getItem(storageKey);
    
    let localState: AppState | null = null;
    if (saved) {
      const decrypted = CryptoService.decrypt(saved, key);
      if (!decrypted) {
        alert(dt('auth_key_mismatch'));
        return;
      }
      localState = decrypted;
      // decrypted가 문자열 등이면 spread 시 state 오염 → .filter() 등에서 Cannot read 'filter' of undefined 발생 방지
      const isValidState = typeof decrypted === 'object' && decrypted !== null && !Array.isArray(decrypted);
      if (isValidState) {
        const d = decrypted as Record<string, unknown>;
        const stableAlbum = (Array.isArray(d.album))
          ? (d.album as Photo[]).filter((p: Photo) => p?.data && (p.data.startsWith('http://') || p.data.startsWith('https://') || p.data.startsWith('/api/photo/proxy')))
          : [];
        setState({
          familyName: typeof d.familyName === 'string' ? d.familyName : INITIAL_STATE.familyName,
          location: d.location && typeof d.location === 'object' && d.location !== null && !Array.isArray(d.location)
            ? d.location as AppState['location']
            : INITIAL_STATE.location,
          familyLocations: Array.isArray(d.familyLocations) ? d.familyLocations as AppState['familyLocations'] : INITIAL_STATE.familyLocations,
          todos: Array.isArray(d.todos) ? d.todos as AppState['todos'] : INITIAL_STATE.todos,
          album: stableAlbum,
          events: Array.isArray(d.events) ? d.events as AppState['events'] : INITIAL_STATE.events,
          messages: Array.isArray(d.messages) ? d.messages as AppState['messages'] : INITIAL_STATE.messages,
          titleStyle: d.titleStyle && typeof d.titleStyle === 'object' && d.titleStyle !== null
            ? d.titleStyle as AppState['titleStyle']
            : INITIAL_STATE.titleStyle,
        });
        if (d.titleStyle && typeof d.titleStyle === 'object' && d.titleStyle !== null) {
          setTitleStyle(d.titleStyle as Partial<TitleStyle>);
        }
      }
    }
    // ✅ setState(INITIAL_STATE) 제거 - album을 빈 배열로 초기화하지 않음
    // 재로그인 시에도 기존 state를 유지하고, Supabase에서 사진을 로드한 후 업데이트

    // ✅ Supabase에서 사진 불러오기 (Multi-tenant: group_id 필터링)
    try {
      let photos: unknown[] | null = null;
      let error: { message?: string; code?: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (isLoadStale()) return;

        const res = await supabase
          .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
          .select('id, image_url, s3_original_url, file_type, original_filename, mime_type, created_at, uploader_id, caption, group_id')
          .eq('group_id', groupIdForThisLoad)
          .order('created_at', { ascending: false })
          .limit(100);
        error = res.error;
        photos = (res.data as unknown[]) ?? null;
        if (!res.error) break;
        if (process.env.NODE_ENV === 'development') {
          console.warn('[loadData] memory_vault load failed, retry', attempt + 1, res.error?.message, res.error?.code);
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
        }
      }

      if (isLoadStale()) return;

      if (error) {
        console.error('Supabase 사진 로드 오류:', error);
        // ✅ 에러 발생 시에도 state를 업데이트하지 않음 (기존 state 유지)
        // localStorage가 있으면 이미 위에서 setState(decrypted)로 설정됨
        if (!saved) {
          // localStorage도 없으면 빈 배열 유지 (이미 INITIAL_STATE로 초기화됨)
          if (process.env.NODE_ENV === 'development') {
            console.warn('Supabase 사진 로드 실패, localStorage도 없음 - 빈 배열 유지');
          }
        }
      } else if (photos && photos.length > 0) {
        // Photo 형식으로 변환
        const supabasePhotos: Photo[] = photos
          .filter((photo: any) => photo.image_url || photo.s3_original_url)
          .map((photo: any) => ({
            id: photo.id,
            data: photo.image_url || photo.s3_original_url || '',
            supabaseId: photo.id,
            isUploaded: true,
            isUploading: false,
            description: photo.caption || '',
            originalFilename: photo.original_filename || '',
            mimeType: photo.mime_type || 'image/jpeg',
            created_by: photo.uploader_id || photo.created_by,
          }));

        // ✅ 재로그인 시 localStorage가 비어있으면 Supabase 사진만 사용
        // localStorage가 있으면 병합, 없으면 Supabase 사진만 사용
        setState(prev => {
          if (groupIdForThisLoad !== dashboardCurrentGroupIdRef.current) return prev;

          // localStorage에서 직접 사진 데이터 확인 (state 업데이트 지연 문제 해결)
          const storageKeyInner = getStorageKey(userId, groupIdForThisLoad);
          const savedInner = localStorage.getItem(storageKeyInner);
          let localStoragePhotos: Photo[] = [];
          
          if (savedInner) {
            try {
              const decrypted = CryptoService.decrypt(savedInner, key);
              if (decrypted && decrypted.album && Array.isArray(decrypted.album)) {
                localStoragePhotos = decrypted.album;
              }
            } catch (e) {
              // 복호화 실패는 무시
              if (process.env.NODE_ENV === 'development') {
                console.warn('localStorage 사진 복호화 실패:', e);
              }
            }
          }
          
          const supabasePhotoIds = new Set(supabasePhotos.map(p => String(p.id)));
          
          // localStorage에만 있는 사진 (안정 URL만 병합 → blob/data 제외로 Hydration 에러 방지)
          const localStorageOnlyPhotos = localStoragePhotos.filter(p => {
            const supabaseId = p.supabaseId ? String(p.supabaseId) : null;
            if (supabaseId && supabasePhotoIds.has(supabaseId)) {
              return false; // Supabase에 이미 있으면 제외
            }
            return p.data && (p.data.startsWith('http://') || p.data.startsWith('https://') || p.data.startsWith('/api/photo/proxy'));
          });

          // Supabase 사진 우선, localStorage 전용 사진 추가
          const mergedAlbum = [...supabasePhotos, ...localStorageOnlyPhotos];

          if (process.env.NODE_ENV === 'development') {
            console.log('✅ loadData: 사진 병합 완료', {
              supabasePhotos: supabasePhotos.length,
              localStorageOnlyPhotos: localStorageOnlyPhotos.length,
              mergedAlbum: mergedAlbum.length,
              hasLocalStorage: !!savedInner,
              prevAlbumLength: prev.album?.length || 0
            });
          }
          
          return {
            ...prev,
            album: mergedAlbum,
          };
        });
      } else {
        // ✅ Supabase 조회 성공 & 0건: 이 그룹 localStorage의 안정 URL만 앨범에 반영(빈 그룹은 빈 앨범으로 확정)
        if (process.env.NODE_ENV === 'development') {
          console.log('Supabase에 사진이 없습니다.', {
            hasLocalStorage: !!saved,
            willUseLocalStorage: saved !== null
          });
        }
        if (isLoadStale()) return;
        setState((prev) => {
          if (groupIdForThisLoad !== dashboardCurrentGroupIdRef.current) return prev;
          const sk = getStorageKey(userId, groupIdForThisLoad);
          const raw = localStorage.getItem(sk);
          let localStoragePhotos: Photo[] = [];
          if (raw) {
            try {
              const decrypted = CryptoService.decrypt(raw, key);
              if (decrypted && typeof decrypted === 'object' && decrypted !== null && 'album' in decrypted) {
                const al = (decrypted as { album?: unknown }).album;
                if (Array.isArray(al)) localStoragePhotos = al as Photo[];
              }
            } catch {
              /* ignore */
            }
          }
          const stableOnly = localStoragePhotos.filter(
            (p) =>
              p?.data &&
              (p.data.startsWith('http://') || p.data.startsWith('https://') || p.data.startsWith('/api/photo/proxy'))
          );
          return { ...prev, album: stableOnly };
        });
      }
    } catch (supabaseError: any) {
      // Supabase 불러오기 실패해도 localStorage 사진은 사용 가능
      console.warn('Supabase에서 사진 불러오기 실패 (localStorage 사진은 사용 가능):', supabaseError?.message || supabaseError);
      // ✅ 에러 발생 시에도 state를 업데이트하지 않음 (기존 state 유지)
      // localStorage가 있으면 이미 위에서 setState(decrypted)로 설정됨
    }

    if (isLoadStale()) return;

    const authKey = getAuthKey(userId);
    sessionStorage.setItem(authKey, key);
    setIsAuthenticated(true);
  }, [currentGroupId]);

  // ✅ SECURITY: 그룹 전환 시 완전한 데이터 격리 보장
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated || !userId || !currentGroupId) return;
    
    // 그룹이 변경되었는지 확인
    const isGroupChanged = lastLoadedGroupIdRef.current !== currentGroupId;
    
    if (isGroupChanged) {
      // 🔒 CRITICAL: 그룹 전환 시 이전 그룹의 데이터 완전 초기화
      console.log('🔄 그룹 전환 감지 - 데이터 초기화 시작:', {
        previousGroupId: lastLoadedGroupIdRef.current,
        newGroupId: currentGroupId,
        timestamp: new Date().toISOString(),
      });
      setChatHasMoreOlder(false);
      setChatLoadingOlder(false);
      setChatOutgoingPreviews((p) => {
        Object.values(p).flat().forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
      
      // 1. 모든 상태 초기화 (이전 그룹의 데이터 제거)
      setState({
        familyName: INITIAL_STATE.familyName,
        location: INITIAL_STATE.location,
        familyLocations: [],
        todos: [],
        events: [],
        album: [], // 🔒 가장 중요: 이전 그룹의 사진 완전 제거
        messages: [],
        titleStyle: INITIAL_STATE.titleStyle,
      });
      
      // 2. 새 그룹 데이터 로드
      const authKey = getAuthKey(userId);
      const key = masterKey || sessionStorage.getItem(authKey) ||
        process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
      
      lastLoadedGroupIdRef.current = currentGroupId;
      
      // 3. 새 그룹의 데이터 비동기 로드
      loadData(key, userId).catch((error) => {
        console.error('그룹 데이터 로드 실패:', error);
      });
      
      console.log('✅ 그룹 전환 완료 - 데이터 격리 보장됨');
    } else if (!lastLoadedGroupIdRef.current) {
      // 초기 로드
      const authKey = getAuthKey(userId);
      const key = masterKey || sessionStorage.getItem(authKey) ||
        process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
      
      lastLoadedGroupIdRef.current = currentGroupId;
      loadData(key, userId).catch(() => undefined);
    }
  }, [isAuthenticated, userId, currentGroupId, masterKey, loadData]);

  // 닉네임 모달 열릴 때 가족 표시 값을 현재 값으로 초기화
  useEffect(() => {
    if (isNicknameModalOpen && userId) {
      setNicknameModalFamilyRole(familyRoleByUserId[userId] ?? null);
    }
  }, [isNicknameModalOpen, userId, familyRoleByUserId]);

  // --- [EFFECTS] ---
  
  // 1. Mount Check (Next.js Hydration Error 방지)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // 2. Auth Check on Load
  useEffect(() => {
    if (!isMounted) return;
    
    // Supabase 인증 확인
    const checkAuth = async () => {
      try {
        if (typeof window !== 'undefined') {
          try {
            for (const storage of [localStorage, sessionStorage]) {
              const stored = storage.getItem(AUTH_STORAGE_KEY);
              if (stored) {
                try {
                  JSON.parse(stored);
                } catch {
                  storage.removeItem(AUTH_STORAGE_KEY);
                }
              }
            }
          } catch {
            // ignore
          }
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Refresh Token 에러 처리 (만료된 토큰인 경우)
        // 근본 원인 해결: 에러를 조용히 처리하고 localStorage 정리
        if (error) {
          // "Invalid Refresh Token" 또는 "Refresh Token Not Found" 에러인 경우
          if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
            if (typeof window !== 'undefined') {
              clearAuthStorage();
            }
            try {
            await supabase.auth.signOut();
            } catch (signOutError) {
              // signOut 에러는 무시
            }
            router.push('/');
            return;
          }
          // 다른 인증 에러인 경우
          console.error('인증 확인 오류:', error);
          router.push('/');
          return;
        }
        
        if (!session) {
          router.push('/');
          return;
        }

        // 강제탈퇴 등으로 서버(auth.users)에서 삭제된 사용자 검사: getSession()은 로컬 캐시만 반환하므로
        // getUser()로 검증. 모바일에서 일시적 네트워크 실패(Load failed) 시 무한 로그인 루프를 막기 위해 재시도·완화 경로 포함.
        const { user: serverUser, error: userError } = await getValidatedUserWithSessionFallback(
          supabase,
          session
        );
        if (userError || !serverUser) {
          if (typeof window !== 'undefined') clearAuthStorage();
          try { await supabase.auth.signOut(); } catch (_) {}
          router.push('/');
          return;
        }

        const currentUserId = serverUser.id;

        // 시스템 관리자 확인
        const { data: isAdmin } = await supabase.rpc('is_system_admin', {
          user_id_param: currentUserId,
        });

        let { hasGroups } = await resolveUserHasGroups(supabase, currentUserId, {
          flakyRetry: true,
          isSystemAdmin: Boolean(isAdmin),
        });

        // 온보딩에서 ?openGroup= 으로 넘어온 경우: 사용자가 이미 다른 그룹을 가지고 있어도
        // 의도한 그룹으로 정확히 전환되도록 멤버십/소유 여부를 직접 확인해 우선 적용
        if (typeof window !== 'undefined') {
          try {
            const qs = new URLSearchParams(window.location.search);
            const openGroup = qs.get('openGroup')?.trim().toLowerCase() ?? '';
            if (openGroup && isValidUUID(openGroup)) {
              const [mRes, oRes] = await Promise.all([
                supabase
                  .from('memberships')
                  .select('group_id')
                  .eq('user_id', currentUserId)
                  .eq('group_id', openGroup)
                  .maybeSingle(),
                supabase
                  .from('groups')
                  .select('id')
                  .eq('id', openGroup)
                  .eq('owner_id', currentUserId)
                  .maybeSingle(),
              ]);
              if ((!mRes.error && mRes.data) || (!oRes.error && oRes.data)) {
                hasGroups = true;
                try {
                  setCurrentGroupId?.(openGroup);
                } catch (_) {
                  // ignore
                }
                try {
                  localStorage.setItem('currentGroupId', openGroup);
                } catch (_) {
                  // ignore
                }
              }
              window.history.replaceState({}, '', window.location.pathname);
            }
          } catch (_) {
            // ignore
          }
        }

        if (isAdmin && !hasGroups) {
          // 시스템 관리자이고 그룹이 없으면 관리자 페이지로 리다이렉트
          router.push('/admin');
          return;
        }

        if (!isAdmin && !hasGroups) {
          // 일반 사용자이고 그룹이 없으면 온보딩으로 리다이렉트
          router.push('/onboarding');
          return;
        }

        // 그룹·역할 라우팅이 끝난 뒤에만 대시보드 본문을 표시(잠깐 보였다가 온보딩으로 튀는 현상 방지)
        setIsAuthenticated(true);
        setUserId(currentUserId);
        dashboardUserIdRef.current = currentUserId;

        // family_id 가져오기 (user_metadata에서 가져오거나 기본값 사용)
        // 모든 가족 구성원이 동일한 family_id를 공유하도록 설정
        const userFamilyId = session.user.user_metadata?.family_id 
          || process.env.NEXT_PUBLIC_FAMILY_ID 
          || 'ellena_family'; // 기본 family_id
        setFamilyId(userFamilyId);

        // 사용자 이름 가져오기 (profiles 테이블의 nickname 우선, 없으면 user_metadata)
        if (session.user) {
          // 먼저 profiles 테이블에서 nickname 조회
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', currentUserId)
            .maybeSingle();

          const name = profileData?.nickname
            || session.user.user_metadata?.nickname
            || session.user.user_metadata?.full_name 
            || session.user.user_metadata?.name 
            || session.user.email?.split('@')[0] 
            || '사용자';
          setUserName(name);

          // profiles 테이블에 nickname이 없고 user_metadata에 있으면 동기화
          if (!profileData?.nickname && session.user.user_metadata?.nickname) {
            await supabase
              .from('profiles')
              .upsert({ 
                id: currentUserId,
                nickname: session.user.user_metadata.nickname,
                email: session.user.email || ''
              }, {
                onConflict: 'id'
              });
          }
        }
        
        // 가족 공유 마스터 키 확인 및 데이터 로드
        // 모든 가족 구성원이 동일한 키를 사용하여 데이터 공유 가능
        // 재로그인 시에도 항상 가족 공유 키 사용 (기존 sessionStorage 키 무시)
        const authKey = getAuthKey(currentUserId);
        // 항상 가족 공유 키 사용 (기존 sessionStorage 키는 무시하여 모든 사용자가 동일한 키 사용)
        const key = process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
        setMasterKey(key);
        sessionStorage.setItem(authKey, key); // 가족 공유 키로 덮어쓰기
        
        // user_metadata에서 타이틀 스타일 불러오기
        if (session.user.user_metadata?.titleStyle) {
          setTitleStyle(session.user.user_metadata.titleStyle);
        }

        // loadData는 currentGroupId가 있어야 memory_vault 등 멀티테넌트 조회가 의미 있음.
        // 여기서 호출하면 그룹 로드 전에 경고만 나고 HTTP만 낭비됨 → 그룹 effect(전환/초기)에서만 loadData 호출.
      } catch (err) {
        console.error('checkAuth 예외:', err);
        router.push('/');
      }
    };
    
    checkAuth();
    
    // 인증 상태 변경 리스너 (Refresh Token 에러 감지)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (process.env.NODE_ENV === 'development') {
          console.log('인증 상태 변경:', event);
        }
      }
      
      // Refresh Token 에러가 발생한 경우 자동 로그아웃
      if (event === 'SIGNED_OUT' && !session) {
        // 세션이 없으면 로그인 페이지로 리다이렉트
        if (isAuthenticatedRef.current) {
          router.push('/');
        }
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
    // isAuthenticated는 제외: true가 되면 effect가 재실행되며 checkAuth가 중복 실행되어 세션/라우팅 경쟁이 날 수 있음
  }, [isMounted, router]);

  // Piggy Bank 요약 정보 로드 함수 (재사용 가능하도록 useCallback으로 분리)
  const loadPiggySummary = useCallback(async () => {
    if (!isAuthenticated || !currentGroupId) {
      setPiggySummary(null);
      setPiggyMemberPiggies(null);
      setPiggyLoaded(false);
      return;
    }

    try {
      setPiggySummaryError(null);
      setPiggyLoaded(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setPiggyLoaded(true);
        return;
      }

      const response = await fetch(`/api/piggy-bank/summary?group_id=${currentGroupId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Piggy Bank 요약 정보를 불러오지 못했습니다.');
      }

      setPiggyLoaded(true);
      if (result.data?.memberPiggies && Array.isArray(result.data.memberPiggies)) {
        setPiggyMemberPiggies(result.data.memberPiggies);
        setPendingAccountRequests(Array.isArray(result.data.pendingAccountRequests) ? result.data.pendingAccountRequests : []);
        setPiggySummary(null);
      } else if (result.data?.account) {
        setPiggySummary({
          name: result.data.account.name || 'Ellena Piggy Bank',
          walletBalance: result.data.wallet?.balance ?? 0,
          bankBalance: result.data.account.balance ?? 0,
          ownerNickname: result.data.account.ownerNickname || null,
          currency: result.data.account.currency,
        });
        setPiggyMemberPiggies(null);
        setPendingAccountRequests([]);
      } else {
        setPiggySummary(null);
        setPiggyMemberPiggies(null);
        setPendingAccountRequests([]);
      }
    } catch (err: any) {
      setPiggySummaryError(err.message || 'Piggy Bank 정보를 불러오지 못했습니다.');
      setPiggyLoaded(true);
    }
  }, [isAuthenticated, currentGroupId]);

  loadPiggySummaryRef.current = loadPiggySummary;

  // Piggy Bank 요약 정보 로드 (그룹 선택 시)
  useEffect(() => {
    loadPiggySummary();
  }, [loadPiggySummary]);

  // 대시보드 Piggy: 저금통 생성 요청 + 잔액·거래 실시간 (그룹 전 멤버)
  // - 멤버 INSERT → 관리자 pending 목록 갱신(RLS로 관리자만 타인 요청 SELECT 가능, Realtime 동일)
  // - 관리자 UPDATE(승인/거절) → 멤버 pendingAccountRequest 갱신
  // - 계정/지갑 DELETE·변경 → 상대 화면 요약 갱신
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated || !currentGroupId) return;

    const gid = currentGroupId;
    const schedulePiggySummaryReload = () => {
      if (piggyAccountRequestsDebounceRef.current) {
        clearTimeout(piggyAccountRequestsDebounceRef.current);
      }
      piggyAccountRequestsDebounceRef.current = setTimeout(() => {
        piggyAccountRequestsDebounceRef.current = null;
        void loadPiggySummaryRef.current();
      }, 220);
    };

    const channels: ReturnType<typeof supabase.channel>[] = [];

    const chAccountRequests = supabase
      .channel(`dashboard_piggy_account_requests:${gid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'piggy_account_requests',
          filter: `group_id=eq.${gid}`,
        },
        () => schedulePiggySummaryReload()
      )
      .subscribe((status, err) => {
        if (err && process.env.NODE_ENV === 'development') {
          console.warn('저금통 생성 요청 Realtime:', err);
        }
        if (process.env.NODE_ENV === 'development' && status === 'SUBSCRIBED') {
          console.log('✅ dashboard piggy_account_requests Realtime 구독됨');
        }
      });
    channels.push(chAccountRequests);

    const chAccounts = supabase
      .channel(`dashboard_piggy_bank_accounts:${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_bank_accounts', filter: `group_id=eq.${gid}` },
        () => schedulePiggySummaryReload()
      )
      .subscribe();
    channels.push(chAccounts);

    const chWallets = supabase
      .channel(`dashboard_piggy_wallets:${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_wallets', filter: `group_id=eq.${gid}` },
        () => schedulePiggySummaryReload()
      )
      .subscribe();
    channels.push(chWallets);

    const chOpenReq = supabase
      .channel(`dashboard_piggy_open_requests:${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_open_requests', filter: `group_id=eq.${gid}` },
        () => schedulePiggySummaryReload()
      )
      .subscribe();
    channels.push(chOpenReq);

    const chWalletTx = supabase
      .channel(`dashboard_piggy_wallet_transactions:${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_wallet_transactions', filter: `group_id=eq.${gid}` },
        () => schedulePiggySummaryReload()
      )
      .subscribe();
    channels.push(chWalletTx);

    const chBankTx = supabase
      .channel(`dashboard_piggy_bank_transactions:${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piggy_bank_transactions', filter: `group_id=eq.${gid}` },
        () => schedulePiggySummaryReload()
      )
      .subscribe();
    channels.push(chBankTx);

    return () => {
      if (piggyAccountRequestsDebounceRef.current) {
        clearTimeout(piggyAccountRequestsDebounceRef.current);
        piggyAccountRequestsDebounceRef.current = null;
      }
      channels.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [isAuthenticated, currentGroupId]);

  // 관리자: 대시보드에서 멤버에게 저금통 추가
  const handleDashboardAddPiggy = useCallback(async (childId: string) => {
    if (!currentGroupId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch('/api/piggy-bank/accounts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: currentGroupId, childId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || dt('piggy_add_failed'));
      await loadPiggySummary();
    } catch (err: any) {
      setPiggySummaryError(err.message || dt('piggy_add_failed'));
    }
  }, [currentGroupId, loadPiggySummary]);

  // 멤버: 저금통 생성 요청
  const handlePiggyRequestAccount = useCallback(async () => {
    if (!currentGroupId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch('/api/piggy-bank/request-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: currentGroupId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || dt('piggy_request_failed'));
      alert(result.message || dt('piggy_request_delivered'));
    } catch (err: any) {
      setPiggySummaryError(err.message || dt('piggy_request_failed'));
    }
  }, [currentGroupId]);

  // 관리자: 저금통 생성 요청 승인
  const handleApproveAccountRequest = useCallback(async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch('/api/piggy-bank/request-account/approve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || dt('piggy_approve_failed'));
      await loadPiggySummary();
    } catch (err: any) {
      setPiggySummaryError(err.message || dt('piggy_approve_failed'));
    }
  }, [loadPiggySummary]);

  // 관리자: 저금통 생성 요청 거절
  const handleRejectAccountRequest = useCallback(async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch('/api/piggy-bank/request-account/reject', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || dt('piggy_reject_failed'));
      await loadPiggySummary();
    } catch (err: any) {
      setPiggySummaryError(err.message || dt('piggy_reject_failed'));
    }
  }, [loadPiggySummary]);

  // 관리자: 저금통 삭제
  const handleDashboardDeletePiggy = useCallback(async (childId: string) => {
    if (!currentGroupId || !confirm(dt('piggy_delete_confirm'))) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch(`/api/piggy-bank/accounts?groupId=${encodeURIComponent(currentGroupId)}&childId=${encodeURIComponent(childId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || dt('piggy_delete_failed'));
      await loadPiggySummary();
    } catch (err: any) {
      setPiggySummaryError(err.message || dt('piggy_delete_failed'));
    }
  }, [currentGroupId, loadPiggySummary]);

  // 2.4.5. state가 로드되면 titleStyle 동기화
  useEffect(() => {
    if (state.titleStyle) {
      setTitleStyle(state.titleStyle);
    } else if (state.familyName && !state.titleStyle) {
      // titleStyle이 없지만 familyName이 있으면 기본값으로 초기화 (기존 데이터 호환성)
      setTitleStyle({
        content: state.familyName,
        color: '#9333ea',
        fontSize: 48,
        fontWeight: '700',
        letterSpacing: 0,
        fontFamily: 'Inter',
      });
    }
  }, [state.titleStyle, state.familyName]);

  // 그룹에 저장된 title_style이 있으면 우선 사용, 없으면 state/기본값
  const effectiveTitleStyle = useMemo((): Partial<TitleStyle> => {
    const raw = currentGroup?.title_style;
    if (raw && typeof raw === 'object' && 'color' in (raw as object)) {
      const o = raw as Record<string, unknown>;
      const content = (typeof o.content === 'string' ? o.content : null)
        ?? currentGroup?.family_name?.trim()
        ?? state.familyName
        ?? titleStyle?.content
        ?? ct('app_title');
      return {
        content,
        color: typeof o.color === 'string' ? o.color : '#9333ea',
        fontSize: typeof o.fontSize === 'number' ? o.fontSize : 48,
        fontWeight: typeof o.fontWeight === 'string' ? o.fontWeight : '700',
        letterSpacing: typeof o.letterSpacing === 'number' ? o.letterSpacing : 0,
        fontFamily: typeof o.fontFamily === 'string' ? o.fontFamily : 'Inter',
      };
    }
    return {
      ...INITIAL_STATE.titleStyle,
      ...titleStyle,
      content: currentGroup?.family_name?.trim() || state.familyName || titleStyle?.content || ct('app_title'),
    };
  }, [currentGroup?.title_style, currentGroup?.family_name, state.familyName, titleStyle, ct]);

  const rawDashboardTitle =
    effectiveTitleStyle?.content || currentGroup?.family_name?.trim() || state.familyName || ct('app_title');
  // 그룹에 저장된 기본 타이틀이 다른 언어(예: 영문)로만 저장된 경우에도 현재 UI 언어로 표시
  const dashboardTitleText = isDefaultAppTitleText(rawDashboardTitle) ? ct('app_title') : rawDashboardTitle;
  const isDefaultDashboardTitle = isDefaultAppTitleText(rawDashboardTitle);
  // 가용 폭: main-content 패딩(16px×2) + 행 px-1(4px×2) + 버튼(76px) + gap(12px)
  //   → iPhone 14(390px) 관리자 262px / 일반 사용자 350px 기준
  // 언어별 타이틀 폭 인수 (폰트: en=Inter, ko=Pretendard, ja=Pretendard JP, zh=Noto Sans SC/TC)
  //   en 6.15×F, ko 7.82×F(Pretendard Hangul ~0.85em), ja 9.48×F(풀-width 카타카나 1.0em), zh 8.0×F
  //   → 가용 폭 ÷ 인수 = 최솟값 (iPhone 14 기준)
  // 커스텀 폰트 크기는 clamp의 상한(max)으로 사용 — 원래 fit 알고리즘의 상한 역할과 동일
  const TITLE_FONT_MIN = {
    admin: { en: 40, ko: 33, ja: 27, 'zh-CN': 32, 'zh-TW': 32 },
    user:  { en: 54, ko: 44, ja: 36, 'zh-CN': 43, 'zh-TW': 43 },
  } as const;
  const isAdminTitleContext = isSystemAdmin || ((groupUserRole === 'ADMIN' || groupIsOwner) && currentGroupId !== null);
  const customFontSizeCap = typeof effectiveTitleStyle?.fontSize === 'number' ? effectiveTitleStyle.fontSize : null;
  const titleRole = isAdminTitleContext ? 'admin' : 'user';
  const titleFontMin = (TITLE_FONT_MIN[titleRole] as Record<string, number>)[lang] ?? TITLE_FONT_MIN[titleRole].en;
  const titleVw = isAdminTitleContext ? 7 : 9;
  const dashboardMainContentStyle = {
    ['--dashboard-body-font' as any]: bodyFont.fontFamily,
  } as React.CSSProperties;

  // Family Calendar: 해당 월의 달력 그리드 (날짜 + 일정 개수)
  // 반복 일정 포함해 해당 날짜에 표시될지 여부

  // 2.5. Web Push 및 백그라운드 위치 추적 초기화 (Supabase만 사용)
  useEffect(() => {
    if (!isMounted || !isAuthenticated || !userId) return;

    let pushTokenRegistered = false;

    const initializeWebPush = async () => {
      try {
        // Service Worker 등록
        const registration = await registerServiceWorker();
        if (!registration) {
          console.warn('Service Worker 등록 실패 - 백그라운드 기능이 제한될 수 있습니다.');
          return;
        }

        // Web Push 토큰 가져오기
        const token = await getPushToken();
        if (!token) {
          console.warn('Web Push 토큰을 가져올 수 없습니다 - 푸시 알림이 작동하지 않을 수 있습니다.');
          return;
        }

        // Push 토큰을 Supabase에 등록
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            console.warn('Push 토큰 등록: 인증 세션이 없습니다.');
            return;
          }

          const deviceInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            timestamp: new Date().toISOString()
          };

          const response = await fetch('/api/push/register-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userId: userId,
              token: token,
              deviceInfo: deviceInfo
            }),
          });

          if (response.ok) {
            console.log('Web Push 토큰 등록 성공');
            pushTokenRegistered = true;
          } else {
            console.error('Web Push 토큰 등록 실패:', await response.text());
          }
        } catch (error) {
          console.error('Web Push 토큰 등록 중 오류:', error);
        }

        // Service Worker에서 위치 업데이트 메시지 수신 처리
        if (registration) {
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'LOCATION_UPDATE') {
              const { latitude, longitude, accuracy, timestamp } = event.data.data;
              console.log('Service Worker에서 위치 업데이트 수신:', { latitude, longitude, accuracy });
              
              // 위치 업데이트 (기존 updateLocation 로직 재사용)
              if (userId) {
                updateLocationFromServiceWorker(latitude, longitude, accuracy);
              }
            }
          });
        }

        // 위치 공유가 활성화되어 있으면 백그라운드 위치 추적 시작
        if (isLocationSharing) {
          startBackgroundLocationTracking();
        }
      } catch (error) {
        console.error('Web Push 초기화 오류:', error);
      }
    };

    initializeWebPush();

    // 정리 함수: 로그아웃 시 Push 토큰 삭제 및 백그라운드 추적 중지
    return () => {
      if (pushTokenRegistered && userId) {
        // 로그아웃 시 토큰 삭제는 handleLogout에서 처리
        stopBackgroundLocationTracking();
      }
    };
  }, [isMounted, isAuthenticated, userId, isLocationSharing]);

  // Service Worker에서 받은 위치 업데이트 처리 함수
  const updateLocationFromServiceWorker = async (latitude: number, longitude: number, accuracy: number) => {
    if (!userId || !isAuthenticated) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    try {
      // Geocoding 미사용 — 좌표만으로 위치 공유
      const currentAddress = state.location.address || '';

      setState(prev => ({
        ...prev,
        location: {
          address: currentAddress,
          latitude: latitude,
          longitude: longitude,
          userId: userId,
          updatedAt: new Date().toISOString()
        }
      }));

      // Supabase에 위치 저장 (일관된 형식으로) — group_id 누락 시 그룹 기반 RLS에서 상대 SELECT 불가
      try {
        const groupIdForRow = dashboardCurrentGroupIdRef.current;
        const row: Record<string, unknown> = {
          user_id: userId,
          latitude: latitude,
          longitude: longitude,
          address: currentAddress,
          last_updated: new Date().toISOString(),
        };
        if (groupIdForRow) {
          row.group_id = groupIdForRow;
        }
        const { error } = await supabase
          .from('user_locations')
          .upsert(row as any, {
            onConflict: 'user_id'
          });

        if (error) {
          console.warn('위치 저장 오류:', error);
        }
      } catch (dbError: any) {
        console.warn('위치 저장 시도 중 오류:', dbError);
      }
    } catch (error) {
      console.error('Service Worker 위치 업데이트 처리 오류:', error);
    }
  };

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  useFamilyChatScroll({
    messages: state.messages,
    isAuthenticated,
    currentGroupId,
    chatBoxRef,
    chatScrollRestoreRef,
  });

  // ✅ 지도 마커 업데이트 함수 (재사용 가능, useCallback으로 외부에서도 호출 가능)
  // AdvancedMarkerElement 사용으로 deprecated 경고 해결
  const updateMapMarkers = useCallback(() => {
    console.log('🗺️ [updateMapMarkers] 시작');
    console.log('🗺️ [updateMapMarkers] state.familyLocations:', state.familyLocations?.length, '개');
    console.log('🗺️ [updateMapMarkers] acceptedUserIdsRef:', Array.from(acceptedUserIdsRef.current));
    
    if (!mapRef.current || typeof window === 'undefined' || !(window as any).google) {
      console.log('❌ [updateMapMarkers] map, window 또는 google 없음');
      return;
    }

    try {
      const google = (window as any).google;
      const { AdvancedMarkerElement, PinElement} = google.maps.marker || {};

      // AdvancedMarkerElement가 사용 가능한지 확인
      const useAdvancedMarker = AdvancedMarkerElement && PinElement;

      // 현재 위치 마커 업데이트 또는 생성
      if (state.location.latitude && state.location.longitude) {
        const existingMyMarker = markersRef.current.get('my-location');
        if (existingMyMarker) {
          // 기존 마커 위치 업데이트
          if (useAdvancedMarker && existingMyMarker.position) {
            existingMyMarker.position = { lat: state.location.latitude, lng: state.location.longitude };
          } else if (existingMyMarker.setPosition) {
            existingMyMarker.setPosition({ lat: state.location.latitude, lng: state.location.longitude });
          }
          // AdvancedMarkerElement는 content를 업데이트해야 함
          if (useAdvancedMarker && existingMyMarker.content) {
            const pinElement = new PinElement({
              background: '#4285F4',
              borderColor: '#ffffff',
              glyphColor: '#ffffff',
              scale: 1.2
            });
            const labelDiv = document.createElement('div');
            labelDiv.textContent = userName || ct('me');
            labelDiv.style.color = '#ffffff';
            labelDiv.style.fontSize = '12px';
            labelDiv.style.fontWeight = 'bold';
            labelDiv.style.textAlign = 'center';
            labelDiv.style.marginTop = '4px';
            const container = document.createElement('div');
            container.appendChild(pinElement.element);
            container.appendChild(labelDiv);
            existingMyMarker.content = container;
          } else if (existingMyMarker.setLabel) {
            existingMyMarker.setLabel({
              text: userName || ct('me'),
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold'
            });
          }
        } else {
          // 새 마커 생성
          let myMarker;
          if (useAdvancedMarker) {
            const pinElement = new PinElement({
              background: '#4285F4',
              borderColor: '#ffffff',
              glyphColor: '#ffffff',
              scale: 1.2
            });
            const labelDiv = document.createElement('div');
            labelDiv.textContent = userName || ct('me');
            labelDiv.style.color = '#ffffff';
            labelDiv.style.fontSize = '12px';
            labelDiv.style.fontWeight = 'bold';
            labelDiv.style.textAlign = 'center';
            labelDiv.style.marginTop = '4px';
            const container = document.createElement('div');
            container.appendChild(pinElement.element);
            container.appendChild(labelDiv);
            myMarker = new AdvancedMarkerElement({
              map: mapRef.current,
              position: { lat: state.location.latitude, lng: state.location.longitude },
              title: `${userName || dt('location_my')} ${dt('location_word')}`,
              content: container
            });
          } else {
            // 폴백: 기존 Marker API 사용
            myMarker = new google.maps.Marker({
              position: { lat: state.location.latitude, lng: state.location.longitude },
              map: mapRef.current,
              title: `${userName || dt('location_my')} ${dt('location_word')}`,
              label: {
                text: userName || ct('me'),
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
              },
              icon: {
                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
              }
            });
          }
          markersRef.current.set('my-location', myMarker);
        }
      } else {
        // 위치가 없으면 본인 위치 마커 제거
        const existingMyMarker = markersRef.current.get('my-location');
        if (existingMyMarker) {
          if (useAdvancedMarker && existingMyMarker.map) {
            existingMyMarker.map = null;
          } else if (existingMyMarker.setMap) {
            existingMyMarker.setMap(null);
          }
          markersRef.current.delete('my-location');
        }
      }

      // 가족 표시 역할별 마커 색/크기: 엄마=빨강, 아빠=파랑, 딸=빨강 아이, 아들=파랑 아이, 할아버지=주황, 할머니=보라, 기타=회색
      const getFamilyMarkerStyle = (role: string | null | undefined) => {
        switch (role) {
          case 'mom': return { background: '#EA4335', scale: 1.2 };
          case 'dad': return { background: '#4285F4', scale: 1.2 };
          case 'daughter': return { background: '#EA4335', scale: 0.95 };
          case 'son': return { background: '#4285F4', scale: 0.95 };
          case 'grandpa': return { background: '#FBBC04', scale: 1.1 };
          case 'grandma': return { background: '#9C27B0', scale: 1.1 };
          default: return { background: '#9E9E9E', scale: 1.0 };
        }
      };
      const getFamilyMarkerIconUrl = (role: string | null | undefined) => {
        if (role === 'dad' || role === 'son') return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
        if (role === 'grandpa' || role === 'grandma') return 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
      };
      const getFamilyMarkerEmoji = (role: string | null | undefined) => getFamilyRoleEmoji(role as 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null);

      // 승인된 사용자들의 위치 마커 업데이트 또는 생성 (ID 검증: 빈 값/본인 제외, 키 겹침 방지)
      console.log('🗺️ [updateMapMarkers] familyLocations 순회 시작:', state.familyLocations.length, '개');
      state.familyLocations.forEach((loc) => {
        console.log('🗺️ [updateMapMarkers] 위치 처리:', loc.userId, '- 본인:', loc.userId === userId);
        if (!loc.userId || loc.userId === userId) {
          console.log('  ❌ userId 없거나 본인 - 스킵');
          return;
        }
        if (loc.latitude && loc.longitude) {
          console.log('  ✅ 좌표 있음 - 마커 생성/업데이트');
          const style = getFamilyMarkerStyle(loc.familyRole);
          const existingMarker = markersRef.current.get(loc.userId);
          if (existingMarker) {
            // 기존 마커 위치 및 label 업데이트
            if (useAdvancedMarker && existingMarker.position) {
              existingMarker.position = { lat: loc.latitude, lng: loc.longitude };
            } else if (existingMarker.setPosition) {
              existingMarker.setPosition({ lat: loc.latitude, lng: loc.longitude });
            }
            // AdvancedMarkerElement는 content를 업데이트해야 함
            if (useAdvancedMarker && existingMarker.content) {
              const pinElement = new PinElement({
                background: style.background,
                borderColor: '#ffffff',
                glyphColor: '#ffffff',
                scale: style.scale
              });
              const labelDiv = document.createElement('div');
              const emojiLabel = getFamilyMarkerEmoji(loc.familyRole) + ' ' + (loc.userName || ct('user'));
              labelDiv.textContent = emojiLabel;
              labelDiv.style.color = '#ffffff';
              labelDiv.style.fontSize = '12px';
              labelDiv.style.fontWeight = 'bold';
              labelDiv.style.textAlign = 'center';
              labelDiv.style.marginTop = '4px';
              const container = document.createElement('div');
              container.appendChild(pinElement.element);
              container.appendChild(labelDiv);
              existingMarker.content = container;
            } else if (existingMarker.setLabel) {
              const emojiLabel = getFamilyMarkerEmoji(loc.familyRole) + ' ' + (loc.userName || ct('user'));
              existingMarker.setLabel({
                text: emojiLabel,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
              });
              if (existingMarker.setIcon) {
                existingMarker.setIcon({ url: getFamilyMarkerIconUrl(loc.familyRole) });
              }
            }
          } else {
            // 새 마커 생성
            let marker;
            if (useAdvancedMarker) {
              const pinElement = new PinElement({
                background: style.background,
                borderColor: '#ffffff',
                glyphColor: '#ffffff',
                scale: style.scale
              });
              const labelDiv = document.createElement('div');
              const emojiLabel = getFamilyMarkerEmoji(loc.familyRole) + ' ' + (loc.userName || ct('user'));
              labelDiv.textContent = emojiLabel;
              labelDiv.style.color = '#ffffff';
              labelDiv.style.fontSize = '12px';
              labelDiv.style.fontWeight = 'bold';
              labelDiv.style.textAlign = 'center';
              labelDiv.style.marginTop = '4px';
              const container = document.createElement('div');
              container.appendChild(pinElement.element);
              container.appendChild(labelDiv);
              marker = new AdvancedMarkerElement({
                map: mapRef.current,
                position: { lat: loc.latitude, lng: loc.longitude },
                title: `${loc.userName}${dt('location_of')}`,
                content: container
              });
            } else {
              // 폴백: 기존 Marker API 사용
              const emojiLabel = getFamilyMarkerEmoji(loc.familyRole) + ' ' + (loc.userName || ct('user'));
              marker = new google.maps.Marker({
                position: { lat: loc.latitude, lng: loc.longitude },
                map: mapRef.current,
                title: `${loc.userName}${dt('location_of')}`,
                label: {
                  text: emojiLabel,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold'
                },
                icon: {
                  url: getFamilyMarkerIconUrl(loc.familyRole)
                }
              });
            }
            markersRef.current.set(loc.userId, marker);
          }
        }
      });

      // familyLocations에 없는 사용자의 마커 제거
      // ✅ FIX: locationRequests state는 비동기 업데이트로 stale할 수 있으므로 참조하지 않음
      // familyLocations는 이미 승인된 사용자만 포함하도록 필터링되어 있음
      // acceptedUserIdsRef만으로 승인 직후 마커 유지 보장
      const currentUserIds = new Set(state.familyLocations.map((loc: any) => loc.userId).filter((id: string) => id !== userId));
      console.log('🗺️ [updateMapMarkers] currentUserIds:', Array.from(currentUserIds));
      console.log('🗺️ [updateMapMarkers] markersRef 전체:', Array.from(markersRef.current.keys()));
      
      markersRef.current.forEach((marker, markerUserId) => {
        if (markerUserId === 'my-location') return;
        console.log(`🗺️ [updateMapMarkers] 마커 체크: ${markerUserId}`);
        // familyLocations에 있거나 승인 직후 ref에 있는 사용자는 유지
        if (currentUserIds.has(markerUserId)) {
          console.log(`  ✅ currentUserIds에 있음 - 유지`);
          return;
        }
        if (acceptedUserIdsRef.current.has(markerUserId)) {
          console.log(`  ✅ acceptedUserIdsRef에 있음 - 유지`);
          return;
        }
        
        console.log(`  ❌ 제거 대상`);
        // 그 외 마커는 제거
        if (useAdvancedMarker && marker.map) {
          marker.map = null;
        } else if (marker.setMap) {
          marker.setMap(null);
        }
        markersRef.current.delete(markerUserId);
      });
    } catch (error) {
      console.error('지도 마커 업데이트 오류:', error);
    }
  }, [state.location, state.familyLocations, userName, userId, lang]);

  // 4. Google Maps 지도 초기화 및 실시간 마커 업데이트 (승인된 사용자만 표시)
  // ✅ 위치 공유 OFF일 때는 지도를 로드하지 않음 → Google Map load 비용 0
  useEffect(() => {
    if (!isLocationSharing) {
      if (mapRef.current) {
        mapRef.current = null;
      }
      setMapLoaded(false);
      return;
    }

    const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!googleMapApiKey) {
      console.error('Google Maps API 키가 설정되지 않았습니다. NEXT_PUBLIC_GOOGLE_MAP_API_KEY 환경 변수를 확인해주세요.');
      setMapError(dt('map_error_no_key'));
      setMapLoaded(false);
      return;
    }
    
    // 개발 환경에서만 API 키 존재 여부 로그 (키 값은 로그하지 않음)
    if (process.env.NODE_ENV === 'development') {
      console.log('Google Maps API 키 로드됨:', googleMapApiKey ? '설정됨' : '설정 안됨');
    }

    const initializeMap = () => {
      if (typeof window === 'undefined' || !(window as any).google) return;

      try {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;

        // 기본 중심 위치 (Kuala Lumpur Twin Tower) - 위치가 없을 때 사용
        const defaultCenter = { lat: 3.1390, lng: 101.6869 };
        
        // 지도 중심 결정 우선순위:
        // 1. 내 위치가 있으면 -> 내 위치를 중심으로
        // 2. 내 위치가 없으면 -> 가장 최근 공유한 위치로
        // 3. 내 위치가 없고 최근 공유한 위치가 없는데 다른 사용자 위치가 있으면 -> 첫 번째 사용자 위치를 중심으로
        // 4. 위 셋다 없으면 -> Kuala Lumpur Twin Tower를 기본으로 사용
        let center = defaultCenter;
        
        if (state.location.latitude && state.location.longitude) {
          // 1. 내 위치가 있으면 -> 내 위치를 중심으로
          center = { lat: state.location.latitude, lng: state.location.longitude };
        } else {
          // 2. 내 위치가 없으면 -> 가장 최근 공유한 위치로
          let mostRecentSharedLocation = null;
          
          // locationRequests에서 accepted 상태인 요청 중 가장 최근 것 찾기
          const acceptedRequests = locationRequests
            .filter((req: any) => req.status === 'accepted')
            .sort((a: any, b: any) => {
              // created_at 기준으로 정렬 (가장 최근 것이 먼저)
              const dateA = new Date(a.created_at).getTime();
              const dateB = new Date(b.created_at).getTime();
              return dateB - dateA;
            });
          
          if (acceptedRequests.length > 0) {
            // 가장 최근 accepted 요청 찾기
            const mostRecentRequest = acceptedRequests[0];
            
            // 해당 요청과 관련된 사용자 ID 찾기 (requester_id 또는 target_id 중 userId가 아닌 것)
            const sharedUserId = mostRecentRequest.requester_id === userId 
              ? mostRecentRequest.target_id 
              : mostRecentRequest.requester_id;
            
            // familyLocations에서 해당 사용자의 위치 찾기
            if (sharedUserId && state.familyLocations && state.familyLocations.length > 0) {
              mostRecentSharedLocation = state.familyLocations.find(
                (loc: any) => loc.userId === sharedUserId && loc.latitude && loc.longitude
              );
            }
          }
          
          if (mostRecentSharedLocation) {
            // 가장 최근 공유한 위치를 중심으로
            center = { 
              lat: mostRecentSharedLocation.latitude, 
              lng: mostRecentSharedLocation.longitude 
            };
          } else if (state.familyLocations && state.familyLocations.length > 0) {
            // 3. 내 위치가 없고 최근 공유한 위치가 없는데 다른 사용자 위치가 있으면 -> 첫 번째 사용자 위치를 중심으로
            const firstLocation = state.familyLocations[0];
            if (firstLocation.latitude && firstLocation.longitude) {
              center = { lat: firstLocation.latitude, lng: firstLocation.longitude };
            }
          }
          // 4. 위 셋다 없으면 -> defaultCenter (Kuala Lumpur Twin Tower) 사용
        }

        // 지도가 이미 초기화되어 있으면 업데이트만 수행
        if (!mapRef.current) {
          // google.maps.Map이 사용 가능한지 다시 한 번 확인
          if (!(window as any).google || !(window as any).google.maps || !(window as any).google.maps.Map) {
            console.error('Google Maps API가 아직 준비되지 않았습니다.');
            setMapError('Google Maps API를 초기화하는데 실패했습니다. 페이지를 새로고침해주세요.');
            setMapLoaded(false);
            return;
          }

          try {
            // Map ID는 선택사항이지만 Advanced Markers 사용 시 권장됨
            // Map ID가 없어도 기본 마커는 작동하지만, Advanced Markers 경고가 발생할 수 있음
            const mapOptions: any = {
              center: center,
              zoom: state.location.latitude && state.location.longitude ? 15 : 12,
              mapTypeControl: true,
              streetViewControl: true,
              fullscreenControl: true
            };
            
            // Map ID가 환경 변수로 설정되어 있으면 사용 (선택사항)
            // Map ID가 없으면 기본 마커를 사용하고, Advanced Markers는 사용하지 않음
            const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;
            
            // 개발 환경에서 Map ID 로드 상태 확인
            if (process.env.NODE_ENV === 'development') {
              console.log('Google Maps Map ID 로드됨:', mapId ? '설정됨' : '설정 안됨');
              if (mapId) {
                console.log('Map ID:', mapId.substring(0, 10) + '...'); // 일부만 표시
              }
            }
            
            if (mapId) {
              mapOptions.mapId = mapId;
            }
            
            // Map ID가 없을 때 발생하는 경고/에러를 조용히 처리
            const originalConsoleWarn = console.warn;
            const originalConsoleError = console.error;
            
            if (!mapId) {
              // 경고 필터링
              console.warn = (...args: any[]) => {
                const message = args.join(' ');
                // Map ID 관련 경고는 무시 (기본 마커 사용)
                if (message.includes('Map ID') || message.includes('Advanced Markers') ||
                    message.includes('map is initialised without a valid Map ID')) {
                  return;
                }
                originalConsoleWarn.apply(console, args);
              };
              
              // 에러도 필터링 (Google Maps API가 에러로 출력하는 경우)
              console.error = (...args: any[]) => {
                const message = args.join(' ');
                // Map ID 관련 에러는 무시 (기본 마커 사용)
                if (message.includes('Map ID') || message.includes('Advanced Markers') ||
                    message.includes('map is initialised without a valid Map ID')) {
                  return;
                }
                originalConsoleError.apply(console, args);
              };
            }
            
            mapRef.current = new (window as any).google.maps.Map(mapElement, mapOptions);
            
            // console.warn, console.error 복원
            if (!mapId) {
              console.warn = originalConsoleWarn;
              console.error = originalConsoleError;
            }
            
            setMapLoaded(true);
            setMapError(null); // 에러 상태 초기화
          } catch (mapInitError: any) {
            console.error('Google Maps 초기화 오류:', mapInitError);
            console.error('에러 상세 정보:', {
              name: mapInitError?.name,
              message: mapInitError?.message,
              stack: mapInitError?.stack
            });
            googleMapsScriptLoadedRef.current = false; // 실패 시 다시 시도 가능하도록
            
            // 다양한 에러 타입 처리
            const errorMessage = mapInitError?.message || '';
            const errorName = mapInitError?.name || '';
            
            if (errorName === 'BillingNotEnabledMapError' || 
                errorMessage.includes('BillingNotEnabled') ||
                errorMessage.includes('billing') ||
                errorMessage.includes('This page can\'t load Google Maps correctly')) {
              setMapError('Google Maps API를 사용하려면 Google Cloud 프로젝트에 결제 계정을 연결해야 합니다. 월 $200 무료 크레딧이 제공됩니다. Google Cloud Console에서 결제 계정을 연결해주세요.');
            } else if (errorMessage.includes('InvalidKey') || 
                       errorMessage.includes('API key') ||
                       errorMessage.includes('RefererNotAllowedMapError')) {
              setMapError(dt('map_error_check_env'));
            } else if (errorMessage.includes('Referer') || 
                       errorMessage.includes('domain')) {
              setMapError(dt('map_error_domain'));
            } else {
              setMapError(dt('map_error_load_failed'));
            }
            setMapLoaded(false);
            return;
          }
        } else {
          // 지도 중심 업데이트
          try {
            mapRef.current.setCenter(center);
          } catch (centerError) {
            console.error('지도 중심 업데이트 오류:', centerError);
          }
        }

        // ✅ 지도가 이미 초기화된 경우 기존 마커는 유지하고 업데이트만 수행
        // ✅ 처음 초기화하는 경우에만 기존 마커 제거 (Strict Mode 이중 실행 시 참조 유실 방지)
        if (!mapRef.current) {
          markersRef.current.forEach((marker) => {
            if (marker.map !== undefined) (marker as any).map = null;
            else if (typeof (marker as any).setMap === 'function') (marker as any).setMap(null);
          });
          markersRef.current.clear();
        }

        // ✅ 마커 업데이트 (본인 위치 + 상대방 위치)
        updateMapMarkers();
      } catch (error: any) {
        console.error('지도 초기화 오류:', error);
        googleMapsScriptLoadedRef.current = false; // 실패 시 다시 시도 가능하도록
        
        // 다양한 에러 타입 처리
        if (error?.name === 'BillingNotEnabledMapError' || 
            error?.message?.includes('BillingNotEnabled') ||
            error?.message?.includes('billing')) {
          setMapError('Google Maps API를 사용하려면 Google Cloud 프로젝트에 결제 계정을 연결해야 합니다. 월 $200 무료 크레딧이 제공됩니다.');
        } else if (error?.message?.includes('InvalidKey') || 
                   error?.message?.includes('API key')) {
          setMapError(dt('map_error_invalid_key'));
        } else if (error?.message?.includes('RefererNotAllowedMapError') ||
                   error?.message?.includes('Referer')) {
          setMapError(dt('map_error_domain'));
        } else {
          setMapError(dt('map_error_load_failed'));
        }
        setMapLoaded(false);
      }
    };

    // Google Maps API 스크립트 로드 (중복 방지)
    // google.maps.Map이 사용 가능한지 확인 (완전히 로드되었는지 확인)
    if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
      // 이미 로드되어 있으면 디바운스 후 초기화 → familyLocations/locationRequests 연속 변경 시 마지막 상태로 한 번만 마커 갱신
      if (updateMapMarkersDebounceRef.current) clearTimeout(updateMapMarkersDebounceRef.current);
      updateMapMarkersDebounceRef.current = setTimeout(() => {
        updateMapMarkersDebounceRef.current = null;
        initializeMap();
      }, 500);
    } else if (!googleMapsScriptLoadedRef.current) {
      // 스크립트가 이미 DOM에 있는지 확인
      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      
      if (existingScript) {
        // 스크립트가 이미 있으면 로드 완료를 기다림
        googleMapsScriptLoadedRef.current = true;
        let checkCount = 0;
        const maxChecks = 100; // 최대 10초 (100ms * 100)
        const checkGoogleMaps = setInterval(() => {
          checkCount++;
          if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
            clearInterval(checkGoogleMaps);
            initializeMap();
          } else if (checkCount >= maxChecks) {
          clearInterval(checkGoogleMaps);
            console.warn('Google Maps API 로드 타임아웃');
            setMapError(dt('map_error_script_timeout'));
            setMapLoaded(false);
          }
        }, 100);
      } else {
        // 스크립트가 없으면 새로 추가
        googleMapsScriptLoadedRef.current = true;
        const script = document.createElement('script');
        // loading=async 파라미터 추가로 경고 해결
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapApiKey}&libraries=places,marker&loading=async`;
        script.async = true;
        script.defer = true;
        script.id = 'google-maps-script'; // 중복 확인을 위한 ID 추가
        
        script.onload = () => {
          // 스크립트 로드 후 google.maps.Map이 사용 가능할 때까지 대기
          let checkCount = 0;
          const maxChecks = 100; // 최대 10초 (100ms * 100)
          const checkGoogleMapsReady = setInterval(() => {
            checkCount++;
            if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
              clearInterval(checkGoogleMapsReady);
              // 약간의 지연을 두고 초기화 (API가 완전히 준비되도록)
          setTimeout(() => {
            initializeMap();
              }, 200);
            } else if (checkCount >= maxChecks) {
              clearInterval(checkGoogleMapsReady);
              console.error('Google Maps API 초기화 실패 - google.maps.Map을 찾을 수 없습니다.');
              setMapError(dt('map_error_init_failed'));
              setMapLoaded(false);
              googleMapsScriptLoadedRef.current = false; // 실패 시 다시 시도 가능하도록
            }
          }, 100);
        };
        
        script.onerror = (error) => {
          googleMapsScriptLoadedRef.current = false; // 실패 시 다시 시도 가능하도록
          console.error('Google Maps API 스크립트 로드 실패:', error);
          console.error('API 키 확인:', googleMapApiKey ? '설정됨' : '설정 안됨');
          console.error('스크립트 URL:', script.src.replace(googleMapApiKey, '***HIDDEN***'));
          
          // Google Cloud Console에서 오류 확인 안내
          console.error('Google Cloud Console에서 오류 확인:');
          console.error('1. 로깅 → 로그 탐색기 → 리소스 타입: "API" 선택');
          console.error('2. API 및 서비스 → 사용 설정된 API 및 서비스 → Maps JavaScript API → 사용량 탭');
          console.error('3. 결제 → 결제 계정 연결 확인');
          
          setMapError(dt('map_error_console'));
          setMapLoaded(false);
        };
        
        document.head.appendChild(script);
      }
    }
    return () => {
      if (updateMapMarkersDebounceRef.current) {
        clearTimeout(updateMapMarkersDebounceRef.current);
        updateMapMarkersDebounceRef.current = null;
      }
    };
  }, [isLocationSharing, state.location.latitude, state.location.longitude, state.familyLocations, locationRequests, userId, mapLoaded, updateMapMarkers]);

  // 최신 키를 항상 가져오는 헬퍼 함수 (클로저 문제 해결)
  const getCurrentKey = useCallback(() => {
    const authKey = getAuthKey(userId);
    return masterKey || sessionStorage.getItem(authKey) || 
      process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
  }, [userId, masterKey]);

  // 5. Supabase 데이터 로드 및 Realtime 구독
  useEffect(() => {
    // SSR 보호: 클라이언트에서만 실행
    if (typeof window === 'undefined') {
      return;
    }
    
    if (!isAuthenticated || !userId || !currentGroupId) {
      familyChatDebug('Realtime 구독 스킵', { isAuthenticated, hasUserId: !!userId, hasGroupId: !!currentGroupId });
      return;
    }
    
    familyChatDebug('Realtime 구독 시작', userId);

    // ========== 기능별 구독 함수 분리 ==========
    
    // 1. Presence 구독 설정 (온라인 사용자 추적)
    const setupPresenceSubscription = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // 기존 구독 정리
      if (subscriptionsRef.current.presence) {
        supabase.removeChannel(subscriptionsRef.current.presence);
        subscriptionsRef.current.presence = null;
      }

      if (!currentGroupId) {
        setOnlineUsers([]);
        return;
      }

      console.log('👥 Presence subscription 설정 중...');

      /** sync / join / leave 모두 동일: profiles 우선 표시 (join·leave에서 닉네임 누락되던 문제 수정) */
      const buildOnlineUsersListFromPresence = async (
        presenceState: Record<string, unknown>
      ): Promise<Array<{ id: string; name: string; isCurrentUser: boolean }>> => {
        const me = dashboardUserIdRef.current;
        const gid = dashboardCurrentGroupIdRef.current;
        const usersList: Array<{ id: string; name: string; isCurrentUser: boolean }> = [];
        if (me) {
          usersList.push({
            id: me,
            name: dashboardUserNameRef.current?.trim() || '',
            isCurrentUser: true,
          });
        }
        const sameGroup = (p: { groupId?: string }) =>
          gid != null &&
          p.groupId != null &&
          String(p.groupId) === String(gid);
        const otherIds = new Set<string>();
        for (const presenceId of Object.keys(presenceState)) {
          const presence = presenceState[presenceId];
          if (Array.isArray(presence) && presence.length > 0) {
            const userPresence = presence[0] as { userId?: string; groupId?: string; userName?: string };
            const uid = userPresence.userId;
            if (uid && String(uid) !== String(me) && sameGroup(userPresence)) {
              otherIds.add(uid);
            }
          }
        }
        let profilesMap = new Map<string, { nickname?: string | null; email?: string | null }>();
        if (otherIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, nickname, email')
            .in('id', [...otherIds]);
          profilesMap = new Map(
            (profilesData || []).map((p: { id: string; nickname?: string | null; email?: string | null }) => [
              p.id,
              { nickname: p.nickname, email: p.email },
            ])
          );
        }
        const othersById = new Map<string, { id: string; name: string; isCurrentUser: boolean }>();
        for (const presenceId of Object.keys(presenceState)) {
          const presence = presenceState[presenceId];
          if (Array.isArray(presence) && presence.length > 0) {
            const userPresence = presence[0] as { userId?: string; groupId?: string; userName?: string };
            const uid = userPresence.userId;
            if (uid && String(uid) !== String(me) && sameGroup(userPresence)) {
              const profile = profilesMap.get(uid);
              const nick = profile?.nickname != null ? String(profile.nickname).trim() : '';
              const em = profile?.email != null ? String(profile.email).trim() : '';
              const presName = userPresence.userName != null ? String(userPresence.userName).trim() : '';
              const displayName =
                nick ||
                em ||
                presName ||
                `사용자 ${uid.length > 8 ? uid.substring(uid.length - 8) : uid}`;
              othersById.set(uid, { id: uid, name: displayName, isCurrentUser: false });
            }
          }
        }
        usersList.push(...othersById.values());
        return usersList;
      };

      // Presence는 그룹당 하나의 채널만 사용해야 함(세션마다 다른 realtimeSubscriptionId를 넣으면 상대방과 방이 분리됨)
      const presenceSubscription = supabase
      .channel(`online_users:${currentGroupId}`)
      .on('presence', { event: 'sync' }, async () => {
        const state = presenceSubscription.presenceState();
        const usersList = await buildOnlineUsersListFromPresence(state);
        console.log('현재 로그인 중인 사용자 목록 (Presence):', usersList);
        setOnlineUsers(usersList);
      })
      .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
        console.log('사용자 접속:', key, newPresences);
        const state = presenceSubscription.presenceState();
        const usersList = await buildOnlineUsersListFromPresence(state);
        setOnlineUsers(usersList);
      })
      .on('presence', { event: 'leave' }, async ({ key, leftPresences }) => {
        console.log('사용자 접속 해제:', key, leftPresences);
        const state = presenceSubscription.presenceState();
        const usersList = await buildOnlineUsersListFromPresence(state);
        setOnlineUsers(usersList);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Presence subscription 연결 성공');
          subscriptionsRef.current.presence = presenceSubscription;
          // 현재 사용자의 presence 전송 (ref = 최신 그룹·유저)
          await presenceSubscription.track({
            userId: dashboardUserIdRef.current,
            userName: dashboardUserNameRef.current?.trim() || '',
            groupId: dashboardCurrentGroupIdRef.current,
            onlineAt: new Date().toISOString()
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // 개발 환경에서만 경고 로그 출력 (반복 로그 방지)
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Presence subscription 연결 실패:', status);
          }
          // CLOSED 상태일 때는 자동 재연결 시도하지 않음 (무한 루프 방지)
          // 네트워크 재연결이나 페이지 포커스 시 useEffect가 자동으로 재실행됨
        }
      });
    };

    // Supabase에서 초기 데이터 로드 (암호화된 데이터 복호화)
    // localStorage 데이터를 덮어쓰지 않고, Supabase 데이터가 있을 때만 업데이트
    // localStorage가 비어있어도 Supabase 데이터를 로드하여 복구
    const loadSupabaseData = async () => {
      try {
        // family_id 확인 (없으면 기본값 사용)
        const currentFamilyId = familyId || 'ellena_family';
        
        // 가족 공유 키를 sessionStorage에서 직접 가져오기 (상태 업데이트 지연 문제 해결)
        const authKey = getAuthKey(userId);
        const currentKey = masterKey || sessionStorage.getItem(authKey) || 
          process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
        
        if (process.env.NODE_ENV === 'development') {
          console.log('loadSupabaseData - userId:', userId);
          console.log('loadSupabaseData - masterKey from state:', masterKey);
          console.log('loadSupabaseData - currentKey from sessionStorage:', sessionStorage.getItem(authKey));
          console.log('loadSupabaseData - final currentKey:', currentKey ? '있음' : '없음');
        }
        
        if (!currentKey) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('masterKey가 없어 복호화 불가 - 원본 텍스트 사용');
          }
        }
        
        // localStorage 데이터가 먼저 로드되었는지 확인
        // state가 초기 상태가 아니면 localStorage 데이터가 로드된 것으로 간주
        const hasLocalStorageData = (state.messages || []).length > 0 ||
                                    (state.todos || []).length > 0 ||
                                    (state.events || []).length > 0 ||
                                    (state.album || []).length > 0;
        
        // localStorage에서 직접 사진 데이터 확인 (state 업데이트 지연 문제 해결)
        const storageKey = getStorageKey(userId, currentGroupId);
        const saved = localStorage.getItem(storageKey);
        let localStoragePhotos: Photo[] = [];
        if (saved && currentKey) {
          try {
            const decrypted = CryptoService.decrypt(saved, currentKey);
            if (decrypted && decrypted.album && Array.isArray(decrypted.album)) {
              localStoragePhotos = decrypted.album;
            }
          } catch (e: any) {
            // UTF-8 인코딩 오류 처리
            if (e.message?.includes('Malformed UTF-8') || e.message?.includes('UTF-8')) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('localStorage 사진 로드 중 UTF-8 오류, 건너뜀');
              }
              localStoragePhotos = [];
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.warn('localStorage 사진 로드 실패:', e);
              }
            }
          }
        }

        // localStoragePhotos를 상위 스코프에 저장 (에러 처리에서 사용)
        const savedLocalStoragePhotos = localStoragePhotos;

        // 메시지 로드 (그룹별: currentGroupId 있을 때만 해당 그룹 메시지만 로드)
        await loadInitialChatMessages(currentKey);

        // 할일 로드는 FamilyTasksSection에서 처리됨

        // 일정 로드는 FamilyCalendarSection에서 처리됨

        // ✅ 사진 로드는 loadData 함수에서만 처리 (중복 방지)
        // loadData가 먼저 실행되어 사진을 로드하므로, 여기서는 사진 로드를 건너뜀
        if (process.env.NODE_ENV === 'development') {
          console.log('loadSupabaseData: 사진 로드는 loadData에서 처리되므로 건너뜀');
            }
      } catch (error) {
        console.error('Supabase 데이터 로드 오류:', error);
        // ✅ 에러 발생 시에도 album은 업데이트하지 않음 (loadData에서 처리)
        // album은 loadData에서만 관리하므로 여기서는 건너뜀
        // 메시지, 할일, 일정만 에러 처리 (사진은 loadData에서 처리됨)
                if (process.env.NODE_ENV === 'development') {
          console.warn('loadSupabaseData 에러: album은 loadData에서 관리되므로 건너뜀');
        }
      }
    };


    // 3. 할일 구독은 FamilyTasksSection에서 처리됨

    // 4. 일정 구독은 FamilyCalendarSection에서 처리됨

    // 5. 사진 구독 설정 (AlbumContext에서 처리하므로 no-op)
    const setupPhotosSubscription = () => {};

    // 6. 위치 구독 설정
    const setupLocationsSubscription = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // 기존 구독 정리
      if (subscriptionsRef.current.locations) {
        supabase.removeChannel(subscriptionsRef.current.locations);
        subscriptionsRef.current.locations = null;
      }
      
      // ✅ event: '*' 단일 바인딩 (INSERT/UPDATE 분리 시 server/client bindings mismatch 방지)
      console.log('📍 위치 subscription 설정 중...');
      const locationsSubscription = supabase
        .channel(`user_locations_changes:${currentGroupId ?? 'none'}:${realtimeSubscriptionIdRef.current}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'user_locations' },
          async (payload: any) => {
            const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new && payload.old ? 'UPDATE' : 'INSERT');
            if (ev === 'DELETE') {
              loadFamilyLocations();
              return;
            }
            console.log('Realtime 위치 이벤트 수신:', ev, payload);
            await loadFamilyLocations();
          }
        )
        .subscribe((status, err) => {
          console.log('📍 Realtime 위치 subscription 상태:', status);
          if (err) console.error('❌ Realtime 위치 subscription 오류:', err);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 위치 subscription 연결 성공');
            subscriptionsRef.current.locations = locationsSubscription;
          }
        });
    };

    // 7. 위치 요청 구독 설정
    const setupLocationRequestsSubscription = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // 기존 구독 정리
      if (subscriptionsRef.current.locationRequests) {
        supabase.removeChannel(subscriptionsRef.current.locationRequests);
        subscriptionsRef.current.locationRequests = null;
      }

      // ✅ event: '*' 단일 바인딩으로 구독 (INSERT/UPDATE/DELETE 3개 분리 시 server/client bindings mismatch 오류 방지)
      console.log('📍 위치 요청 subscription 설정 중...');
      const locationRequestsSubscription = supabase
        .channel(`location_requests_changes:${currentGroupId ?? 'none'}:${realtimeSubscriptionIdRef.current}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'location_requests' },
          async (payload: any) => {
            const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new && payload.old ? 'UPDATE' : 'INSERT');
            if (ev === 'INSERT') {
              console.log('📍 Realtime 위치 요청 INSERT 이벤트 수신:', payload);
              const newRequest = payload.new;
              if (newRequest && newRequest.target_id === userId) {
                await loadLocationRequests();
                setState(prev => ({ ...prev }));
              } else {
                loadLocationRequests();
              }
              return;
            }
            if (ev === 'DELETE') {
              console.log('📍 Realtime 위치 요청 DELETE 이벤트 수신:', payload);
              loadLocationRequests();
              loadFamilyLocations();
              return;
            }
            // UPDATE
            console.log('📍 Realtime 위치 요청 UPDATE 이벤트 수신:', payload);
            const updatedRequest = payload.new;
            if (updatedRequest && updatedRequest.status === 'accepted') {
              const otherId = updatedRequest.requester_id === userId ? updatedRequest.target_id : updatedRequest.requester_id;
              if (otherId) acceptedUserIdsRef.current.add(otherId);
            }
            const cancelledOtherId = (updatedRequest && (updatedRequest.status === 'cancelled' || updatedRequest.status === 'rejected'))
              ? (updatedRequest.requester_id === userId ? updatedRequest.target_id : updatedRequest.requester_id)
              : null;
            await loadLocationRequests();
            await new Promise(resolve => setTimeout(resolve, 200));
            if (cancelledOtherId) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token && currentGroupId) {
                  const res = await fetch(`/api/location-request?userId=${userId}&type=all&groupId=${currentGroupId}`, {
                    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                  });
                  const json = await res.json();
                  if (json.success && Array.isArray(json.data)) {
                    const hasAcceptedWithUser = json.data.some(
                      (r: any) => r.status === 'accepted' && (r.requester_id === cancelledOtherId || r.target_id === cancelledOtherId)
                    );
                    if (!hasAcceptedWithUser) acceptedUserIdsRef.current.delete(cancelledOtherId);
                  }
                }
              } catch (_) {}
            }
            if (updatedRequest && updatedRequest.status === 'accepted') {
              const isRequester = updatedRequest.requester_id === userId;
              const isTarget = updatedRequest.target_id === userId;
              // ✅ FIX: 승인 시 무조건 위치 저장 (!isLocationSharing 조건 제거)
              // 양방향 위치 공유를 위해 양쪽 모두 user_locations에 데이터 저장 필요
              if (isRequester || isTarget) {
                console.log('🎯 [Realtime] 승인됨 - 위치 즉시 저장 시작');
                try {
                  if (navigator.geolocation) {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                      navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                      });
                    });
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    const address = '';
                    console.log('🎯 [Realtime] 위치 획득 성공:', latitude, longitude);
                    await saveLocationToSupabase(latitude, longitude, address);
                    console.log('🎯 [Realtime] saveLocationToSupabase 완료');
                    setState(prev => ({
                      ...prev,
                      location: {
                        address,
                        latitude,
                        longitude,
                        userId,
                        updatedAt: new Date().toISOString()
                      }
                    }));
                    // 위치 추적이 아직 시작되지 않았다면 시작
                    if (!isLocationSharing) {
                      console.log('🎯 [Realtime] 위치 추적 시작');
                      updateLocation();
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                    console.log('🎯 [Realtime] loadFamilyLocations 호출');
                    await loadFamilyLocations();
                  }
                } catch (error) {
                  console.warn('❌ [Realtime] 위치 추적 시작 실패:', error);
                }
              }
            }
            if (updatedRequest && updatedRequest.status === 'cancelled') {
              await loadFamilyLocations();
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            await loadFamilyLocations();
            if (updatedRequest?.status === 'accepted' && updatedRequest.requester_id === userId) {
              [1000, 2500, 4500].forEach((delay) => {
                setTimeout(() => loadFamilyLocations(), delay);
              });
            }
            setState(prev => ({ ...prev }));
          }
        )
        .subscribe((status, err) => {
          console.log('📍 Realtime 위치 요청 subscription 상태:', status);
          if (err) console.error('❌ Realtime 위치 요청 subscription 오류:', err);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 위치 요청 subscription 연결 성공');
            subscriptionsRef.current.locationRequests = locationRequestsSubscription;
          }
        });
    };

    // ========== 통합 구독 설정 함수 ==========
    // Realtime 구독 설정 (암호화된 데이터 복호화)
    // 가족 공유 키를 사용하여 모든 사용자의 데이터 복호화 가능
    const setupRealtimeSubscriptions = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // ✅ 구독 설정 중이면 중복 실행 방지
      if (isSettingUpSubscriptionsRef.current) {
        familyChatDebug('이미 구독 설정 중, 중복 실행 방지');
        return;
      }

      isSettingUpSubscriptionsRef.current = true;
      familyChatDebug('Realtime 구독 설정 시작', { userId, groupId: currentGroupId });

      if (process.env.NODE_ENV === 'development') {
        console.log('setupRealtimeSubscriptions - userId:', userId);
        console.log('setupRealtimeSubscriptions - masterKey from state:', masterKey);
        const authKey = getAuthKey(userId);
        console.log('setupRealtimeSubscriptions - currentKey from sessionStorage:', sessionStorage.getItem(authKey));
        const currentKey = getCurrentKey();
        console.log('setupRealtimeSubscriptions - final currentKey:', currentKey ? '있음' : '없음');
      }

      // ✅ 중복 구독 방지: 기존 구독을 먼저 모두 제거
      familyChatDebug('기존 Realtime 구독 정리');
      const allChannels = supabase.getChannels();
      familyChatDebug('정리 전 활성 채널 수', allChannels.length);
      allChannels.forEach((ch) => {
        familyChatDebug('채널', ch.topic, ch.state);
      });
      
      // ⭐ 모든 구독을 동기적으로 제거 (Promise.all 사용)
      const removePromises: Promise<any>[] = [];
      
      if (subscriptionsRef.current.messages) {
        familyChatDebug('messages 구독 제거');
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.messages));
        subscriptionsRef.current.messages = null;
      }
      if (subscriptionsRef.current.tasks) {
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.tasks));
        subscriptionsRef.current.tasks = null;
      }
      if (subscriptionsRef.current.events) {
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.events));
        subscriptionsRef.current.events = null;
      }
      if (subscriptionsRef.current.photos) {
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.photos));
        subscriptionsRef.current.photos = null;
      }
      if (subscriptionsRef.current.presence) {
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.presence));
        subscriptionsRef.current.presence = null;
      }
      if (subscriptionsRef.current.locations) {
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.locations));
        subscriptionsRef.current.locations = null;
      }
      if (subscriptionsRef.current.locationRequests) {
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.locationRequests));
        subscriptionsRef.current.locationRequests = null;
      }
      if (subscriptionsRef.current.attachments) {
        removePromises.push(supabase.removeChannel(subscriptionsRef.current.attachments));
        subscriptionsRef.current.attachments = null;
      }
      
      const proceedAfterChannelRemoval = () => {
        const remainingChannels = supabase.getChannels();
        familyChatDebug('구독 제거 후 남은 채널 수', remainingChannels.length);

        realtimeStaggerTimeoutsRef.current.forEach((t) => clearTimeout(t));
        realtimeStaggerTimeoutsRef.current = [];

        const nextRealtimeId = Date.now();
        realtimeSubscriptionIdRef.current = nextRealtimeId;
        setRealtimeSubscriptionEpoch(nextRealtimeId);
        familyChatDebug('새 Realtime 구독 epoch', nextRealtimeId);

        setupPresenceSubscription();

        const INITIAL_DELAY_MS = 100;
        const STAGGER_MS = 200;
        realtimeStaggerTimeoutsRef.current.push(setTimeout(() => setupMessagesAndAttachmentsSubscription(), INITIAL_DELAY_MS));
        realtimeStaggerTimeoutsRef.current.push(setTimeout(() => setupLocationsSubscription(), INITIAL_DELAY_MS + STAGGER_MS * 1));
        realtimeStaggerTimeoutsRef.current.push(setTimeout(() => setupLocationRequestsSubscription(), INITIAL_DELAY_MS + STAGGER_MS * 2));

        const TOTAL_SETUP_TIME = INITIAL_DELAY_MS + STAGGER_MS * 3 + 1000;
        realtimeStaggerTimeoutsRef.current.push(setTimeout(() => {
          isSettingUpSubscriptionsRef.current = false;
          familyChatDebug('Realtime 구독 설정 완료, 플래그 해제');
        }, TOTAL_SETUP_TIME));

        familyChatDebug('Realtime subscription 순차 예약 완료');
      };

      if (removePromises.length > 0) {
        familyChatDebug('채널 제거 대기', removePromises.length);
        void Promise.all(removePromises)
          .then(() => {
            proceedAfterChannelRemoval();
          })
          .catch((err) => {
            console.error('❌ Realtime 채널 제거 실패 — 재구독은 계속 시도:', err);
            proceedAfterChannelRemoval();
          });
      } else {
        proceedAfterChannelRemoval();
      }
    };

    // Supabase 데이터 로드 및 Realtime 구독 설정
    // currentGroupId 없을 때는 위치 로드 스킵 → 그룹 로드 후 effect 재실행 시 한 번만 로드
    if (!currentGroupId) {
      return;
    }
    const runLocationLoad = () => {
      if (locationLoadStartedRef.current) return;
      locationLoadStartedRef.current = true;
      loadSupabaseData().then(async () => {
        familyChatDebug('Supabase 데이터 로드 완료 → Realtime 구독');
        setupRealtimeSubscriptions();
        loadMyLocation();
        await loadLocationRequests();
        loadFamilyLocations();
      }).catch(async (error) => {
        console.error('❌ Supabase 데이터 로드 실패:', error);
        setupRealtimeSubscriptions();
        loadMyLocation();
        await loadLocationRequests().catch(() => {});
        loadFamilyLocations();
      });
    };
    // 리프레시/재로그인 시 세션 복원 후 로드 (500ms 고정 대신 세션 준비 대기 → 마커 유지)
    const start = Date.now();
    const MAX_SESSION_WAIT_MS = 2000;
    const SESSION_POLL_MS = 100;
    const tryRunWhenSessionReady = async () => {
      if (locationLoadStartedRef.current) return true;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        if (sessionWaitIntervalRef.current) {
          clearInterval(sessionWaitIntervalRef.current);
          sessionWaitIntervalRef.current = null;
        }
        runLocationLoad();
        return true;
      }
      if (Date.now() - start >= MAX_SESSION_WAIT_MS) {
        if (sessionWaitIntervalRef.current) {
          clearInterval(sessionWaitIntervalRef.current);
          sessionWaitIntervalRef.current = null;
        }
        runLocationLoad();
        return true;
      }
      return false;
    };
    tryRunWhenSessionReady().then((done) => {
      if (done) return;
      sessionWaitIntervalRef.current = setInterval(() => {
        tryRunWhenSessionReady();
      }, SESSION_POLL_MS);
    });
    
    // 백그라운드/절전 중에는 Realtime(WebSocket) 이벤트를 놓치기 쉬움 → 포그라운드에서 DB와 다시 맞춤
    let lastFocusDataSync = 0;
    const FOCUS_SYNC_MIN_INTERVAL_MS = 2500;

    const syncDataAfterReconnect = (reason: string) => {
      const now = Date.now();
      if (now - lastFocusDataSync < FOCUS_SYNC_MIN_INTERVAL_MS) return;
      lastFocusDataSync = now;
      console.log(`🔄 ${reason} — Supabase 데이터 재동기화 (채팅·할일·일정)`);
      void loadSupabaseData().catch((err) => console.warn('포그라운드 동기화 실패:', err));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 앱이 포그라운드로 복귀');
        setTimeout(() => syncDataAfterReconnect('포그라운드 복귀'), 400);
      }
    };

    const handleOnline = () => {
      console.log('🌐 네트워크 연결 복구');
      setTimeout(() => syncDataAfterReconnect('네트워크 복구'), 400);
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setTimeout(() => syncDataAfterReconnect('bfcache 복원'), 400);
      }
    };
    
    // 이벤트 리스너 등록
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);
      window.addEventListener('pageshow', handlePageShow);
    }
    
    // 정리 함수
    return () => {
      console.log('🧹 Realtime subscription 정리 중...');
      clearChatRuntimeState();
      locationLoadStartedRef.current = false;
      isSettingUpSubscriptionsRef.current = false;  // ✅ 플래그 리셋
      realtimeStaggerTimeoutsRef.current.forEach((t) => clearTimeout(t));
      realtimeStaggerTimeoutsRef.current = [];
      if (sessionWaitIntervalRef.current) {
        clearInterval(sessionWaitIntervalRef.current);
        sessionWaitIntervalRef.current = null;
      }
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('pageshow', handlePageShow);
      }
      // subscriptionsRef를 통해 모든 구독 정리 (기능별 분리 관리)
      if (subscriptionsRef.current.messages) {
        supabase.removeChannel(subscriptionsRef.current.messages);
        subscriptionsRef.current.messages = null;
      }
      if (subscriptionsRef.current.tasks) {
        supabase.removeChannel(subscriptionsRef.current.tasks);
        subscriptionsRef.current.tasks = null;
      }
      if (subscriptionsRef.current.events) {
        supabase.removeChannel(subscriptionsRef.current.events);
        subscriptionsRef.current.events = null;
      }
      if (subscriptionsRef.current.presence) {
        supabase.removeChannel(subscriptionsRef.current.presence);
        subscriptionsRef.current.presence = null;
      }
      if (subscriptionsRef.current.locations) {
        supabase.removeChannel(subscriptionsRef.current.locations);
        subscriptionsRef.current.locations = null;
      }
      if (subscriptionsRef.current.locationRequests) {
        supabase.removeChannel(subscriptionsRef.current.locationRequests);
        subscriptionsRef.current.locationRequests = null;
      }
      if (subscriptionsRef.current.attachments) {
        supabase.removeChannel(subscriptionsRef.current.attachments);
        subscriptionsRef.current.attachments = null;
      }
    };
  }, [isAuthenticated, userId, currentGroupId]); // ⭐ 필수 의존성만 포함 (masterKey, userName, familyId 제거로 불필요한 재구독 방지)

  // 일정/채팅 작성자 별명 로드 (표시용)
  useEffect(() => {
    const eventAuthorIds = (state.events || []).map(e => e.created_by).filter(Boolean) as string[];
    const messageSenderIds = (state.messages || []).map(m => m.sender_id).filter(Boolean) as string[];
    const authorIds = [...new Set([...eventAuthorIds, ...messageSenderIds])];
    if (authorIds.length === 0) {
      setEventAuthorNames({});
      return;
    }
    (async () => {
      const { data } = await supabase.from('profiles').select('id, nickname, email').in('id', authorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: { id: string; nickname?: string | null; email?: string }) => {
        map[p.id] = p.nickname || p.email || p.id?.substring(0, 8) || '알 수 없음';
      });
      setEventAuthorNames(map);
    })();
  }, [state.events, state.messages]);

  // 현재 그룹 멤버의 가족 표시( family_role ) 로드 — 앱 전반 표시용
  useEffect(() => {
    if (!currentGroupId) {
      setFamilyRoleByUserId({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('memberships')
        .select('user_id, family_role')
        .eq('group_id', currentGroupId);
      const map: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null> = {};
      (data || []).forEach((m: { user_id: string; family_role?: string | null }) => {
        map[m.user_id] = (m.family_role as 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other') ?? null;
      });
      setFamilyRoleByUserId(map);
    })();
  }, [currentGroupId]);

  // 가족 임무 담당자 선택용: 그룹 멤버(소유자·멤버십, 본인 포함) + 프로필 닉네임
  useEffect(() => {
    if (!currentGroupId) {
      setFamilyTaskMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: groupRow } = await supabase.from('groups').select('owner_id').eq('id', currentGroupId).maybeSingle();
      const { data: memRows } = await supabase.from('memberships').select('user_id').eq('group_id', currentGroupId);
      const ids = new Set<string>();
      if (groupRow?.owner_id) ids.add(groupRow.owner_id as string);
      (memRows || []).forEach((r: { user_id: string }) => ids.add(r.user_id));
      const idList = Array.from(ids);
      if (idList.length === 0) {
        if (!cancelled) setFamilyTaskMembers([]);
        return;
      }
      const { data: profiles } = await supabase.from('profiles').select('id, nickname, email').in('id', idList);
      const byId: Record<string, { nickname: string | null; email: string | null }> = {};
      (profiles || []).forEach((p: { id: string; nickname?: string | null; email?: string | null }) => {
        byId[p.id] = { nickname: p.nickname ?? null, email: p.email ?? null };
      });
      const members: FamilyTaskMemberOption[] = idList.map((memberUserId) => {
        const p = byId[memberUserId];
        const nickname =
          (p?.nickname && String(p.nickname).trim()) ||
          (p?.email && String(p.email).trim()) ||
          memberUserId.slice(0, 8);
        return { userId: memberUserId, nickname };
      });
      members.sort((a, b) => a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' }));
      if (!cancelled) setFamilyTaskMembers(members);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentGroupId, userName]);

  // 시스템 관리자 권한 확인
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isAuthenticated || !userId) {
        setIsSystemAdmin(false);
        setAdminStatusResolved(true);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_system_admin', {
          user_id_param: userId,
        });

        if (error) {
          console.error('시스템 관리자 확인 오류:', error);
          setIsSystemAdmin(false);
          setAdminStatusResolved(true);
          return;
        }

        setIsSystemAdmin(data === true);
        setAdminStatusResolved(true);
      } catch (error) {
        console.error('시스템 관리자 확인 중 오류:', error);
        setIsSystemAdmin(false);
        setAdminStatusResolved(true);
      }
    };

    checkAdminStatus();
  }, [isAuthenticated, userId]);

  // 6. 위치 요청 모달이 열릴 때 사용자 목록 로드
  useEffect(() => {
    // 모달이 닫혔을 때 상태 초기화
    if (!showLocationRequestModal) {
      if (modalOpenedRef.current) {
        setLoadingUsers(false);
        setAllUsers([]);
        loadingUsersRef.current = false;
        modalOpenedRef.current = false;
      }
      return;
    }

    // 모달이 열렸고, 아직 데이터를 로드하지 않았을 때만 로드
    if (!isAuthenticated || !userId) {
      return;
    }

    // 모달이 방금 열렸는지 확인 (중복 로드 방지)
    // ref를 사용하여 리렌더링과 완전히 분리
    if (modalOpenedRef.current || loadingUsersRef.current) {
      return; // 이미 열렸거나 로딩 중이면 아무것도 하지 않음
    }

    // 모달이 방금 열렸음을 표시하고 로드 시작
    modalOpenedRef.current = true;
    
    console.log('🔓 모달 열림 - 사용자 목록 로드 시작', { userId, isAuthenticated, modalOpened: modalOpenedRef.current });
    
    // 비동기로 로드하여 리렌더링과 완전히 분리 (현재 그룹 멤버만 표시 → 위치 요청은 그룹 멤버에게만 가능)
    const loadUsers = async () => {
      try {
        console.log('📋 loadAllUsers 호출 시작 (그룹 멤버만)', { currentGroupId });
        await loadAllUsers(0, currentGroupId ? { groupId: currentGroupId } : undefined);
        console.log('✅ loadAllUsers 호출 완료');
      } catch (err) {
        console.error('❌ loadAllUsers 호출 중 오류:', err);
        setLoadingUsers(false);
        loadingUsersRef.current = false;
      }
    };
    
    // 다음 이벤트 루프에서 실행하여 현재 렌더링 사이클과 분리
    setTimeout(() => {
      loadUsers();
    }, 100); // 약간의 지연을 두어 모달이 완전히 렌더링된 후 로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLocationRequestModal, isAuthenticated, userId, currentGroupId]); // currentGroupId: 그룹 멤버만 로드

  // 7. 위치 요청 만료 체크 (1분마다 실행)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    // 초기 사용자 목록 로드 제거 (모달이 열릴 때만 로드하도록 변경)

    const checkExpiredRequests = () => {
      const now = new Date();
      const expiredAcceptedRequests: string[] = [];
      
      locationRequests.forEach((req: any) => {
        // expires_at이 있는 경우에만 만료 체크
        if (req.expires_at) {
          const expiresAt = new Date(req.expires_at);
          // 만료된 accepted 요청만 자동으로 종료 (pending은 사용자가 직접 삭제)
          if (expiresAt < now && req.status === 'accepted') {
            // 만료된 accepted 요청 ID 수집
            expiredAcceptedRequests.push(req.id);
          }
          // pending 상태의 만료된 요청은 자동 삭제하지 않음 (사용자가 직접 삭제)
        }
      });
      
      // 만료된 accepted 요청들을 silent 모드로 자동 종료 (skipReload로 무한 루프 방지)
      if (expiredAcceptedRequests.length > 0) {
        expiredAcceptedRequests.forEach((requestId) => {
          // skipReload=true로 설정하여 loadLocationRequests 재호출 방지
          endLocationSharing(requestId, true, true).catch(() => {});
        });
        // 상태만 업데이트 (재로드 없이)
        setLocationRequests(prev => prev.filter(req => !expiredAcceptedRequests.includes(req.id)));
      }
    };

    // 즉시 한 번 실행
    checkExpiredRequests();

    // 1분마다 체크
    const interval = setInterval(checkExpiredRequests, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, userId, locationRequests]);

  // --- [LOGIC] 원본 Store.dispatch 로직 이식 ---

  // localStorage 크기 체크 및 자동 정리
  const checkAndCleanStorage = (newState: AppState): AppState => {
    // localStorage 크기 추정 (대략적으로)
    const estimateSize = (state: AppState): number => {
      const json = JSON.stringify(state);
      return new Blob([json]).size;
    };

    let cleanedState = { ...newState };
    const maxSize = 4 * 1024 * 1024; // 4MB (localStorage 안전 제한)
    let currentSize = estimateSize(cleanedState);

    // 크기가 초과하면 오래된 사진부터 삭제
    if (currentSize > maxSize && cleanedState.album && cleanedState.album.length > 0) {
      // ID 기준으로 정렬 (오래된 것부터). id가 number면 차이로, string(UUID)면 문자열 비교
      const sortedAlbum = [...cleanedState.album].sort((a, b) =>
        typeof a.id === 'number' && typeof b.id === 'number'
          ? a.id - b.id
          : String(a.id).localeCompare(String(b.id))
      );
      
      // 오래된 사진부터 삭제하면서 크기 체크
      for (let i = 0; i < sortedAlbum.length && currentSize > maxSize; i++) {
        cleanedState.album = cleanedState.album.filter(p => p.id !== sortedAlbum[i].id);
        currentSize = estimateSize(cleanedState);
      }

      if (cleanedState.album.length < newState.album.length) {
        console.warn(`localStorage 공간 부족으로 ${newState.album.length - cleanedState.album.length}개의 오래된 사진이 자동 삭제되었습니다.`);
      }
    }

    return cleanedState;
  };

  const persist = (newState: AppState, key: string, userId: string) => {
    if (!userId) {
      console.warn('userId가 없어 데이터를 저장할 수 없습니다.');
      return;
    }
    // 앨범은 AlbumContext에서 관리하므로 저장 시 context 기준으로 반영 (blob/data URL은 저장하지 않음 → Hydration 에러 방지)
    const stableAlbum = (albumRef.current || []).filter((p: Photo) => p?.data && (p.data.startsWith('http://') || p.data.startsWith('https://') || p.data.startsWith('/api/photo/proxy')));
    const stateWithAlbum: AppState = { ...newState, album: stableAlbum };
    try {
      const storageKey = getStorageKey(userId, currentGroupId);
      // originalData 제거 (localStorage 공간 절약)
      const stateForStorage: AppState = {
        ...stateWithAlbum,
        album: stateWithAlbum.album.map((photo: Photo) => {
          const { originalData, ...photoWithoutOriginal } = photo;
          return photoWithoutOriginal;
        })
      };

      // 크기 체크 및 자동 정리
      const cleanedState = checkAndCleanStorage(stateForStorage);
      
      localStorage.setItem(storageKey, CryptoService.encrypt(cleanedState, key));
    } catch (e: any) {
      // QuotaExceededError 처리
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // 오래된 사진 자동 삭제 시도
        const cleanedState = checkAndCleanStorage(stateWithAlbum);
        try {
          const storageKey = getStorageKey(userId, currentGroupId);
          const stateForStorage: AppState = {
            ...cleanedState,
            album: cleanedState.album.map((photo: Photo) => {
              const { originalData, ...photoWithoutOriginal } = photo;
              return photoWithoutOriginal;
            })
          };
          localStorage.setItem(storageKey, CryptoService.encrypt(stateForStorage, key));
          alert(dt('storage_photo_cleanup'));
        } catch (retryError) {
          alert(dt('storage_full_auto'));
        }
      } else {
      alert(dt('storage_full'));
      }
    }
  };

  // Supabase에 데이터 저장 함수 (암호화 유지)
  const saveToSupabase = async (action: string, payload: any, userId: string, encryptionKey?: string) => {
    if (!userId) return;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Refresh Token 에러 처리
      if (sessionError) {
        if (sessionError.message?.includes('Refresh Token') || sessionError.message?.includes('refresh_token')) {
          console.warn('Refresh Token 에러 - 세션 저장 건너뜀:', sessionError.message);
          return;
        }
      }
      
      if (!session) return;

      // family_id 확인 (없으면 기본값 사용)
      const currentFamilyId = familyId || 'ellena_family';

      // 가족 공유 암호화 키 가져오기
      const currentKey = encryptionKey || masterKey || sessionStorage.getItem(getAuthKey(userId)) || 
        process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
      if (!currentKey) {
        console.warn('암호화 키가 없어 Supabase 저장을 건너뜁니다.');
        return;
      }

      switch (action) {
        default:
          break;
      }
    } catch (error) {
      console.error('Supabase 저장 오류:', error);
    }
  };

  const updateState = (action: string, payload?: any) => {
    // userId가 없으면 저장하지 않음
    if (!userId) {
      console.warn('userId가 없어 데이터를 저장할 수 없습니다.');
      return;
    }
    
    // 가족 공유 키 사용 (항상 동일한 키 사용)
    let currentKey = masterKey;
    
    if (!currentKey) {
      // 항상 가족 공유 키 사용 (기존 sessionStorage 키는 무시)
      const authKey = getAuthKey(userId);
      const newKey = process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
      currentKey = newKey;
      setMasterKey(newKey);
      sessionStorage.setItem(authKey, newKey); // 가족 공유 키로 덮어쓰기
    }

    setState(prev => {
      let newState = { ...prev };

      switch (action) {
        case 'SET':
          newState = payload;
          break;
        case 'RENAME':
          newState.familyName = payload;
          // titleStyle의 content도 함께 업데이트
          if (newState.titleStyle) {
            newState.titleStyle.content = payload;
          } else {
            newState.titleStyle = { content: payload };
          }
          break;
        case 'UPDATE_TITLE_STYLE':
          newState.titleStyle = payload;
          // Supabase에 타이틀 스타일 저장 (user_metadata에 저장)
          (async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                const { error } = await supabase.auth.updateUser({
                  data: {
                    titleStyle: payload
                  }
                });
                if (error) {
                  console.error('타이틀 스타일 저장 오류:', error);
                }
              }
            } catch (error: any) {
              console.error('타이틀 스타일 저장 중 오류:', error);
            }
          })();
          break;
        case 'ADD_PHOTO':
          newState.album = [payload, ...prev.album];
          break;
        case 'DELETE_PHOTO':
          newState.album = prev.album.filter(p => p.id !== payload);
          // Supabase, Cloudinary, S3에서 모두 삭제 (API 엔드포인트 사용)
          (async () => {
            try {
              // currentGroupId 필수 검증
              if (!currentGroupId) {
                console.error('DELETE_PHOTO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
                return;
              }

              // 세션 확인
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              if (sessionError || !session) {
                console.error('사진 삭제 실패: 세션이 없습니다.', sessionError);
                return;
              }

              // 삭제 API 호출 (Cloudinary, S3, Supabase 모두 삭제)
              const deleteResponse = await fetch('/api/photos/delete', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  photoId: payload,
                  groupId: currentGroupId, // Multi-tenant: groupId 필수
                }),
              });

              const deleteResult = await deleteResponse.json();

              if (!deleteResponse.ok) {
                const errorDetails = {
                  message: deleteResult.error || '알 수 없는 오류',
                  photoId: payload,
                  status: deleteResponse.status,
                };
                
                console.error('사진 삭제 오류:', {
                  ...errorDetails,
                  fullError: deleteResult,
                });
                
                // 사용자에게 알림 (선택적)
                if (process.env.NODE_ENV === 'development') {
                  console.warn(`사진 삭제 실패 (ID: ${payload}): ${errorDetails.message}`);
                }
              } else {
                // 삭제 성공 로그 (개발 환경에서만)
                if (process.env.NODE_ENV === 'development') {
                  console.log('사진 삭제 성공:', { 
                    photoId: payload, 
                    s3Deleted: deleteResult.s3Deleted,
                    message: deleteResult.message
                  });
                }
              }
            } catch (error: any) {
              // 예외 발생 시 상세 정보 추출
              const errorDetails = {
                name: error?.name || 'UnknownError',
                message: error?.message || '알 수 없는 예외가 발생했습니다.',
                stack: error?.stack?.substring(0, 200) || null,
                photoId: payload,
              };
              
              console.error('사진 삭제 중 예외 발생:', {
                ...errorDetails,
                fullError: error,
              });
            }
          })();
          break;
        case 'UPDATE_PHOTO_ID':
          // 업로드 완료 후 Photo 객체 업데이트 (localStorage ID를 Supabase ID로 업데이트)
          newState.album = prev.album.map(photo => {
            if (photo.id === payload.oldId) {
              // 업로드 실패인 경우
              if (payload.uploadFailed) {
                return {
                  ...photo,
                  isUploading: false // 업로드 중지
                };
              }
              // 업로드 완료인 경우
              return {
                ...photo,
                id: payload.newId, // Supabase ID로 업데이트
                data: payload.s3Url || photo.data, // URL로 업데이트 (Base64 대신, Cloudinary 제거)
                supabaseId: payload.newId,
                isUploaded: true,
                isUploading: false // 업로드 완료
              };
            }
            return photo;
          });
          break;
        case 'UPDATE_PHOTO_DESCRIPTION':
          // 사진 설명 업데이트
          newState.album = prev.album.map(photo => {
            if (photo.id === payload.photoId) {
              // Supabase에 설명 저장 (supabaseId가 있는 경우만)
              if (photo.supabaseId) {
                (async () => {
                  try {
                    const { error } = await supabase
                      .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
                      .update({ caption: payload.description || null })
                      .eq('id', photo.supabaseId);
                    if (error) {
                      console.error('사진 설명 업데이트 오류:', error);
                    }
                  } catch (error) {
                    console.error('사진 설명 업데이트 오류:', error);
                  }
                })();
              }
              return {
                ...photo,
                description: payload.description
              };
            }
            return photo;
          });
          break;
      }

      persist(newState, currentKey, userId);
      return newState;
    });
  };


  // 주소 문자열에서 시/도, 구/군, 도로이름 추출하는 헬퍼 함수
  const extractLocationAddress = (address: string): string => {
    if (!address) return '';
    
    // 한국 주소 형식에서 시/도, 구/군, 도로이름 추출
    // 예: "서울특별시 서초구 반포대로 222" -> "서울특별시 서초구 반포대로"
    // 예: "서울특별시 강남구 테헤란로 123" -> "서울특별시 강남구 테헤란로"
    
    // 공백으로 분리
    const parts = address.trim().split(/\s+/);
    
    if (parts.length < 3) {
      // 주소가 너무 짧으면 원본 반환
      return address;
    }
    
    // 시/도 찾기 (예: "서울특별시", "부산광역시", "경기도")
    let cityIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].endsWith('시') || parts[i].endsWith('도') || parts[i].endsWith('특별시') || parts[i].endsWith('광역시')) {
        cityIndex = i;
        break;
      }
    }
    
    // 구/군 찾기 (예: "서초구", "강남구", "수원시 영통구")
    let districtIndex = -1;
    for (let i = cityIndex + 1; i < parts.length; i++) {
      if (parts[i].endsWith('구') || parts[i].endsWith('군')) {
        districtIndex = i;
        break;
      }
    }
    
    // 도로이름 찾기 (예: "반포대로", "테헤란로")
    let roadIndex = -1;
    for (let i = (districtIndex >= 0 ? districtIndex : cityIndex) + 1; i < parts.length; i++) {
      if (parts[i].endsWith('로') || parts[i].endsWith('대로') || parts[i].endsWith('길')) {
        roadIndex = i;
        break;
      }
    }
    
    // 시/도, 구/군, 도로이름이 모두 있으면 조합
    if (cityIndex >= 0 && districtIndex >= 0 && roadIndex >= 0) {
      return `${parts[cityIndex]} ${parts[districtIndex]} ${parts[roadIndex]}`;
    }
    
    // 시/도와 도로이름만 있으면 조합
    if (cityIndex >= 0 && roadIndex >= 0) {
      return `${parts[cityIndex]} ${parts[roadIndex]}`;
    }
    
    // 도로이름만 있으면 도로이름만 반환
    if (roadIndex >= 0) {
      return parts[roadIndex];
    }
    
    // 모두 실패하면 원본 반환 (fallback)
    return address;
  };

  // Geocoding API 미사용 — 위치공유/지도는 place_id·name·좌표 기반. 주소는 Place Details 등에서만 사용.
  const reverseGeocode = async (_latitude: number, _longitude: number): Promise<string> => {
    return '';
  };

  // 두 좌표 간 거리(m) — Haversine 근사
  const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // 위치를 Supabase에 저장 — 공유 중: 20초·15m / 비공유 경로: 60초·50m (첫 저장은 즉시)
  const saveLocationToSupabase = async (latitude: number, longitude: number, address: string) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastLocationUpdateRef.current;
    const hasPreviousSend = lastLocationUpdateRef.current > 0;
    const sharing = isLocationSharingRef.current;
    const minIntervalMs = sharing ? 20000 : 60000;
    const minMoveM = sharing ? 15 : 50;

    if (hasPreviousSend && timeSinceLastUpdate < minIntervalMs) {
      return;
    }
    const lastLat = lastSentLatRef.current;
    const lastLng = lastSentLngRef.current;
    if (lastLat != null && lastLng != null && distanceMeters(latitude, longitude, lastLat, lastLng) < minMoveM) {
      return;
    }

    if (!userId || !isAuthenticated) return;

    // 리프레시 직후 세션 미복원 시 403(RLS) 방지 — 세션 있을 때만 upsert
    const { data: { session } } = await supabase.auth.getSession();
    console.log('💾 [saveLocationToSupabase] 세션 체크:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      userId: userId,
      sessionUserId: session?.user?.id
    });
    
    if (!session?.access_token) {
      console.warn('❌ [saveLocationToSupabase] 위치 저장 스킵: 세션이 없습니다.');
      return;
    }
    
    // 세션 사용자와 현재 사용자가 일치하는지 확인
    if (session.user?.id !== userId) {
      console.warn('❌ [saveLocationToSupabase] 세션 사용자 불일치:', {
        sessionUserId: session.user?.id,
        currentUserId: userId
      });
      return;
    }

    try {
      console.log('💾 [saveLocationToSupabase] upsert 시도:', {
        user_id: userId,
        lat: latitude,
        lng: longitude
      });
      
      // ✅ CRITICAL FIX: RPC를 사용하여 서버 측에서 세션 검증 및 저장
      // 클라이언트 측 RLS 우회를 위해 RPC 함수 사용
      const { error } = await supabase.rpc('upsert_user_location', {
        p_user_id: userId,
        p_group_id: currentGroupId,
        p_latitude: latitude,
        p_longitude: longitude,
        p_address: address,
        p_last_updated: new Date().toISOString()
      });

      if (error) {
        console.warn('❌ [saveLocationToSupabase] 위치 저장 오류:', error);
        // RPC 함수가 없으면 기존 방식으로 폴백
        if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
          console.log('⚠️ [saveLocationToSupabase] RPC 없음 - 기존 upsert 방식 사용');
          const { error: upsertError } = await supabase
            .from('user_locations')
            .upsert({
              user_id: userId,
              group_id: currentGroupId,
              latitude: latitude,
              longitude: longitude,
              address: address,
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });
          
          if (upsertError) {
            console.warn('❌ [saveLocationToSupabase] upsert 실패:', upsertError);
          } else {
            lastLocationUpdateRef.current = now;
            lastSentLatRef.current = latitude;
            lastSentLngRef.current = longitude;
            console.log('✅ [saveLocationToSupabase] 위치 저장 성공 (upsert)');
          }
        }
      } else {
        lastLocationUpdateRef.current = now;
        lastSentLatRef.current = latitude;
        lastSentLngRef.current = longitude;
        console.log('✅ [saveLocationToSupabase] 위치 저장 성공 (RPC)');
      }
    } catch (dbError: any) {
      console.warn('❌ [saveLocationToSupabase] 위치 저장 시도 중 오류:', dbError);
    }
  };

  // 위치 추적 중지
  const stopLocationTracking = () => {
    if (geolocationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      geolocationWatchIdRef.current = null;
    }
    lastSentLatRef.current = null;
    lastSentLngRef.current = null;

    if (locationUpdateIntervalRef.current) {
      clearInterval(locationUpdateIntervalRef.current);
      locationUpdateIntervalRef.current = null;
    }
    
    setIsLocationSharing(false);
    
    // 백그라운드 위치 추적 중지
    stopBackgroundLocationTracking();
    
    // ✅ 위치 추적 중지 시 state.location 초기화
    setState(prev => ({
      ...prev,
      location: {
        address: '',
        latitude: 0,
        longitude: 0,
        userId: '',
        updatedAt: ''
      }
    }));
  };

  // 위치 공유 기능 (스트림 방식 - watchPosition 사용)
  const updateLocation = async () => {
    if (!userId || !isAuthenticated) {
      alert(dt('login_required'));
      return;
    }

    if (!navigator.geolocation) {
      alert(dt('location_geolocation_unsupported'));
      return;
    }

    // 이미 추적 중이면 중지
    if (geolocationWatchIdRef.current !== null) {
      stopLocationTracking();
      alert(dt('location_tracking_stopped'));
      return;
    }

    setIsLocationSharing(true);
    
    // 백그라운드 위치 추적 시작
    startBackgroundLocationTracking();

    try {
      // 권한 확인
      const permissionResult = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
      if (permissionResult?.state === 'denied') {
        alert(dt('location_permission_denied'));
        setIsLocationSharing(false);
        return;
      }

      // 초기 위치 가져오기 (즉시 표시를 위해)
      let initialPosition: GeolocationPosition | null = null;
      let lastError: any = null;
      
      // 최대 2번 재시도
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          initialPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('TIMEOUT'));
            }, 20000);

            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timeoutId);
                resolve(pos);
              },
              (err) => {
                clearTimeout(timeoutId);
                reject(err);
              },
              {
                enableHighAccuracy: true,
                timeout: 20000,
                // 공유 시작 시 오래된 캐시 좌표 쓰면 같은 자리도 지도에서 어긋져 보임
                maximumAge: 0
              }
            );
          });
          break;
        } catch (error: any) {
          lastError = error;
          if (error.message !== 'TIMEOUT' || attempt === 1) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!initialPosition) {
        throw lastError || new Error('위치를 가져올 수 없습니다.');
      }

      // 초기 위치 처리 (Geocoding 미사용 — 좌표만 사용)
      const { latitude, longitude } = initialPosition.coords;
      const address = '';

      setState(prev => ({
        ...prev,
        location: {
          address: address,
          latitude: latitude,
          longitude: longitude,
          userId: userId,
          updatedAt: new Date().toISOString()
        }
      }));

      // 초기 위치 저장
      await saveLocationToSupabase(latitude, longitude, address);
      await loadFamilyLocations();

      // 스트림 방식 위치 추적 시작 (watchPosition)
      const watchOptions: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 30000, // 30초 타임아웃
        maximumAge: 5000 // 짧은 캐시만 허용 (같은 위치 동기화에 유리)
      };

      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords;
            
            // 정확도가 너무 낮으면 무시 (100미터 이상 오차)
            if (accuracy > 100) {
              console.warn('위치 정확도가 낮아 업데이트를 건너뜁니다:', accuracy);
              return;
            }

            const now = Date.now();
            const address = state.location.address || ''; // Geocoding 미사용

            setState(prev => ({
              ...prev,
              location: {
                address: address,
                latitude: latitude,
                longitude: longitude,
                userId: userId,
                updatedAt: new Date().toISOString()
              }
            }));

            // Supabase에 저장 (쓰로틀링 적용)
            await saveLocationToSupabase(latitude, longitude, address);

            // 가족 위치 재조회: 공유 중에는 저장 주기에 맞춰 더 자주 (상대 마커 지연 완화)
            const reloadGapMs = isLocationSharingRef.current ? 25000 : 60000;
            if (now - lastLocationUpdateRef.current > reloadGapMs) {
              await loadFamilyLocations();
            }

          } catch (updateError: any) {
            console.error('위치 업데이트 처리 오류:', updateError);
            // 위치 업데이트 실패해도 추적은 계속
          }
        },
        (error) => {
          // 에러 핸들링
          console.error('위치 추적 오류:', error);
          
          let errorMessage = '위치 추적 중 오류가 발생했습니다.';
          let shouldStop = false;

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = dt('location_permission_denied');
              shouldStop = true;
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = '위치 정보를 사용할 수 없습니다. GPS가 켜져 있는지 확인해주세요.';
              shouldStop = false; // 일시적 오류일 수 있으므로 계속 시도
              break;
            case error.TIMEOUT:
              errorMessage = '위치 요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.';
              shouldStop = false; // 타임아웃은 일시적일 수 있으므로 계속 시도
              break;
            default:
              errorMessage = '알 수 없는 위치 오류가 발생했습니다.';
              shouldStop = false;
          }

          if (shouldStop) {
            alert(errorMessage);
            stopLocationTracking();
          } else {
            // 일시적 오류는 콘솔에만 기록하고 계속 시도
            console.warn('위치 추적 일시적 오류 (계속 시도):', errorMessage);
          }
        },
        watchOptions
      );

      geolocationWatchIdRef.current = watchId;

      // 주기적으로 가족 구성원 위치 업데이트 (공유 세션 중 15초)
      locationUpdateIntervalRef.current = setInterval(async () => {
        await loadFamilyLocations();
      }, 15000);

    } catch (error: any) {
      console.error('위치 추적 시작 오류:', error);
      
      let errorMessage = '위치 추적을 시작할 수 없습니다.';
      let shouldAlert = true;

      if (error.code === 1) {
        errorMessage = dt('location_permission_denied');
      } else if (error.code === 2) {
        errorMessage = '위치를 가져올 수 없습니다. GPS가 켜져 있는지 확인해주세요.';
      } else if (error.code === 3 || error.message === 'TIMEOUT') {
        errorMessage = '위치 요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.';
        shouldAlert = false; // 타임아웃은 조용히 처리
      } else if (error.message) {
        errorMessage = `위치 오류: ${error.message}`;
      }

      if (shouldAlert) {
        alert(errorMessage);
      } else {
        console.warn('위치 추적 시작 실패 (조용히 처리):', errorMessage);
      }
      
      setIsLocationSharing(false);
    }
  };

  // 컴포넌트 언마운트 시 위치 추적 정리
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, []);

  // 자신의 위치 로드 (Supabase에서)
  const loadMyLocation = async () => {
    if (!userId || !isAuthenticated) return;

    try {
      // maybeSingle() + limit(1): 동일 user_id에 행이 2개 이상 있어도 406 방지 (최신 1건만 사용)
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('자신의 위치 로드 오류:', error);
        }
        return;
      }
      if (!data) {
        return;
      }

      if (data && data.latitude && data.longitude) {
        // Geocoding 미사용 — 저장된 주소만 사용
        let locationAddress = data.address || '';
        if (locationAddress.trim()) {
          const isCoordinateFormat = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(locationAddress.trim());
          if (!isCoordinateFormat) {
            locationAddress = extractLocationAddress(locationAddress);
          }
        }

        // Supabase에서 로드한 위치로 state 업데이트
        setState(prev => ({
          ...prev,
          location: {
            address: locationAddress || '',
            latitude: data.latitude,
            longitude: data.longitude,
            userId: userId,
            updatedAt: data.last_updated || new Date().toISOString()
          }
        }));

        if (process.env.NODE_ENV === 'development') {
          console.log('자신의 위치 로드 완료:', {
            address: locationAddress,
            latitude: data.latitude,
            longitude: data.longitude
          });
        }
        // setState로 지도 effect가 마커 갱신 (직접 updateMapMarkers 호출 제거 → 클로저 stale 방지)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('자신의 위치 로드 시도 중 오류:', error);
      }
    }
  };

  // 가족 구성원 위치 로드 (승인된 관계만 표시)
  const loadFamilyLocations = async () => {
    console.log('🔍 [loadFamilyLocations] 시작 - userId:', userId, 'groupId:', currentGroupId);
    
    if (!userId || !isAuthenticated) {
      console.log('❌ [loadFamilyLocations] userId 또는 isAuthenticated 없음');
      return;
    }
    if (!currentGroupId) {
      console.warn('loadFamilyLocations: currentGroupId가 없습니다. groupId가 필요합니다.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('❌ [loadFamilyLocations] 인증 세션이 없습니다.');
        return;
      }
      console.log('✅ [loadFamilyLocations] 세션 확인 완료');

      // 최신 위치 요청 목록을 직접 조회하여 최신 상태 보장
      let currentLocationRequests = locationRequests;
      try {
        const response = await fetch(`/api/location-request?userId=${userId}&type=all&groupId=${currentGroupId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        const result = await response.json();
        console.log('📍 [loadFamilyLocations] location_requests fetch 결과:', result);
        if (result.success && result.data) {
          currentLocationRequests = (result.data || []).map(normalizeLocationRequestRow);
          console.log('📍 [loadFamilyLocations] currentLocationRequests 개수:', currentLocationRequests.length);
          console.log('📍 [loadFamilyLocations] currentLocationRequests:', JSON.stringify(currentLocationRequests, null, 2));
          // ✅ CRITICAL FIX: state에도 반영 (updateMapMarkers가 최신 locationRequests 참조하도록)
          setLocationRequests(currentLocationRequests as any);
        }
      } catch (err) {
        // 조회 실패 시 기존 locationRequests 사용
        console.warn('❌ [loadFamilyLocations] 위치 요청 조회 실패:', err);
      }

      // ✅ 표시할 사용자 = 승인된 location_requests 기준 (stale fetch여도 마커 유지)
      const expectedUserIds = new Set<string>();
      (currentLocationRequests || []).forEach((req: any) => {
        if (req.status !== 'accepted') return;
        const otherId = req.requester_id === userId ? req.target_id : req.requester_id;
        if (otherId) expectedUserIds.add(otherId);
      });
      
      // 승인된 위치 요청이 있는 사용자들의 위치만 조회
      // RLS 정책에 의해 승인된 관계의 위치만 반환됨
      console.log('📍 [loadFamilyLocations] user_locations 조회 시작');
      console.log('📍 [loadFamilyLocations] 현재 userId:', userId);
      console.log('📍 [loadFamilyLocations] expectedUserIds:', Array.from(expectedUserIds));
      
      // ✅ CRITICAL FIX: 본인 위치 + RLS로 승인된 관계 위치 모두 조회
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .order('last_updated', { ascending: false });

      console.log('📍 [loadFamilyLocations] user_locations 조회 결과 - data:', data?.length, 'rows, error:', error);
      if (data) {
        console.log('📍 [loadFamilyLocations] user_locations 상세:', JSON.stringify(data, null, 2));
        // 각 위치 데이터의 user_id 출력
        data.forEach((loc: any) => {
          console.log(`  - user_id: ${loc.user_id}, lat: ${loc.latitude}, lng: ${loc.longitude}`);
        });
      }

      if (error) {
        console.warn('❌ [loadFamilyLocations] 위치 로드 오류:', error);
        return;
      }

      // ✅ CRITICAL FIX: 승인된 관계가 있는데 user_locations 데이터가 없으면 자동으로 위치 저장
      if (expectedUserIds.size > 0 && (!data || data.length === 0)) {
        console.log('⚠️ [loadFamilyLocations] 승인된 관계 있지만 user_locations 데이터 없음 - 위치 자동 저장 시작');
        
        // 세션 확인 (없으면 대기)
        let sessionReady = false;
        for (let i = 0; i < 10; i++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            sessionReady = true;
            console.log('⚠️ [loadFamilyLocations] 세션 확인 완료');
            break;
          }
          console.log(`⚠️ [loadFamilyLocations] 세션 대기 중... (${i + 1}/10)`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (!sessionReady) {
          console.warn('❌ [loadFamilyLocations] 세션 타임아웃 - 위치 저장 실패');
          return;
        }
        
        try {
          if (navigator.geolocation) {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              });
            });
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const address = '';
            console.log('⚠️ [loadFamilyLocations] 위치 획득 성공, 저장 중:', latitude, longitude);
            await saveLocationToSupabase(latitude, longitude, address);
            console.log('⚠️ [loadFamilyLocations] 위치 저장 완료 - 재조회');
            // 저장 후 다시 조회
            await new Promise(resolve => setTimeout(resolve, 500));
            await loadFamilyLocations();
            return;
          }
        } catch (error) {
          console.warn('⚠️ [loadFamilyLocations] 자동 위치 저장 실패:', error);
        }
      }

      if (data && data.length > 0) {
        // 가족 표시 역할(family_role) 조회 (지도 마커용)
        const otherUserIds = [...new Set((data as any[]).map((loc: any) => loc.user_id).filter((id: string) => id !== userId))];
        let familyRoleMap = new Map<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>();
        if (currentGroupId && otherUserIds.length > 0) {
          const { data: membershipData } = await supabase
            .from('memberships')
            .select('user_id, family_role')
            .eq('group_id', currentGroupId)
            .in('user_id', otherUserIds);
          (membershipData || []).forEach((m: any) => familyRoleMap.set(m.user_id, m.family_role ?? null));
        }

        // 지도 마커 표시명: Presence(onlineUsers)만 쓰면 오프라인·동기 지연 시 "사용자 xxxxxxxx"로 떨어짐 → profiles 우선
        const profileDisplayByUserId = new Map<string, string>();
        if (otherUserIds.length > 0) {
          const { data: profilesForMarkers } = await supabase
            .from('profiles')
            .select('id, nickname, email')
            .in('id', otherUserIds);
          (profilesForMarkers || []).forEach((p: { id: string; nickname: string | null; email: string | null }) => {
            const nick = p.nickname?.trim();
            const mail = p.email?.trim();
            const label = nick || mail;
            if (label) profileDisplayByUserId.set(p.id, label);
          });
        }

        // ✅ 승인된 다른 사용자 위치만 표시 (본인 위치는 제외)
        console.log('🔍 [loadFamilyLocations] 필터링 시작 - 총', data.length, '개 위치');
        const locations = data
          .filter((loc: any) => {
            // ✅ 본인 위치는 확실히 제외 (본인 위치는 state.location에만 있음)
            if (loc.user_id === userId) {
              console.log('🔍 [loadFamilyLocations] 본인 위치 제외:', loc.user_id);
              return false;
            }
            // 다른 사용자 위치는 승인된 요청이 있는 경우만 표시 (최신 locationRequests 사용)
            const hasAcceptedRequest = currentLocationRequests.some(
              req => 
                (req.requester_id === userId && req.target_id === loc.user_id && req.status === 'accepted') ||
                (req.requester_id === loc.user_id && req.target_id === userId && req.status === 'accepted')
            );
            
            console.log(`🔍 [loadFamilyLocations] user_id: ${loc.user_id}, hasAcceptedRequest: ${hasAcceptedRequest}`);
            if (!hasAcceptedRequest) {
              console.log('  ❌ 승인된 요청 없음 - 제외');
            } else {
              console.log('  ✅ 승인된 요청 있음 - 포함');
            }
            
            return hasAcceptedRequest;
          })
          .map((loc: any) => {
            const onlineUser = onlineUsers.find(u => u.id === loc.user_id);
            const userName =
              profileDisplayByUserId.get(loc.user_id) ||
              onlineUser?.name ||
              `사용자 ${loc.user_id.substring(0, 8)}`;
            const familyRole = familyRoleMap.get(loc.user_id) ?? null;
            
            // Geocoding 미사용 — 저장된 주소만 사용, 없으면 빈 문자열 (좌표로 지도/링크 표시)
            let locationAddress = loc.address || '';
            if (locationAddress.trim()) {
              locationAddress = extractLocationAddress(locationAddress);
            }

            return {
              userId: loc.user_id,
              userName: userName,
              address: locationAddress || '',
              latitude: loc.latitude,
              longitude: loc.longitude,
              updatedAt: loc.last_updated,
              familyRole: familyRole ?? undefined,
            };
          });

        // ✅ merge: 승인된 사용자는 새 데이터가 없어도 prev 유지 (마커 끊김 방지)
        console.log('📍 [loadFamilyLocations] 필터링 후 locations 개수:', locations.length);
        console.log('📍 [loadFamilyLocations] locations 상세:', JSON.stringify(locations, null, 2));
        
        const newLocationsByUser = new Map(locations.map((l: any) => [l.userId, l]));
        
        // ✅ CRITICAL FIX: acceptedUserIdsRef 동기화 (updateMapMarkers가 최신 승인 관계 인식하도록)
        expectedUserIds.forEach(uid => {
          acceptedUserIdsRef.current.add(uid);
          console.log('📍 [loadFamilyLocations] acceptedUserIdsRef에 추가:', uid);
        });
        console.log('📍 [loadFamilyLocations] acceptedUserIdsRef 전체:', Array.from(acceptedUserIdsRef.current));
        
        setState(prev => {
          const prevList = prev.familyLocations || [];
          const merged = [...expectedUserIds].map((uid) => {
            const fromNew = newLocationsByUser.get(uid);
            if (fromNew) return fromNew;
            return prevList.find((l: any) => l.userId === uid);
          }).filter(Boolean);
          console.log('📍 [loadFamilyLocations] merged 개수:', merged.length);
          console.log('📍 [loadFamilyLocations] merged:', JSON.stringify(merged, null, 2));
          // 승인된 상대는 있는데 아직 user_locations 행이 없거나(RLS/지연) merged만 비면 []로 덮어써 마커가 사라짐
          if (expectedUserIds.size > 0 && merged.length === 0) {
            console.log('📍 [loadFamilyLocations] expectedUserIds는 있으나 merged 비어 있음 - prev 유지');
            return prev;
          }
          // expectedUserIds가 비어있을 때는 API stale 가능성 → []로 덮어쓰지 않음 (prev 유지, 취소/거절 시에만 else 쪽에서 비움)
          if (expectedUserIds.size === 0 && merged.length === 0) {
            console.log('📍 [loadFamilyLocations] expectedUserIds 비어있고 merged도 비어있음 - prev 유지');
            return prev;
          }
          console.log('✅ [loadFamilyLocations] setState 호출 - familyLocations 업데이트');
          return { ...prev, familyLocations: merged };
        });
      } else {
        // 데이터가 없을 때: 승인된 관계 있으면 prev 유지. expectedUserIds 비어있으면 stale 가능성 → []로 덮어쓰지 않음
        console.log('❌ [loadFamilyLocations] user_locations 데이터 없음');
        
        // ✅ CRITICAL FIX: acceptedUserIdsRef 동기화 (취소/거부된 사용자 제거)
        expectedUserIds.forEach(uid => acceptedUserIdsRef.current.add(uid));
        
        setState(prev => {
          if (expectedUserIds.size > 0 && prev.familyLocations?.length) {
            console.log('📍 [loadFamilyLocations] expectedUserIds 있고 prev.familyLocations 있음 - prev 유지');
            return prev;
          }
          const hasCancelledOrRejected = (currentLocationRequests || []).some((r: any) => r.status === 'cancelled' || r.status === 'rejected');
          if (expectedUserIds.size === 0 && !hasCancelledOrRejected) {
            console.log('📍 [loadFamilyLocations] expectedUserIds 없고 취소/거부 없음 - prev 유지');
            return prev;
          }
          
          console.log('❌ [loadFamilyLocations] familyLocations 비우기');
          // familyLocations를 비울 때 ref도 정리
          const removedUserIds = new Set((prev.familyLocations || []).map((loc: any) => loc.userId));
          removedUserIds.forEach(uid => acceptedUserIdsRef.current.delete(uid));
          
          return { ...prev, familyLocations: [] };
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('위치 로드 시도 중 오류:', error);
      }
    }
  };

  // 만료된 요청을 조용히 처리하는 함수 (alert 없이)
  const silentlyCancelExpiredRequest = async (requestId: string) => {
    if (!userId || !isAuthenticated) return;
    if (!currentGroupId) {
      console.warn('silentlyCancelExpiredRequest: currentGroupId가 없습니다. groupId가 필요합니다.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('silentlyCancelExpiredRequest: 인증 세션이 없습니다.');
        return;
      }

      const response = await fetch('/api/location-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requestId,
          userId,
          groupId: currentGroupId,
          action: 'cancel',
          silent: true, // 조용한 처리 플래그
        }),
      });

      const result = await response.json();
      // 성공 여부와 관계없이 조용히 처리 (loadLocationRequests는 호출하지 않음)
      if (result.success) {
        // 상태만 업데이트 (재로드 없이)
        setLocationRequests(prev => prev.filter(req => req.id !== requestId));
      }
    } catch (error) {
      // 조용히 실패 처리 (에러 로그만)
      console.error('만료된 요청 자동 취소 오류:', error);
    }
  };

  // 위치 요청 목록 로드 (만료된 pending 요청은 사용자가 직접 삭제)
  const loadLocationRequests = async () => {
    if (!userId || !isAuthenticated) return;
    if (!currentGroupId) {
      console.warn('loadLocationRequests: currentGroupId가 없습니다. groupId가 필요합니다.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('loadLocationRequests: 인증 세션이 없습니다.');
        return;
      }

      const response = await fetch(`/api/location-request?userId=${userId}&type=all&groupId=${currentGroupId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();

      if (result.success && result.data) {
        const now = new Date();
        const expiredAcceptedRequests: string[] = [];
        
        // 만료된 accepted 요청만 자동 종료, pending은 그대로 표시
        const processedRequests = result.data.map((rawReq: any) => {
          const req = normalizeLocationRequestRow(rawReq);
          if (req.expires_at && req.status === 'accepted') {
            const expiresAt = new Date(req.expires_at);
            if (expiresAt < now) {
              // 만료된 accepted 요청 ID 수집 (나중에 일괄 처리)
              expiredAcceptedRequests.push(req.id);
              return null; // 필터링을 위해 null 반환
            }
          }
          // pending 상태의 만료된 요청은 그대로 반환 (사용자가 직접 삭제)
          return req;
        }).filter((req: any) => req !== null); // null 제거
        
        setLocationRequests(processedRequests);
        
        // 만료된 accepted 요청들을 silent 모드로 자동 종료 (무한 루프 방지를 위해 상태 업데이트 후 처리)
        if (expiredAcceptedRequests.length > 0) {
          expiredAcceptedRequests.forEach((requestId) => {
            // 비동기로 처리하되, loadLocationRequests 재호출 방지를 위해 silent 모드 사용
            endLocationSharing(requestId, true).catch((error) => {
              console.warn('만료된 요청 자동 종료 실패:', requestId, error);
            });
          });
        }
      }
    } catch (error) {
      console.error('위치 요청 목록 로드 오류:', error);
    }
  };

  // 위치 공유 종료 (accepted 요청 취소)
  const endLocationSharing = async (requestId: string, silent: boolean = false, skipReload: boolean = false) => {
    if (!userId || !isAuthenticated) {
      if (!silent) {
        alert(dt('login_required'));
      }
      return;
    }
    if (!currentGroupId) {
      console.warn('endLocationSharing: currentGroupId가 없습니다. groupId가 필요합니다.');
      return;
    }

    // silent 모드가 아닐 때만 확인 창 표시
    if (!silent && !confirm(dt('location_share_stop_confirm'))) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (!silent) {
          alert(dt('auth_session_expired'));
        }
        return;
      }

      const response = await fetch('/api/location-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requestId,
          userId,
          groupId: currentGroupId,
          action: 'cancel',
          silent, // silent 플래그 전달
        }),
      });

      const result = await response.json();

      if (result.success) {
        // ✅ 위치 공유 종료 시 state.location 초기화
        setState(prev => ({
          ...prev,
          location: {
            address: '',
            latitude: 0,
            longitude: 0,
            userId: '',
            updatedAt: ''
          }
        }));
        
        if (!silent) {
          alert(dt('location_share_stopped'));
        }
        
        // skipReload가 false일 때만 재로드 (무한 루프 방지)
        if (!skipReload) {
          // 위치 요청 목록 다시 로드
          await loadLocationRequests();
          await loadFamilyLocations();
        }
      } else {
        if (!silent) {
          alert(result.error || '위치 공유 종료에 실패했습니다.');
        } else {
          // silent 모드에서는 에러만 로그로 기록
          console.warn('위치 공유 자동 종료 실패:', result.error);
        }
      }
    } catch (error) {
      console.error('위치 공유 종료 오류:', error);
      if (!silent) {
        alert(dt('location_share_stop_error'));
      }
    }
  };

  // 모든 사용자 목록 로드 (로그인한/안한 모두) - profiles 테이블에서 직접 조회
  // options.groupId 있으면 해당 그룹 멤버만 조회 (위치 요청 모달용)
  const loadAllUsers = useCallback(async (retryCount = 0, options?: { groupId?: string }) => {
    if (!userId || !isAuthenticated) {
      setAllUsers([]);
      setLoadingUsers(false);
      loadingUsersRef.current = false;
      return;
    }

    // 이미 로딩 중이면 중복 호출 방지
    if (loadingUsersRef.current && retryCount === 0) {
      return;
    }

    setLoadingUsers(true);
    loadingUsersRef.current = true;
    const maxRetries = 3;
    const retryDelay = 1000; // 1초

    try {
      const listUrl = `/api/users/list?currentUserId=${userId}${options?.groupId ? `&groupId=${options.groupId}` : ''}`;
      console.log('📋 사용자 목록 로드 시작 - API 호출:', { userId, retryCount, groupId: options?.groupId });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error(dt('auth_session_expired'));
      }

      // API를 통해 서버 사이드에서 조회 (groupId 있으면 해당 그룹 멤버만)
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        cache: 'no-store', // 캐시 방지
      });

      console.log('📋 API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ 사용자 목록 API 오류:', response.status, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('📋 API 응답 데이터:', result);

      if (result.success && result.data) {
        console.log('✅ 사용자 목록 로드 성공:', result.data.length, '명', result.data);
        setAllUsers(result.data);
        
        if (result.data.length === 0) {
          console.warn('⚠️ 사용자 목록이 비어있습니다. auth.users에 다른 사용자가 있는지 확인하세요.');
        }
      } else {
        console.warn('⚠️ 사용자 목록 로드 실패 - 응답 형식 오류:', result);
        setAllUsers([]);
      }
    } catch (error: any) {
      console.error('❌ 사용자 목록 로드 오류:', error?.message || error, { retryCount, maxRetries });
      
      // 네트워크 오류인 경우 재시도
      if (retryCount < maxRetries && (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.name === 'TypeError')) {
        console.warn(`🔄 사용자 목록 로드 재시도 (${retryCount + 1}/${maxRetries}):`, error?.message || error);
        setTimeout(() => {
          loadAllUsers(retryCount + 1, options);
        }, retryDelay * (retryCount + 1));
        return;
      }
      
      // 최종 실패 시 빈 배열 설정
      console.error('❌ 사용자 목록 로드 최종 실패:', error?.message || error);
      setAllUsers([]);
    } finally {
      if (retryCount === 0) {
        setLoadingUsers(false);
        loadingUsersRef.current = false;
        console.log('📋 사용자 목록 로드 완료 (로딩 상태 해제)');
      }
    }
  }, [userId, isAuthenticated]); // useCallback 의존성 (supabase는 안정적인 싱글톤이므로 제외)

  // "여기야" 버튼 클릭 시 현재 위치 공유
  const handleShareMyLocation = async () => {
    if (!userId || !isAuthenticated) {
      alert(dt('login_required'));
      return;
    }

    if (!navigator.geolocation) {
      alert(dt('location_geolocation_unsupported'));
      return;
    }

    try {
      // 현재 위치 가져오기
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const address = ''; // Geocoding 미사용

      await saveLocationToSupabase(latitude, longitude, address);

      setState(prev => ({
        ...prev,
        location: {
          address: address,
          latitude: latitude,
          longitude: longitude,
          userId: userId,
          updatedAt: new Date().toISOString()
        }
      }));

      // 받은 위치 요청들을 모두 accepted로 변경
      const pendingRequests = locationRequests.filter(
        req => req.target_id === userId && req.status === 'pending'
      );

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('위치 요청 자동 승인: 인증 세션이 없습니다.');
        return;
      }

      for (const req of pendingRequests) {
        if (!currentGroupId) {
          console.warn('위치 요청 자동 승인: currentGroupId가 없습니다. groupId가 필요합니다.');
          break;
        }
        try {
          const response = await fetch('/api/location-approve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              requestId: req.id,
              userId: userId,
              groupId: currentGroupId,
              action: 'accept',
            }),
          });

          if (!response.ok) {
            console.error('위치 요청 승인 실패:', req.id);
          }
        } catch (error) {
          console.error('위치 요청 승인 오류:', error);
        }
      }

      // 위치 요청 목록 다시 로드 (완료 대기)
      await loadLocationRequests();
      
      // locationRequests 상태가 업데이트될 때까지 약간의 지연
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 위치 목록 다시 로드 (승인된 요청이 반영된 후)
      await loadFamilyLocations();

      alert(dt('location_shared_success'));
    } catch (error: any) {
      console.error('위치 공유 오류:', error);
      if (error.code === 1) {
        alert(dt('location_permission_denied'));
      } else {
        alert(dt('location_fetch_failed'));
      }
    }
  };

  // 위치 요청 보내기
  const sendLocationRequest = async (targetUserId: string) => {
    if (!userId || !isAuthenticated) {
      alert(dt('login_required'));
      return;
    }
    if (!currentGroupId) {
      alert(dt('group_info_missing'));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }

      const response = await fetch('/api/location-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requesterId: userId,
          targetId: targetUserId,
          groupId: currentGroupId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(dt('location_request_sent'));
        await loadLocationRequests();
        setShowLocationRequestModal(false);
        setSelectedUserForRequest(null);
        // 모달 닫을 때 상태 초기화
        setLoadingUsers(false);
        setAllUsers([]);
        loadingUsersRef.current = false;
        modalOpenedRef.current = false;
      } else {
        alert(result.error || '위치 요청 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('위치 요청 전송 오류:', error);
      alert(dt('location_request_send_error'));
    }
  };

  // 위치 요청 승인/거부/취소
  const handleLocationRequestAction = async (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
    if (!userId || !isAuthenticated) {
      alert(dt('login_required'));
      return;
    }
    if (!currentGroupId) {
      alert(dt('group_info_missing'));
      return;
    }

    // 처리 중인 요청인지 확인 (중복 호출 방지)
    const requestKey = `${requestId}-${action}`;
    if (processingRequestsRef.current.has(requestKey)) {
      console.warn('이미 처리 중인 요청입니다:', requestKey);
      return; // 조용히 반환 (alert 없이)
    }

    // 이미 처리된 요청인지 확인 (중복 호출 방지)
    const currentRequest = locationRequests.find((req: any) => req.id === requestId);
    if (currentRequest && currentRequest.status !== 'pending' && action !== 'cancel') {
      // cancel은 만료된 요청도 가능하므로 제외
      console.warn('이미 처리된 요청입니다:', currentRequest.status);
      return; // 조용히 반환 (alert 없이)
    }

    // 처리 시작 표시
    processingRequestsRef.current.add(requestKey);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }

      const response = await fetch('/api/location-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requestId,
          userId,
          groupId: currentGroupId,
          action,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (action === 'accept') {
          // ✅ 승인 직후 상대 ID를 ref에 등록 → 이후 updateMapMarkers에서 해당 마커를 절대 제거하지 않음 (첫 사라짐 방지)
          const reqForRef = currentRequest || (result.data && { requester_id: result.data.requester_id, target_id: result.data.target_id });
          if (reqForRef) {
            const otherId = reqForRef.requester_id === userId ? reqForRef.target_id : reqForRef.requester_id;
            if (otherId) acceptedUserIdsRef.current.add(otherId);
          }
          // ✅ 위치 공유 승인 시 현재 위치를 자동으로 가져와서 저장
          try {
            if (navigator.geolocation) {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0
                });
              });

              const latitude = position.coords.latitude;
              const longitude = position.coords.longitude;
              const address = ''; // Geocoding 미사용
              // 위치를 Supabase에 저장
              await saveLocationToSupabase(latitude, longitude, address);

              // 상태 업데이트
              setState(prev => ({
                ...prev,
                location: {
                  address: address,
                  latitude: latitude,
                  longitude: longitude,
                  userId: userId,
                  updatedAt: new Date().toISOString()
                }
              }));

              // 위치 추적 시작 (실시간 업데이트)
              if (!isLocationSharing) {
                updateLocation();
              }
              
              // ✅ 양쪽 사용자 모두 위치가 표시되도록 위치 목록 다시 로드
              // 승인한 사용자의 위치 저장 후, 요청한 사용자의 위치도 로드되도록 대기
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadFamilyLocations();
              // setState → 지도 effect가 마커 갱신
            }
          } catch (locationError) {
            console.warn('위치 가져오기 실패:', locationError);
            // 위치 가져오기 실패해도 승인은 완료되었으므로 계속 진행
          }
          
          alert(dt('location_share_approved'));
        } else if (action === 'reject' || action === 'cancel') {
          if (action === 'reject') alert(dt('location_request_rejected'));
          if (currentRequest) {
            const otherId = currentRequest.requester_id === userId ? currentRequest.target_id : currentRequest.requester_id;
            if (otherId) acceptedUserIdsRef.current.delete(otherId);
          }
        }
        if (action === 'cancel') {
          // ✅ 위치 요청 취소 시 state.location 초기화
          setState(prev => ({
            ...prev,
            location: {
              address: '',
              latitude: 0,
              longitude: 0,
              userId: '',
              updatedAt: ''
            }
          }));
          
          // 위치 추적 중지
          stopLocationTracking();
          
          alert(dt('location_request_cancelled'));
        }
        
        await loadLocationRequests();
        
        // ✅ 양쪽 사용자 모두 위치가 표시되도록 충분한 대기 시간
        // 위치 저장 및 로드가 완료될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 위치 목록 다시 로드 (setState → 지도 effect가 마커 갱신)
        await loadFamilyLocations();
      } else {
        // "이미 처리된 요청입니다" 에러는 조용히 처리 (반복 alert 방지)
        if (result.error && (result.error.includes('이미 처리된 요청') || result.error.includes('만료된 요청'))) {
          console.warn('요청 처리 불가:', requestId, result.error);
          // 상태만 업데이트 (재로드)
          await loadLocationRequests();
        } else {
          alert(result.error || '요청 처리에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('위치 요청 처리 오류:', error);
      alert(dt('request_processing_error'));
    } finally {
      // 처리 완료 표시 제거
      processingRequestsRef.current.delete(requestKey);
    }
  };

  // 회원탈퇴 Handler
  const handleDeleteAccount = async (confirmGroupDeletion: boolean = false) => {
    // 첫 번째 확인 (그룹 삭제 확인이 아닌 경우만)
    if (!confirmGroupDeletion) {
      const firstConfirm = confirm(dt('delete_confirm_1'));
      if (!firstConfirm) return;

      const secondConfirm = confirm(dt('delete_confirm_2'));
      if (!secondConfirm) return;
    }

    try {
      // 인증 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(dt('auth_fetch_failed'));
        return;
      }

      // 회원탈퇴 API 호출
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          confirm_group_deletion: confirmGroupDeletion 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // 시스템 관리자인 경우 후임자 지정 모달 표시
        if (result.error === 'ADMIN_ACCOUNT' && result.isSystemAdmin) {
          alert(result.message);
          
          // 모든 사용자 목록 로드
          const usersResponse = await fetch('/api/admin/users/list', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (usersResponse.ok) {
            const usersResult = await usersResponse.json();
            if (usersResult.success && usersResult.data) {
              // 본인 제외
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              const otherUsers = usersResult.data.filter((u: any) => u.id !== currentUser?.id);
              setAllUsers(otherUsers);
              setShowSuccessorModal(true);
            }
          }
          return;
        }

        // 그룹 소유자인 경우 경고 모달 표시
        if (result.error === 'GROUP_OWNER_CONFIRMATION_REQUIRED' && result.requireConfirmation) {
          const ownedGroups = result.ownedGroups || [];
          
          // 그룹 정보 포맷팅
          const memberSuffix = getOnboardingTranslation(lang, 'member_count_suffix');
          const groupInfo = ownedGroups.map((g: any) => 
            `• ${g.name} (${ct('member')} ${g.memberCount}${memberSuffix})`
          ).join('\n');

          const warningMessage = `${dt('delete_warning_owner_title')}\n\n${dt('delete_warning_owner_groups')}\n${groupInfo}\n\n${dt('delete_warning_owner_deleted')}\n\n${dt('delete_warning_owner_final')}`;

          if (confirm(warningMessage)) {
            // 그룹 삭제 확인 후 재시도
            handleDeleteAccount(true);
          }
          return;
        }

        throw new Error(result.error || dt('delete_failed'));
      }

      // 성공 시 모든 데이터 정리 및 로그아웃
      alert(dt('delete_success'));
      
      // 모든 localStorage 및 sessionStorage 데이터 정리
      localStorage.clear();
      sessionStorage.clear();
      
      // Supabase 세션 종료
      await supabase.auth.signOut();
      
      // 로그인 페이지로 리다이렉트
      router.push('/');
    } catch (error: any) {
      console.error('회원탈퇴 오류:', error);
      alert(error.message || dt('delete_error'));
    }
  };

  // 후임자 지정 후 회원탈퇴 처리
  const handleTransferAndDelete = async () => {
    if (!selectedSuccessor) {
      alert(dt('delete_transfer_select_successor'));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(dt('delete_transfer_auth_failed'));
        return;
      }

      // 후임자 지정 API 호출
      const transferResponse = await fetch('/api/admin/system-admins/transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ successor_user_id: selectedSuccessor }),
      });

      const transferResult = await transferResponse.json();

      if (!transferResponse.ok) {
        throw new Error(transferResult.error || dt('delete_transfer_failed'));
      }

      alert(transferResult.message);

      // 후임자 지정 성공 후 회원탈퇴 진행
      const deleteResponse = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const deleteResult = await deleteResponse.json();

      if (!deleteResponse.ok) {
        throw new Error(deleteResult.error || '회원탈퇴에 실패했습니다.');
      }

      // 성공 시 모든 데이터 정리 및 로그아웃
      alert(dt('delete_success'));
      
      localStorage.clear();
      sessionStorage.clear();
      await supabase.auth.signOut();
      router.push('/');
    } catch (error: any) {
      console.error('후임자 지정 및 탈퇴 오류:', error);
      alert(error.message || '처리 중 오류가 발생했습니다.');
    }
  };

  // 공지사항 로드 (그룹 페이지 진입 후에만 - group_id 필수)
  const loadAnnouncements = useCallback(async (retryCount = 0) => {
    if (!currentGroupId || !userId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // 세션 복원 전에 effect가 돌 수 있음 → 최대 2번 재시도 (1초, 2.5초 후)
        if (retryCount < 2) {
          setTimeout(() => loadAnnouncements(retryCount + 1), retryCount === 0 ? 1000 : 2500);
        }
        return;
      }

      // 역할에 따라 API 분기 (관리자/소유자 → group-admin, 그 외 → member)
      const isAdmin = groupUserRole === 'ADMIN' || groupIsOwner;
      const apiUrl = isAdmin
        ? `/api/group-admin/announcements?group_id=${currentGroupId}`
        : `/api/announcements?group_id=${currentGroupId}`;

      if (process.env.NODE_ENV === 'development') {
        console.log('[공지] 요청:', { api: isAdmin ? 'group-admin' : 'member', groupId: currentGroupId, role: groupUserRole, isOwner: groupIsOwner });
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const list = result.data || [];
        setAnnouncements(list);
        if (process.env.NODE_ENV === 'development') {
          console.log('[공지] 성공:', list.length, '건');
        }
      } else {
        setAnnouncements([]);
        const body = await response.json().catch(() => ({}));
        if (process.env.NODE_ENV === 'development') {
          console.warn('[공지] 조회 실패:', response.status, body?.error || response.statusText);
        }
        // 계정 전환 직후 이전 사용자의 관리자 플래그로 group-admin API를 호출하면 403이 날 수 있음 → 멤버 API로 재시도
        // 멤버십 반영 지연 시에도 동일. 프로덕션에서도 제한적 재시도
        if (response.status === 403 && retryCount < 1) {
          setTimeout(() => loadAnnouncements(retryCount + 1), 1200);
        }
      }
    } catch (error) {
      console.error('공지사항 로드 오류:', error);
      setAnnouncements([]);
    }
  }, [currentGroupId, userId, groupUserRole, groupIsOwner]);

  // 공지사항 읽음 처리 함수
  const handleMarkAsRead = async (announcementId: string) => {
    if (!currentGroupId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // 관리자/소유자는 관리자 API, 일반 멤버는 일반 API 사용
      const isAdmin = groupUserRole === 'ADMIN' || groupIsOwner;
      const apiUrl = isAdmin ? '/api/group-admin/announcements' : '/api/announcements';

      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          announcement_id: announcementId,
          group_id: currentGroupId,
        }),
      });

      loadAnnouncements();
    } catch (error) {
      console.error('읽음 처리 오류:', error);
    }
  };

  // 사용자 역할 및 소유자 확인
  useEffect(() => {
    if (!currentGroupId || !userId) return;

    setUserRole(groupUserRole);
    setIsOwner(groupIsOwner);
  }, [currentGroupId, userId, groupUserRole, groupIsOwner]);

  // 공지사항 로드 (그룹 선택된 상태에서만)
  useEffect(() => {
    if (!currentGroupId || !userId) return;
    loadAnnouncements();
  }, [currentGroupId, userId, groupUserRole, groupIsOwner, loadAnnouncements]);

  // Logout Handler
  const handleLogout = async () => {
    if (confirm(dt('logout_confirm'))) {
      // Push 토큰 삭제 (백그라운드 알림 방지)
      if (userId) {
        try {
          // 현재 Push 토큰 가져오기
          const token = await getPushToken();
          if (token) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              console.warn('Push 토큰 삭제: 인증 세션이 없습니다. (로그아웃 절차는 계속합니다)');
            } else {
              await fetch(`/api/push/register-token?userId=${userId}&token=${encodeURIComponent(token)}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              }).catch(err => console.warn('Push 토큰 삭제 실패:', err));
            }
          }
        } catch (error) {
          console.warn('Push 토큰 삭제 중 오류:', error);
        }
      }
      
      // 백그라운드 위치 추적 중지
      stopBackgroundLocationTracking();
      try {
        // Realtime subscription 정리 (subscriptionsRef 사용 - 기능별 분리 관리)
        if (subscriptionsRef.current.messages) {
          await supabase.removeChannel(subscriptionsRef.current.messages);
          subscriptionsRef.current.messages = null;
        }
        if (subscriptionsRef.current.tasks) {
          await supabase.removeChannel(subscriptionsRef.current.tasks);
          subscriptionsRef.current.tasks = null;
        }
        if (subscriptionsRef.current.events) {
          await supabase.removeChannel(subscriptionsRef.current.events);
          subscriptionsRef.current.events = null;
        }
        if (subscriptionsRef.current.photos) {
          await supabase.removeChannel(subscriptionsRef.current.photos);
          subscriptionsRef.current.photos = null;
        }
        if (subscriptionsRef.current.presence) {
          await supabase.removeChannel(subscriptionsRef.current.presence);
          subscriptionsRef.current.presence = null;
        }
        if (subscriptionsRef.current.locations) {
          await supabase.removeChannel(subscriptionsRef.current.locations);
          subscriptionsRef.current.locations = null;
        }
        if (subscriptionsRef.current.locationRequests) {
          await supabase.removeChannel(subscriptionsRef.current.locationRequests);
          subscriptionsRef.current.locationRequests = null;
        }
        
        // Supabase 세션 종료
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Logout error:', error);
        }
        
        // 사용자별 localStorage 및 sessionStorage 데이터 정리 (그룹별 키 포함 전부 삭제)
        if (userId) {
          const prefix = `${CONFIG.STORAGE}_${userId}`;
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k === prefix || k.startsWith(prefix + '_'))) keysToRemove.push(k);
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
          const authKey = getAuthKey(userId);
          sessionStorage.removeItem(authKey);
        }
        
        // 모든 Supabase 관련 세션 데이터 정리
        clearAuthStorage();
        sessionStorage.clear();
        
        // 로그인 페이지로 리다이렉트
        router.push('/');
      } catch (error) {
        console.error('Logout error:', error);
        // 에러가 발생해도 로그인 페이지로 이동
        router.push('/');
      }
    }
  };

  // Nickname Handler
  const handleUpdateNickname = async () => {
    const nickname = nicknameInputRef.current?.value;
    if (!nickname?.trim()) {
      alert(dt('nickname_required'));
      return;
    }

    // 보안: 입력 검증
    const sanitizedNickname = sanitizeInput(nickname, 20);
    if (!sanitizedNickname || sanitizedNickname.length < 2) {
      alert(dt('nickname_length_invalid'));
      return;
    }

    if (!userId || !isAuthenticated) {
      alert(dt('login_required'));
      return;
    }

    try {
      // 1. profiles 테이블에 nickname 저장/업데이트
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nickname: sanitizedNickname })
        .eq('id', userId);

      if (profileError) {
        // profiles 테이블에 레코드가 없을 수 있으므로 INSERT 시도
        const { error: insertError } = await supabase
          .from('profiles')
          .upsert({ 
            id: userId, 
            nickname: sanitizedNickname,
            email: (await supabase.auth.getUser()).data.user?.email || ''
          }, {
            onConflict: 'id'
          });

        if (insertError) {
          console.error('profiles 테이블 업데이트 오류:', insertError);
          throw insertError;
        }
      }

      // 2. Supabase user_metadata도 동기화 (기존 기능 유지)
      const { error: authError } = await supabase.auth.updateUser({
        data: { nickname: sanitizedNickname }
      });

      if (authError) {
        console.warn('user_metadata 업데이트 오류 (무시):', authError);
        // profiles 테이블 업데이트는 성공했으므로 계속 진행
      }

      // 3. 로컬 상태 업데이트
      setUserName(sanitizedNickname);
      setIsNicknameModalOpen(false);
      if (nicknameInputRef.current) {
        nicknameInputRef.current.value = "";
      }

      // 4. 가족 표시(family_role) 저장
      if (currentGroupId && userId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const roleRes = await fetch('/api/groups/members/family-role', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                targetUserId: userId,
                groupId: currentGroupId,
                familyRole: nicknameModalFamilyRole,
              }),
            });
            const roleResult = await roleRes.json();
            if (roleRes.ok && roleResult.success) {
              setFamilyRoleByUserId((prev) => ({ ...prev, [userId]: nicknameModalFamilyRole }));
            } else {
              console.warn('가족 표시 저장 실패:', roleResult?.error || roleRes.statusText);
            }
          } else {
            console.warn('가족 표시 저장 건너뜀: 세션 없음');
          }
        } catch (roleErr) {
          console.warn('가족 표시 저장 실패 (무시):', roleErr);
        }
      }

      // 5. 사용자 목록 새로고침 (다른 사용자에게 변경사항 반영)
      await loadAllUsers();

      // 6. Piggy Bank 요약 정보 새로고침 (별명 변경 반영)
      if (currentGroupId) {
        await loadPiggySummary();
      }

      alert(dt('nickname_updated'));
    } catch (error: any) {
      console.error('별명 업데이트 오류:', error);
      alert(dt('nickname_update_failed') + (error.message || ct('error_unknown')));
    }
  };

  const setMessages = useCallback((updater: React.SetStateAction<Message[]>) => {
    setState((prev) => ({
      ...prev,
      messages: typeof updater === 'function' ? (updater as (prev: Message[]) => Message[])(prev.messages) : updater,
    }));
  }, []);

  const handleTasksChange = useCallback((tasks: AppState['todos']) => {
    setState((prev) => ({ ...prev, todos: tasks }));
  }, []);

  const handleEventsChange = useCallback((events: AppState['events']) => {
    setState((prev) => ({ ...prev, events }));
  }, []);

  const {
    loadChatAttachments,
    loadOlderChatMessages,
    handlePickChatFiles,
    handleDropChatFiles,
    sendChat,
  } = useFamilyChatActions({
    supabase,
    currentGroupId,
    userId,
    masterKey,
    messages: state.messages,
    messagesRef,
    chatBoxRef,
    chatScrollRestoreRef,
    chatLoadingOlder,
    chatHasMoreOlder,
    chatPhotoUploadingRef,
    chatTextSendingRef,
    chatPostPermissionCacheRef,
    chatPostPermissionTtlMs: CHAT_POST_PERMISSION_TTL_MS,
    chatAttachmentsLoadGenRef,
    loadChatAttachmentsRef,
    processedMessageIdsRef,
    setChatAttachmentsByMessage,
    setChatHasMoreOlder,
    setChatLoadingOlder,
    setChatOutgoingPreviews,
    setChatTextSendingUi,
    setMessages,
    dt: (key) => dt(key as keyof DashboardTranslations),
    refreshGroups,
    getAuthKey,
    sanitizeInput,
    encrypt: CryptoService.encrypt,
  });

  const { loadInitialChatMessages } = useFamilyChatInitialLoad({
    supabase,
    currentGroupId,
    setChatHasMoreOlder,
    setMessages,
  });

  const {
    setupMessagesAndAttachmentsSubscription,
    clearChatRuntimeState,
  } = useFamilyChatRealtime({
    supabase,
    currentGroupId,
    realtimeSubscriptionIdRef,
    dashboardCurrentGroupIdRef,
    dashboardUserIdRef,
    processedMessageIdsRef,
    chatAttachmentsDebounceTimerRef,
    loadChatAttachmentsRef,
    subscriptionsRef: subscriptionsRef as React.MutableRefObject<{ messages: any; attachments: any }>,
    getCurrentKey,
    decrypt: CryptoService.decrypt,
    setMessages,
  });

  // 일반 멤버 → 그룹 관리자 문의: 하단 FAB → /dashboard/member-support (미읽답 배지용 목록만 로드)
  // Rules of Hooks: 조기 return보다 위에 둠.
  const [memberSupportTickets, setMemberSupportTickets] = useState<MemberSupportTicketRow[]>([]);

  const loadMemberSupportTickets = useCallback(async () => {
    if (!currentGroupId || !userId) return;
    if (isSystemAdmin) return;
    if (groupUserRole === 'ADMIN' || groupIsOwner) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `/api/support-tickets?group_id=${encodeURIComponent(currentGroupId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      if (!res.ok) return;
      setMemberSupportTickets(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error('멤버 문의 목록 로드 오류:', e);
    }
  }, [currentGroupId, userId, isSystemAdmin, groupUserRole, groupIsOwner]);

  useEffect(() => {
    loadMemberSupportTickets();
  }, [loadMemberSupportTickets]);

  const hasUnreadAdminReply = useMemo(() => {
    if (!userId || memberSupportTickets.length === 0) return false;
    const seen = readSeenMemberTicketIds(userId);
    return memberSupportTickets.some(
      (t) => t.answer && String(t.answer).trim() !== '' && !seen.has(t.id)
    );
  }, [memberSupportTickets, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!currentGroupId) {
      setWidgetConfigs([]);
      return;
    }

    const run = async () => {
      try {
        const configs = await ensureWidgetConfigs(currentGroupId, groupIsOwner);
        if (!cancelled) {
          setWidgetConfigs(configs);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('위젯 설정 로드 실패:', error);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [currentGroupId, groupIsOwner]);

  useEffect(() => {
    if (!currentGroupId) return;

    const reloadWidgetConfigs = async () => {
      try {
        const configs = await ensureWidgetConfigs(currentGroupId, groupIsOwner);
        setWidgetConfigs(configs);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('위젯 설정 재로드 실패:', error);
        }
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void reloadWidgetConfigs();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentGroupId, groupIsOwner]);

  const [previewOrientation, setPreviewOrientation] = useState<AppPreviewOrientation>('portrait');
  useEffect(() => {
    setPreviewOrientation(readStoredPreviewOrientation());
  }, []);

  const dashboardGridRef = useRef<HTMLDivElement>(null);
  /** 그리드 DOM 마운트 후 layout 훅 재실행 (초기 null return 시 shell/columns 고정 버그 방지) */
  const dashboardGridActive = isMounted && isAuthenticated;
  const {
    columnCount: dashboardColumnCount,
    shell: dashboardShell,
    contentWidth: dashboardContentWidth,
    isLandscapeGrid: dashboardIsLandscapeGrid,
  } = useDashboardGridLayout(
    dashboardGridRef,
    previewOrientation,
    dashboardGridActive,
    widgetConfigs,
  );
  const dashboardCellRowH = getSquareCellRowHeight(dashboardContentWidth, dashboardColumnCount);

  // web-preview portrait: 430px 프레임에서 vw가 PC 뷰포트 기준으로 계산되므로
  // clamp min(44px) < 실제 적정값(~42px) → clamp 자체를 우회하고 고정 42px 사용.
  // 계산 근거: h1 가용 폭 ≈ 262px, "A: B" 제목 전체 ~5.8em → 262/6.2≈42px이 안전 최댓값.
  const titleFontSizeValue = (dashboardShell === 'web-preview' && previewOrientation === 'portrait')
    ? `${customFontSizeCap != null ? Math.min(customFontSizeCap, 42) : 42}px`
    : `clamp(${titleFontMin}px, ${titleVw}vw, ${customFontSizeCap ?? 68}px)`;
  const dashboardTitleStyle: React.CSSProperties = {
    margin: 0,
    flex: '1 1 0%',
    minWidth: 0,
    maxWidth: '100%',
    whiteSpace: 'nowrap' as const,
    overflowX: 'hidden',
    overflowY: 'visible',
    textOverflow: 'clip',
    fontSize: titleFontSizeValue,
    fontWeight: titleFont.fontWeight,
    letterSpacing: `${effectiveTitleStyle?.letterSpacing ?? -0.5}px`,
    fontFamily: titleFont.fontFamily,
    ...(isDefaultDashboardTitle
      ? {
          background: 'linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(var(--brand-secondary)) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }
      : { color: effectiveTitleStyle?.color || '#1e293b' }),
  };

  const orderedWidgets = useMemo(
    () =>
      [...widgetConfigs]
        .filter((cfg) => cfg.is_enabled)
        .sort((a, b) => {
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          return b.priority - a.priority;
        }),
    [widgetConfigs],
  );

  // 개발 모드 전용: 위젯 그리드 배치 충돌 감지 (명시적 gridColumnStart/gridRowStart 기준)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const overlaps = detectGridOverlaps(orderedWidgets, dashboardColumnCount, dashboardIsLandscapeGrid);
    if (overlaps.length > 0) {
      console.warn(
        '[WidgetGrid] 겹침 감지 — 아래 위젯 쌍이 같은 셀을 공유합니다. packOrientationLayouts 재실행 필요:',
        overlaps,
      );
    }
  }, [orderedWidgets, dashboardColumnCount, dashboardIsLandscapeGrid]);

  // --- [RENDER] ---

  if (!isMounted) return null; // Hydration mismatch 방지

  // Supabase 세션이 없으면 로그인 페이지로 리다이렉트 (렌더링 전 처리)
  if (!isAuthenticated && isMounted) {
    return null; // useEffect에서 리다이렉트 처리 중
  }

  const isGroupAdmin = (groupUserRole === 'ADMIN' || groupIsOwner) && currentGroupId !== null;
  const showAdminButton = isSystemAdmin || isGroupAdmin;
  const adminPagePath = isSystemAdmin ? '/admin' : '/group-admin';

  // 그룹 정보 로딩 중인지 확인
  const isGroupLoading = groupLoading && !currentGroupId;
  /** 시스템/그룹 관리자가 아닌 멤버만 그룹 관리자에게 문의 가능 */
  const showMemberInquiryFab = !isSystemAdmin && !isGroupAdmin && !!currentGroupId && !isGroupLoading;

  const renderWidgetSection = (widgetKey: DashboardWidgetKey, widgetRowSpan?: number) => {
    switch (widgetKey) {
      case 'tasks':
        return (
          <FamilyTasksSection
            tasks={state.todos}
            onTasksChange={handleTasksChange}
            userId={userId}
            currentGroupId={currentGroupId}
            getCurrentKey={getCurrentKey}
            CryptoService={CryptoService}
            sanitizeInput={sanitizeInput}
            realtimeSubscriptionId={String(effectiveRealtimeEpochForChildren)}
            familyRoleByUserId={familyRoleByUserId}
            getFamilyRoleEmoji={getFamilyRoleEmoji}
            getFamilyRoleLabel={getFamilyRoleLabel}
            lang={lang}
            taskMembers={familyTaskMembers}
            translations={{
              todo_section_title: dt('todo_section_title'),
              todo_add_btn: dt('todo_add_btn'),
              todo_empty_state: dt('todo_empty_state'),
              todo_modal_title: dt('todo_modal_title'),
              todo_what_label: dt('todo_what_label'),
              todo_what_placeholder: dt('todo_what_placeholder'),
              todo_who_label: dt('todo_who_label'),
              todo_who_placeholder: dt('todo_who_placeholder'),
              todo_register_btn: dt('todo_register_btn'),
              todo_required: dt('todo_required'),
              invalid_input: dt('invalid_input'),
              anyone: ct('anyone'),
              cancel: ct('cancel'),
              delete_confirm: ct('delete_confirm'),
            }}
            chatDragOver={chatDragOver}
            chatDropRef={chatDropRef}
            onChatDragOver={(e) => {
              e.preventDefault();
              setChatDragOver(true);
            }}
            onChatDragLeave={() => setChatDragOver(false)}
            onChatDrop={(e) => {
              e.preventDefault();
              setChatDragOver(false);
              const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
              handleDropChatFiles(files);
            }}
          />
        );
      case 'calendar':
        return (
          <FamilyCalendarSection
            events={state.events}
            onEventsChange={handleEventsChange}
            userId={userId}
            currentGroupId={currentGroupId}
            getCurrentKey={getCurrentKey}
            CryptoService={CryptoService}
            sanitizeInput={sanitizeInput}
            realtimeSubscriptionId={String(effectiveRealtimeEpochForChildren)}
            eventAuthorNames={eventAuthorNames}
            familyRoleByUserId={familyRoleByUserId}
            getFamilyRoleEmoji={getFamilyRoleEmoji}
            getFamilyRoleLabel={getFamilyRoleLabel}
            lang={lang}
            translations={{
              section_title_calendar: dt('section_title_calendar'),
              calendar_prev_month: dt('calendar_prev_month'),
              calendar_next_month: dt('calendar_next_month'),
              calendar_sun: dt('calendar_weekday_0'),
              calendar_mon: dt('calendar_weekday_1'),
              calendar_tue: dt('calendar_weekday_2'),
              calendar_wed: dt('calendar_weekday_3'),
              calendar_thu: dt('calendar_weekday_4'),
              calendar_fri: dt('calendar_weekday_5'),
              calendar_sat: dt('calendar_weekday_6'),
              calendar_day_events_title: dt('calendar_day_events_title'),
              event_add_title: dt('event_add_title'),
              event_title_label: dt('event_title_label'),
              event_title_placeholder: dt('event_title_placeholder'),
              event_desc_label: dt('event_desc_label'),
              event_desc_placeholder: dt('event_desc_placeholder'),
              event_repeat_label: dt('event_repeat_label'),
              event_repeat_none: dt('event_repeat_none'),
              event_repeat_monthly: dt('event_repeat_monthly'),
              event_repeat_yearly: dt('event_repeat_yearly'),
              event_submit_btn: dt('event_submit_btn'),
              event_title_required: dt('event_title_required'),
              event_date_invalid: dt('event_date_invalid'),
              event_title_invalid: dt('event_title_invalid'),
              event_author: dt('event_author'),
              event_no_events: dt('event_no_events'),
              event_add_hint: dt('event_add_hint'),
              event_save_failed: dt('event_save_failed'),
              delete_failed_retry: dt('delete_failed_retry'),
              me: ct('me'),
              unknown: ct('unknown'),
              cancel: ct('cancel'),
              close: ct('close'),
              delete: ct('delete'),
              delete_confirm: ct('delete_confirm'),
            }}
          />
        );
      case 'chat':
        return (
          <FamilyChatSection
            messages={state.messages}
            userId={userId}
            currentGroupId={currentGroupId}
            isSendingText={chatTextSendingUi}
            onSendMessage={sendChat}
            chatBoxRef={chatBoxRef}
            chatInputRef={chatInputRef}
            chatFileInputRef={chatFileInputRef}
            chatCameraInputRef={chatCameraInputRef}
            chatHasMoreOlder={chatHasMoreOlder}
            chatLoadingOlder={chatLoadingOlder}
            onLoadOlderMessages={loadOlderChatMessages}
            onPickFiles={handlePickChatFiles}
            chatAttachmentsByMessage={chatAttachmentsByMessage}
            chatOutgoingPreviews={chatOutgoingPreviews}
            onDeleteAttachment={async (attachmentId: string) => {
              if (!currentGroupId) return;
              try {
                await deleteAttachment(currentGroupId, attachmentId);
                await loadChatAttachments();
              } catch (e) {
                alert(e instanceof Error ? e.message : '첨부 삭제 실패');
              }
            }}
            familyRoleByUserId={familyRoleByUserId}
            getFamilyRoleEmoji={getFamilyRoleEmoji}
            getFamilyRoleLabel={getFamilyRoleLabel}
            eventAuthorNames={eventAuthorNames}
            lang={lang}
            translations={{
              section_title_chat: dt('section_title_chat'),
              section_chat_bubble_greeting: dt('section_chat_bubble_greeting'),
              chat_placeholder: dt('chat_placeholder'),
              chat_send: dt('chat_send'),
              chat_load_older: dt('chat_load_older'),
              chat_loading_older: dt('chat_loading_older'),
              chat_album_btn: dt('chat_album_btn'),
              chat_camera_btn: dt('chat_camera_btn'),
              chat_remove_attachment_aria: dt('chat_remove_attachment_aria'),
              me: ct('me'),
              user: ct('user'),
            }}
          />
        );
      case 'travel':
        return (
          <TravelPlannerSection
            trips={travelTrips}
            loading={travelTripsLoading}
            currentGroupId={currentGroupId}
            onTripClick={(tripId) => router.push(`/travel?tripId=${tripId}`)}
            onAddClick={() => router.push('/travel?openAdd=1')}
            translations={{
              section_title: tt('title'),
              add_trip: tt('add_trip'),
              select_group: tt('dashboard_select_group'),
              trips_loading: tt('dashboard_trips_loading'),
              empty_state: tt('dashboard_card_empty'),
            }}
          />
        );
      case 'piggy':
        return (
          <PiggyBankSection
            currentGroupId={currentGroupId}
            isAdmin={piggyMemberPiggies !== null}
            piggySummary={piggySummary}
            piggyMemberPiggies={piggyMemberPiggies}
            piggyLoaded={piggyLoaded}
            piggySummaryError={piggySummaryError}
            pendingAccountRequests={pendingAccountRequests}
            piggyLabel={piggyLabel}
            formatAmount={formatDashboardPiggy}
            onGoClick={() => router.push('/piggy-bank')}
            onManageClick={() => router.push('/piggy-bank')}
            onAddPiggy={handleDashboardAddPiggy}
            onDeletePiggy={handleDashboardDeletePiggy}
            onApproveRequest={handleApproveAccountRequest}
            onRejectRequest={handleRejectAccountRequest}
            onRequestAccount={handlePiggyRequestAccount}
            onMemberClick={(targetUserId) => router.push(`/piggy-bank?child_id=${targetUserId}`)}
            translations={{
              section_title_admin: dt('piggy_section_admin_title'),
              section_title_user: dt('piggy_card_title'),
              manage_all: dt('piggy_manage_all'),
              go: dt('piggy_go'),
              select_group: dt('piggy_select_group_prompt'),
              loading: dt('piggy_loading_generic'),
              pending_requests: dt('piggy_pending_requests'),
              no_account_holders: dt('piggy_no_account_holders'),
              member_no_account_line: dt('piggy_member_no_account_line'),
              add_account_btn: dt('piggy_add_account_btn'),
              delete_account_btn: dt('piggy_delete_account_btn'),
              reject_btn: dt('piggy_reject_btn'),
              approve_btn: dt('piggy_approve_btn'),
              wallet_balance_label: dt('piggy_wallet_balance_label'),
              bank_balance_label: dt('piggy_bank_balance_label'),
              wallet_balance_for_name: dt('piggy_wallet_balance_for_name'),
              bank_balance_for_name: dt('piggy_bank_balance_for_name'),
              empty_ask_admin: dt('piggy_empty_ask_admin'),
              request_account_btn: dt('piggy_request_account_btn'),
              member: ct('member'),
              card_title: dt('piggy_card_title'),
            }}
          />
        );
      case 'album':
        return (
          <FamilyAlbumSection
            photos={stableAlbum}
            onViewAllClick={() => router.push('/memories')}
            rowSpan={widgetRowSpan}
            translations={{
              section_title: dt('section_title_memories'),
              view_all: dt('album_view_all'),
              empty_state: dt('photo_upload_prompt'),
              photos_count: dt('album_more_photos'),
            }}
          />
        );
      case 'location':
        return (
          <FamilyLocationSection
            onOpenRequestModal={() => setShowLocationRequestModal(true)}
            myLocation={state.location}
            extractLocationAddress={extractLocationAddress}
            isLocationSharing={isLocationSharing}
            mapError={mapError}
            hasGoogleMapsApiKey={Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY)}
            locationRequests={locationRequests}
            userId={userId}
            onLocationRequestAction={handleLocationRequestAction}
            onEndLocationSharing={endLocationSharing}
            translations={{
              section_title_location: dt('section_title_location'),
              location_where_btn: dt('location_where_btn'),
              piggy_request_sent: dt('piggy_request_sent'),
              piggy_request_received: dt('piggy_request_received'),
              location_share_btn: dt('location_share_btn'),
              location_ui_address_prefix: dt('location_ui_address_prefix'),
              location_ui_map_title: dt('location_ui_map_title'),
              location_ui_map_hint_off: dt('location_ui_map_hint_off'),
              location_ui_gmaps_error_title: dt('location_ui_gmaps_error_title'),
              location_ui_troubleshoot_title: dt('location_ui_troubleshoot_title'),
              location_ui_troubleshoot_1: dt('location_ui_troubleshoot_1'),
              location_ui_troubleshoot_2: dt('location_ui_troubleshoot_2'),
              location_ui_troubleshoot_3: dt('location_ui_troubleshoot_3'),
              location_ui_troubleshoot_4: dt('location_ui_troubleshoot_4'),
              location_ui_troubleshoot_note: dt('location_ui_troubleshoot_note'),
              location_ui_open_in_gmaps: dt('location_ui_open_in_gmaps'),
              location_ui_api_key_title: dt('location_ui_api_key_title'),
              location_ui_api_setup_title: dt('location_ui_api_setup_title'),
              location_ui_api_li1_before: dt('location_ui_api_li1_before'),
              location_ui_api_li1_after: dt('location_ui_api_li1_after'),
              location_ui_api_li2_intro: dt('location_ui_api_li2_intro'),
              location_ui_api_env_example: dt('location_ui_api_env_example'),
              location_ui_api_li3_before: dt('location_ui_api_li3_before'),
              location_ui_api_li3_after: dt('location_ui_api_li3_after'),
              location_ui_api_hint_before: dt('location_ui_api_hint_before'),
              location_ui_api_hint_after: dt('location_ui_api_hint_after'),
              location_ui_or_maps_before: dt('location_ui_or_maps_before'),
              location_ui_or_maps_link: dt('location_ui_or_maps_link'),
              location_ui_requests_heading: dt('location_ui_requests_heading'),
              location_ui_unknown_user: dt('location_ui_unknown_user'),
              location_ui_dot_time_left: dt('location_ui_dot_time_left'),
              location_ui_expired_suffix: dt('location_ui_expired_suffix'),
              location_ui_pin_time_left: dt('location_ui_pin_time_left'),
              location_ui_pin_expired: dt('location_ui_pin_expired'),
              location_ui_sharing_with: dt('location_ui_sharing_with'),
              location_ui_end_sharing: dt('location_ui_end_sharing'),
            }}
            cancelLabel={ct('cancel')}
            rejectLabel={dt('piggy_reject_btn')}
            familyRoleByUserId={familyRoleByUserId}
            getFamilyRoleEmoji={getFamilyRoleEmoji}
            getFamilyRoleLabel={getFamilyRoleLabel}
            lang={lang}
          />
        );
      case 'games':
        return (
          <FamilyGamesSection
            currentGroupId={currentGroupId}
            userId={userId}
            members={familyTaskMembers}
            translations={{
              section_title: gt('section_title'),
              select_group: gt('select_group'),
              tab_ladder: gt('tab_ladder'),
              tab_rps: gt('tab_rps'),
              tab_roulette: gt('tab_roulette'),
              ladder_participants: gt('ladder_participants'),
              ladder_destinations: gt('ladder_destinations'),
              ladder_participant_ph: gt('ladder_participant_ph'),
              ladder_destination_ph: gt('ladder_destination_ph'),
              select_member: gt('select_member'),
              no_members: gt('no_members'),
              ladder_add_pair: gt('ladder_add_pair'),
              ladder_remove_pair: gt('ladder_remove_pair'),
              ladder_min_players: gt('ladder_min_players'),
              ladder_draw_hint: gt('ladder_draw_hint'),
              ladder_drawn_by: gt('ladder_drawn_by'),
              ladder_draw_progress: gt('ladder_draw_progress'),
              ladder_start_hint: gt('ladder_start_hint'),
              ladder_you: gt('ladder_you'),
              ladder_start: gt('ladder_start'),
              ladder_reset: gt('ladder_reset'),
              ladder_result_title: gt('ladder_result_title'),
              ladder_path_result: gt('ladder_path_result'),
              rps_player1: gt('rps_player1'),
              rps_player2: gt('rps_player2'),
              rps_rock: gt('rps_rock'),
              rps_paper: gt('rps_paper'),
              rps_scissors: gt('rps_scissors'),
              rps_reveal: gt('rps_reveal'),
              rps_reset: gt('rps_reset'),
              rps_select_members: gt('rps_select_members'),
              rps_pick_choices: gt('rps_pick_choices'),
              rps_pick_both: gt('rps_pick_both'),
              rps_animating: gt('rps_animating'),
              rps_result_win: gt('rps_result_win'),
              rps_result_draw: gt('rps_result_draw'),
              duplicate_member: gt('duplicate_member'),
              roulette_slots: gt('roulette_slots'),
              roulette_participants: gt('roulette_participants'),
              roulette_slots_per_member: gt('roulette_slots_per_member'),
              roulette_slots_per_member_option: gt('roulette_slots_per_member_option'),
              roulette_total_slots: gt('roulette_total_slots'),
              roulette_select_participants: gt('roulette_select_participants'),
              roulette_min_participants: gt('roulette_min_participants'),
              roulette_spin: gt('roulette_spin'),
              roulette_spinning: gt('roulette_spinning'),
              roulette_reset: gt('roulette_reset'),
              roulette_result: gt('roulette_result'),
              games_launch: gt('games_launch'),
              games_modal_close: gt('games_modal_close'),
            }}
          />
        );
      default:
        return null;
    }
  };

  if (realtimeBootstrapIdRef.current === null) {
    realtimeBootstrapIdRef.current = Date.now();
  }
  const effectiveRealtimeEpochForChildren =
    realtimeSubscriptionEpoch > 0 ? realtimeSubscriptionEpoch : realtimeBootstrapIdRef.current;

  const previewOrientationToggle = dashboardShell === 'web-preview' ? (
    <button
      type="button"
      onClick={() => {
        setPreviewOrientation((prev) => togglePreviewOrientation(prev));
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
        });
      }}
      className="fixed top-4 right-4 z-50 cursor-pointer whitespace-nowrap rounded-xl border border-indigo-400/40 bg-white/95 px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-indigo-500/60 hover:bg-white hover:shadow-xl md:top-6 md:right-6"
      aria-label={
        previewOrientation === 'portrait'
          ? dt('aria_preview_landscape')
          : dt('aria_preview_portrait')
      }
    >
      {previewOrientation === 'portrait'
        ? dt('preview_landscape_btn')
        : dt('preview_portrait_btn')}
    </button>
  ) : null;

  return (
    <>
      {previewOrientationToggle}
      <div
        className="app-container"
        data-shell={dashboardShell}
        data-preview-orientation={
          dashboardShell === 'web-preview' ? previewOrientation : undefined
        }
      >

      {/* Nickname Modal */}
      {isNicknameModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNicknameModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <span className="modal-icon">✏️</span>
              {dt('nickname_modal_title')}
            </h3>
            <div className="modal-form">
              <div className="form-field">
                <label className="form-label">{dt('nickname_label')}</label>
                <input 
                  ref={nicknameInputRef}
                  type="text" 
                  className="form-input" 
                  placeholder={dt('nickname_placeholder')}
                  maxLength={20}
                  defaultValue={userName}
                />
              </div>
              <div className="form-field">
                <label className="form-label">{getMemberManagementTranslation(lang, 'family_role_label')}</label>
                <select
                  className="form-input"
                  value={nicknameModalFamilyRole ?? ''}
                  onChange={(e) => setNicknameModalFamilyRole(e.target.value === '' ? null : e.target.value as 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other')}
                >
                  <option value="">{getMemberManagementTranslation(lang, 'family_role_none')}</option>
                  {(groupIsOwner || groupUserRole === 'ADMIN') ? (
                    <>
                      <option value="mom">{getMemberManagementTranslation(lang, 'family_role_mom')}</option>
                      <option value="dad">{getMemberManagementTranslation(lang, 'family_role_dad')}</option>
                    </>
                  ) : (
                    <>
                      <option value="son">{getMemberManagementTranslation(lang, 'family_role_son')}</option>
                      <option value="daughter">{getMemberManagementTranslation(lang, 'family_role_daughter')}</option>
                      <option value="grandpa">{getMemberManagementTranslation(lang, 'family_role_grandpa')}</option>
                      <option value="grandma">{getMemberManagementTranslation(lang, 'family_role_grandma')}</option>
                      <option value="other">{getMemberManagementTranslation(lang, 'family_role_other')}</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setIsNicknameModalOpen(false)} 
                className="btn-secondary"
              >
                {ct('cancel')}
              </button>
              <button 
                onClick={handleUpdateNickname} 
                className="btn-primary"
              >
                {dt('nickname_save_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지사항 배너 — app-container의 직접 flex 자식: main-content 위에 상단 고정 */}
      {announcements.length > 0 && (
        <AnnouncementBanner 
          announcements={announcements.map((a) => {
            const { title, content } = getAnnouncementTexts(a as Parameters<typeof getAnnouncementTexts>[0], lang);
            return { id: a.id, title, content, created_at: a.created_at, is_read: a.is_read };
          })}
          onMarkAsRead={handleMarkAsRead}
          label={dt('announcements_label')}
        />
      )}

      {/* Main Content - 본문 폰트 상속 */}
      <div
        className="main-content [font-family:var(--dashboard-body-font)]"
        style={dashboardMainContentStyle}
      >

        {/* 타이틀 + 관리자 버튼 한 줄 (공지사항 아래, 타이틀 왼쪽 / 관리자 오른쪽) */}
        <div
          className="box-border flex min-h-12 w-full min-w-0 max-w-full items-center gap-3 px-1"
        >
          <h1
            style={dashboardTitleStyle}
          >
            <AppTitleContent title={dashboardTitleText} />
          </h1>
          {isGroupLoading ? (
            <div
              className="h-7 w-20 shrink-0 animate-pulse rounded-lg bg-slate-200"
            />
          ) : showAdminButton ? (
            <button
              onClick={() => router.push(adminPagePath)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-none px-2.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow ${
                isSystemAdmin ? 'bg-purple-700' : 'bg-blue-600'
              }`}
              aria-label={isSystemAdmin ? dt('aria_system_admin') : dt('aria_group_admin')}
            >
              <span className="text-sm">⚙️</span>
              {ct('admin')}
            </button>
          ) : null}
        </div>

        {/* Header (사진 액자 항상 표시, 타이틀/배경 제거) */}
        <header className="app-header">
          <TitlePage 
            title={currentGroup?.family_name?.trim() || state.familyName || ct('app_title')}
            photos={stableAlbum}
            titleStyle={effectiveTitleStyle}
            onTitleStyleChange={(style) => {
              setTitleStyle(style);
              updateState('UPDATE_TITLE_STYLE', style);
            }}
            editable={false}
            showTitle={false}
            noBackground
            frameStyleStorageScope={currentGroupId}
            onFrameClick={() => router.push('/memories')}
          />
          <div className="status-indicator">
            <span className="status-dot">
              <span className="status-dot-ping"></span>
              <span className="status-dot-core"></span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {onlineUsers.map((user) => {
                const nicknamePart = (
                  user.isCurrentUser ? (userName?.trim() || user.name.trim()) : user.name.trim()
                ) || '';
                const rolePart = familyRoleByUserId[user.id]
                  ? `${getFamilyRoleEmoji(familyRoleByUserId[user.id])} ${getFamilyRoleLabel(lang, familyRoleByUserId[user.id])}`
                  : '';
                return (
                <div 
                  key={user.id}
                  className={`user-info rounded-md border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.1)] px-1.5 py-[3px] ${
                    user.isCurrentUser ? 'cursor-pointer' : 'cursor-default'
                  }`} 
                  onClick={user.isCurrentUser ? () => setIsNicknameModalOpen(true) : undefined}
                >
                  <span className="user-icon text-xs">👤</span>
                  <p className={`user-name m-0 text-xs ${user.isCurrentUser ? 'font-semibold' : 'font-medium'}`}>
                    {nicknamePart ? `${nicknamePart} ` : ''}
                    {rolePart}
                    {user.isCurrentUser && ct('me_suffix')}
                  </p>
                </div>
                );
              })}
              {onlineUsers.length === 0 && (
                <div className="user-info cursor-pointer" onClick={() => setIsNicknameModalOpen(true)}>
                  <span className="user-icon">👤</span>
                  <p className="user-name">
                    {(() => {
                      const nick = userName?.trim() || '';
                      const role = familyRoleByUserId[userId]
                        ? `${getFamilyRoleEmoji(familyRoleByUserId[userId])} ${getFamilyRoleLabel(lang, familyRoleByUserId[userId])}`
                        : '';
                      if (!nick && !role) return ct('loading');
                      return (
                        <>
                          {nick ? `${nick} ` : ''}
                          {role}
                          {ct('me_suffix')}
                        </>
                      );
                    })()}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="ml-3 cursor-pointer whitespace-nowrap rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 transition-all duration-300 hover:border-red-500/50 hover:bg-red-500/20"
            >
              {ct('logout')}
            </button>
          </div>
        </header>


        {/* Content Sections Container */}
        <div ref={dashboardGridRef} className="sections-container min-w-0 w-full">
          {/* 위젯 간 간격: CSS gap-3만 — layout Y에 gap 행 단위 없음 */}
          <div
            className="dashboard-widget-grid grid min-w-0 gap-3"
            data-columns={dashboardColumnCount}
            data-layout={dashboardIsLandscapeGrid ? 'landscape' : 'portrait'}
            style={{
              gridTemplateColumns: `repeat(${dashboardColumnCount}, minmax(0, 1fr))`,
              gridAutoFlow: 'row',
              gridAutoRows: `minmax(${dashboardCellRowH}px, auto)`,
            }}
          >
            {orderedWidgets.map((cfg) => {
              const placement = resolveWidgetGridPlacement(cfg, dashboardColumnCount, dashboardIsLandscapeGrid);
              const { colSpan, rowSpan } = placement;
              const isExpanded = expandedWidget === cfg.widget_key;
              const isRecentlyClosed = recentlyClosedWidget === cfg.widget_key;

              // Phase E: S 사이즈 여부 — 실제 layout 너비가 portrait 6열(50%) 이하이면 S로 판단.
              // landscape: 12열(24열 기준 50%) 이하. 미설정(null)이면 size 프리셋으로 폴백.
              const sMaxUnits = dashboardIsLandscapeGrid ? LANDSCAPE_COLS / 2 : PORTRAIT_COLS / 2;
              const effectiveW = dashboardIsLandscapeGrid
                ? (cfg.layoutLandscapeW ?? cfg.layoutW)
                : (cfg.layoutPortraitW ?? cfg.layoutW);
              const isSmallWidget = effectiveW != null
                ? effectiveW <= sMaxUnits
                : cfg.size === 'S';

              return (
                <div
                  key={cfg.widget_key}
                  // isolate: 각 위젯이 독립 stacking context를 가지도록 해
                  // tasks: overflow-hidden 제거 — 셀 높이가 내용(칠판)에 맞게 잡히도록
                  className={
                    cfg.widget_key === 'tasks'
                      ? 'min-w-0 max-w-full isolate overflow-visible'
                      : 'min-w-0 max-w-full isolate overflow-x-clip overflow-y-visible'
                  }
                  data-widget-size={cfg.size}
                  style={buildWidgetGridItemStyle(cfg.widget_key, placement, dashboardCellRowH)}
                >
                  <WidgetChrome
                    widgetKey={cfg.widget_key}
                    layoutW={cfg.layoutW}
                    layoutH={cfg.layoutH}
                    colSpan={colSpan}
                    rowSpan={rowSpan}
                    onExpand={isSmallWidget ? () => setExpandedWidget(cfg.widget_key) : undefined}
                    expandLabel={dt('widgets_magnify_open')}
                  >
                    {isExpanded || isRecentlyClosed ? (
                      /* 팝업으로 열린 동안, 또는 닫힌 직후 250ms 동안 플레이스홀더 표시
                         — 이중 렌더링(구독 중복) 방지
                         — isRecentlyClosed: 모달 언마운트의 비동기 구독 해제 완료 후
                           그리드 리마운트하도록 race condition 방지 */
                      <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                        🔍
                      </div>
                    ) : (
                      renderWidgetSection(cfg.widget_key, rowSpan)
                    )}
                  </WidgetChrome>
                </div>
              );
            })}
          </div>

          {/* 돋보기(팝업) 모달 — 위젯이 사용성 임계값 미만일 때 🔍 버튼으로 열림
              children: renderWidgetSection 1회만 호출 (구독 중복 방지) */}
          <WidgetMagnifyModal
            open={expandedWidget !== null}
            widgetLabel={expandedWidget ? (widgetLabelMap[expandedWidget] ?? '') : ''}
            isChatWidget={expandedWidget === 'chat'}
            closeLabel={dt('widgets_magnify_close')}
            onClose={handleMagnifyClose}
          >
            {expandedWidget && renderWidgetSection(expandedWidget)}
          </WidgetMagnifyModal>

          <FamilyLocationRequestModal
          open={showLocationRequestModal}
          userId={userId}
          loadingUsers={loadingUsers}
          allUsers={allUsers}
          onlineUsers={onlineUsers}
          locationRequests={locationRequests}
          onBackdropClose={() => {
            setShowLocationRequestModal(false);
            setSelectedUserForRequest(null);
            setLoadingUsers(false);
            setAllUsers([]);
            loadingUsersRef.current = false;
            modalOpenedRef.current = false;
          }}
          onSendLocationRequest={sendLocationRequest}
          onRefreshUsers={() => {
            loadAllUsers(0, currentGroupId ? { groupId: currentGroupId } : undefined);
          }}
          t={{
            location_modal_send_title: dt('location_modal_send_title'),
            location_modal_loading_users: dt('location_modal_loading_users'),
            location_modal_all_users_count: dt('location_modal_all_users_count'),
            location_modal_online: dt('location_modal_online'),
            location_modal_user_fallback: dt('location_modal_user_fallback'),
            location_modal_id_prefix: dt('location_modal_id_prefix'),
            location_modal_btn_send: dt('location_modal_btn_send'),
            location_already_approved: dt('location_already_approved'),
            location_request_pending: dt('location_request_pending'),
            location_modal_empty: dt('location_modal_empty'),
            location_modal_empty_hint: dt('location_modal_empty_hint'),
            location_modal_refresh: dt('location_modal_refresh'),
          }}
          closeLabel={ct('close')}
          familyRoleByUserId={familyRoleByUserId}
          getFamilyRoleEmoji={getFamilyRoleEmoji}
          getFamilyRoleLabel={getFamilyRoleLabel}
          lang={lang}
        />
      </div>
      </div>
      
      {/* 업로드 상태 애니메이션 스타일 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* 후임자 지정 모달 */}
      {showSuccessorModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
          onClick={() => {
            setShowSuccessorModal(false);
            setSelectedSuccessor('');
          }}
        >
          <div
            className="max-h-[80vh] w-[90%] max-w-[500px] overflow-y-auto rounded-2xl bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="mb-4 flex items-center gap-3 text-2xl font-bold text-slate-800"
            >
              <Shield className="h-7 w-7 text-purple-700" />
              후임 시스템 관리자 지정
            </h2>
            <p
              className="mb-6 text-sm leading-relaxed text-slate-500"
            >
              {dt('delete_transfer_warning')}
              <br />
              아래 목록에서 후임 시스템 관리자를 선택해주세요.
            </p>

            <div className="mb-6">
              <label
                className="mb-3 block text-sm font-semibold text-slate-600"
              >
                후임자 선택
              </label>
              <select
                value={selectedSuccessor}
                onChange={(e) => setSelectedSuccessor(e.target.value)}
                className="w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none"
              >
                <option value="">후임자를 선택하세요</option>
                {allUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nickname || user.email}
                    {user.nickname && ` (${user.email})`}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="flex justify-end gap-3"
            >
              <button
                onClick={() => {
                  setShowSuccessorModal(false);
                  setSelectedSuccessor('');
                }}
                className="cursor-pointer rounded-lg border-none bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-all duration-200"
              >
                취소
              </button>
              <button
                onClick={handleTransferAndDelete}
                disabled={!selectedSuccessor}
                className={`rounded-lg border-none px-6 py-3 text-sm font-semibold text-white transition-all duration-200 ${
                  selectedSuccessor
                    ? 'cursor-pointer bg-purple-700 opacity-100'
                    : 'cursor-not-allowed bg-slate-400 opacity-60'
                }`}
              >
                후임자 지정 및 탈퇴
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 고정: 일반 멤버 문의 + 회원탈퇴 (작게·간격 축소·모서리에 붙여 지도 가림 최소화) */}
      <div
        className="pointer-events-none fixed bottom-[calc(4px+env(safe-area-inset-bottom,0px))] right-[calc(6px+env(safe-area-inset-right,0px))] z-[1000] flex flex-col items-end gap-1.5"
      >
        {showMemberInquiryFab && (
          <button
            type="button"
            onClick={() => router.push('/dashboard/member-support')}
            className="pointer-events-auto relative max-w-[min(88vw,220px)] cursor-pointer whitespace-nowrap rounded-lg border-none bg-orange-500 px-[9px] py-[5px] text-[11px] font-bold leading-[1.25] text-white shadow-[0_2px_8px_rgba(249,115,22,0.28)]"
            aria-label={
              hasUnreadAdminReply
                ? `${dt('member_support_fab')} (${dt('member_support_fab_aria_unread')})`
                : dt('member_support_fab')
            }
          >
            {dt('member_support_fab')}
            {hasUnreadAdminReply && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 box-content h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500"
              />
            )}
          </button>
        )}
        <button
          onClick={() => handleDeleteAccount()}
          className="pointer-events-auto flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border-none bg-[rgba(139,69,19,0.9)] px-[9px] py-[5px] text-[11px] font-semibold leading-[1.25] text-white shadow-[0_2px_8px_rgba(139,69,19,0.32)] transition-all duration-200 ease-in-out hover:bg-[rgba(139,69,19,1)] hover:shadow-[0_3px_10px_rgba(139,69,19,0.45)]"
          aria-label={dt('delete_account_aria')}
        >
          <span className="text-xs leading-none" aria-hidden>🗑️</span>
          {dt('delete_account_btn')}
        </button>
      </div>
    </div>
    </>
  );
}
