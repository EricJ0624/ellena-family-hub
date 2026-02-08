'use client';

// 동적 렌더링 강제 (GroupProvider 의존성 때문에)
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  getPushToken, 
  registerServiceWorker,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking
} from '@/lib/webpush';
import TitlePage, { TitleStyle } from '@/app/components/TitlePage';
import { useGroup } from '@/app/contexts/GroupContext';

// --- [CONFIG & SERVICE] 원본 로직 유지 ---
const CONFIG = { STORAGE: 'SFH_DATA_V5', AUTH: 'SFH_AUTH' };

// 사용자별 저장소 키 생성 함수 (기존 구조 유지, 사용자별 분리만 추가)
const getStorageKey = (userId: string) => `${CONFIG.STORAGE}_${userId}`;
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

// --- [TYPES] 타입 안정성 추가 ---
type Todo = { id: number; text: string; assignee: string; done: boolean; created_by?: string; supabaseId?: string | number };
type EventItem = { id: number; month: string; day: string; title: string; desc: string; created_by?: string; supabaseId?: string | number };
type Message = { id: string | number; user: string; text: string; time: string };
type Photo = { 
  id: number; 
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
  }>;
  todos: Todo[];
  album: Photo[];
  events: EventItem[];
  messages: Message[];
  titleStyle?: Partial<TitleStyle>;
}

const INITIAL_STATE: AppState = {
  familyName: "Ellena Family Hub",
  location: { address: "", latitude: 0, longitude: 0, userId: "", updatedAt: "" },
  familyLocations: [],
  todos: [],
  album: [],
  events: [],
  messages: [],
  titleStyle: {
    content: "Ellena Family Hub",
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
  let groupList: any[] = [];
  let groupMemberships: any[] = [];
  let setCurrentGroupId: ((groupId: string | null) => void) | null = null;
  let refreshGroups: (() => Promise<void>) | null = null;
  let refreshMemberships: (() => Promise<void>) | null = null;
  try {
    const groupContext = useGroup();
    currentGroupId = groupContext.currentGroupId;
    groupUserRole = groupContext.userRole;
    groupIsOwner = groupContext.isOwner;
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
  // --- [STATE] ---
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterKey, setMasterKey] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', month: '', day: '', desc: '' });
  const [userId, setUserId] = useState<string>(''); // 사용자 ID 저장
  const [familyId, setFamilyId] = useState<string>(''); // 가족 ID 저장 (가족 단위 필터링용)
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string; isCurrentUser: boolean }>>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState<boolean>(false);
  const [adminStatusResolved, setAdminStatusResolved] = useState(false);
  const [photoDescription, setPhotoDescription] = useState<string>('');
  const [hoveredPhotoId, setHoveredPhotoId] = useState<number | null>(null);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [piggySummary, setPiggySummary] = useState<{
    name: string;
    walletBalance: number;
    bankBalance: number;
  } | null>(null);
  const [piggySummaryError, setPiggySummaryError] = useState<string | null>(null);
  const [showGroupSelectModal, setShowGroupSelectModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
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
  const [selectedUserForRequest, setSelectedUserForRequest] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; email: string; nickname?: string | null }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const loadingUsersRef = useRef(false); // 중복 호출 방지용 ref
  const modalOpenedRef = useRef(false); // 모달이 이미 열렸는지 추적
  
  // Realtime subscription 참조 (로그아웃 시 정리용) - 기능별 분리 관리
  const subscriptionsRef = useRef<{
    messages: any;
    tasks: any;
    events: any;
    photos: any;
    presence: any;
    locations: any;
    locationRequests: any;
  }>({ 
    messages: null, 
    tasks: null, 
    events: null, 
    photos: null,
    presence: null,
    locations: null,
    locationRequests: null
  });

  // Inputs Ref (Uncontrolled inputs for cleaner handlers similar to original)
  const todoTextRef = useRef<HTMLInputElement>(null);
  const todoWhoRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const geolocationWatchIdRef = useRef<number | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const googleMapsScriptLoadedRef = useRef<boolean>(false); // Google Maps 스크립트 로드 상태 추적
  const processingRequestsRef = useRef<Set<string>>(new Set()); // 처리 중인 요청 ID 추적 (중복 호출 방지)
  const lastLoadedGroupIdRef = useRef<string | null>(null); // 그룹 변경 시 사진 재로드 중복 방지
  
  // 타이틀 스타일 상태
  const [titleStyle, setTitleStyle] = useState<Partial<TitleStyle>>({
    content: INITIAL_STATE.familyName,
    color: '#9333ea',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 0,
    fontFamily: 'Inter',
  });
  
  // 가족 이름 수정 모달 상태
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');

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
        .from('memory_vault')
        .select('id, image_url, cloudinary_url, s3_original_url, file_type, original_filename, mime_type, created_at, uploader_id, caption, group_id')
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

      // Photo 형식으로 변환 (URL 우선순위: cloudinary_url > s3_original_url > image_url)
      return photos.map((photo: any) => ({
        id: photo.id,
        data: photo.image_url || photo.cloudinary_url || photo.s3_original_url || '',
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
    const storageKey = getStorageKey(userId);
    const saved = localStorage.getItem(storageKey);
    
    let localState: AppState | null = null;
    if (saved) {
      const decrypted = CryptoService.decrypt(saved, key);
      if (!decrypted) {
        alert("보안 키가 일치하지 않습니다.");
        return;
      }
      localState = decrypted;
      setState(decrypted);
      // titleStyle도 함께 불러오기
      if (decrypted.titleStyle) {
        setTitleStyle(decrypted.titleStyle);
      }
    }
    // ✅ setState(INITIAL_STATE) 제거 - album을 빈 배열로 초기화하지 않음
    // 재로그인 시에도 기존 state를 유지하고, Supabase에서 사진을 로드한 후 업데이트

    // ✅ Supabase에서 사진 불러오기 (Multi-tenant: group_id 필터링)
    try {
      if (!currentGroupId) {
        console.warn('loadData: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
        return;
      }

      const { data: photos, error } = await supabase
        .from('memory_vault')
        .select('id, image_url, cloudinary_url, s3_original_url, file_type, original_filename, mime_type, created_at, uploader_id, caption, group_id')
        .eq('group_id', currentGroupId) // Multi-tenant: group_id로 직접 필터링
        .order('created_at', { ascending: false })
        .limit(100);

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
          .filter((photo: any) => photo.image_url || photo.cloudinary_url || photo.s3_original_url)
          .map((photo: any) => ({
            id: photo.id,
            data: photo.image_url || photo.cloudinary_url || photo.s3_original_url || '',
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
          // localStorage에서 직접 사진 데이터 확인 (state 업데이트 지연 문제 해결)
          const storageKey = getStorageKey(userId);
          const saved = localStorage.getItem(storageKey);
          let localStoragePhotos: Photo[] = [];
          
          if (saved) {
            try {
              const decrypted = CryptoService.decrypt(saved, key);
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
          
          // localStorage에만 있는 사진 (업로드 중인 Base64/Blob만)
          const localStorageOnlyPhotos = localStoragePhotos.filter(p => {
            const supabaseId = p.supabaseId ? String(p.supabaseId) : null;
            if (supabaseId && supabasePhotoIds.has(supabaseId)) {
              return false; // Supabase에 이미 있으면 제외
            }
            // 업로드 중이거나 Base64/Blob 데이터만 유지
            return p.isUploading || (p.data && (p.data.startsWith('data:') || p.data.startsWith('blob:')));
          });

          // Supabase 사진 우선, localStorage 전용 사진 추가
          const mergedAlbum = [...supabasePhotos, ...localStorageOnlyPhotos];

          if (process.env.NODE_ENV === 'development') {
            console.log('✅ loadData: 사진 병합 완료', {
              supabasePhotos: supabasePhotos.length,
              localStorageOnlyPhotos: localStorageOnlyPhotos.length,
              mergedAlbum: mergedAlbum.length,
              hasLocalStorage: !!saved,
              prevAlbumLength: prev.album?.length || 0
            });
          }
          
          return {
            ...prev,
            album: mergedAlbum,
          };
        });
      } else {
        // ✅ Supabase에 사진이 없으면 localStorage 사진만 사용 (정상 동작)
        // localStorage도 없으면 빈 배열 유지 (이미 INITIAL_STATE로 초기화됨)
        if (process.env.NODE_ENV === 'development') {
          console.log('Supabase에 사진이 없습니다.', {
            hasLocalStorage: !!saved,
            willUseLocalStorage: saved !== null
          });
        }
        // ✅ localStorage가 있으면 이미 위에서 setState(decrypted)로 설정됨
        // localStorage가 없으면 빈 배열 유지 (INITIAL_STATE)
        // Supabase에 사진이 없어도 state를 업데이트하지 않음 (기존 state 유지)
      }
    } catch (supabaseError: any) {
      // Supabase 불러오기 실패해도 localStorage 사진은 사용 가능
      console.warn('Supabase에서 사진 불러오기 실패 (localStorage 사진은 사용 가능):', supabaseError?.message || supabaseError);
      // ✅ 에러 발생 시에도 state를 업데이트하지 않음 (기존 state 유지)
      // localStorage가 있으면 이미 위에서 setState(decrypted)로 설정됨
    }

    const authKey = getAuthKey(userId);
    sessionStorage.setItem(authKey, key);
    setIsAuthenticated(true);
  }, []);

  // 새로고침 직후 currentGroupId가 늦게 설정되는 경우를 대비해 그룹 기준으로 사진 로드 재시도
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated || !userId || !currentGroupId) return;
    if (lastLoadedGroupIdRef.current === currentGroupId) return;

    const authKey = getAuthKey(userId);
    const key = masterKey || sessionStorage.getItem(authKey) ||
      process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';

    lastLoadedGroupIdRef.current = currentGroupId;
    loadData(key, userId).catch(() => undefined);
  }, [isAuthenticated, userId, currentGroupId, masterKey, loadData]);

  // --- [EFFECTS] ---
  
  // 1. Mount Check (Next.js Hydration Error 방지)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 2. Auth Check on Load
  useEffect(() => {
    if (!isMounted) return;
    
    // Supabase 인증 확인
    const checkAuth = async () => {
      try {
        // 근본 원인 해결: getSession() 호출 전에 localStorage 세션 데이터 검증
        if (typeof window !== 'undefined') {
          try {
            const storedSession = localStorage.getItem('sb-auth-token');
            if (storedSession) {
              try {
                const parsed = JSON.parse(storedSession);
                // refresh_token이 없거나 유효하지 않으면 사전에 정리
                if (!parsed?.refresh_token || typeof parsed.refresh_token !== 'string' || parsed.refresh_token.trim() === '') {
                  localStorage.removeItem('sb-auth-token');
                }
              } catch (parseError) {
                // JSON 파싱 실패 = 손상된 데이터 → 정리
                localStorage.removeItem('sb-auth-token');
              }
            }
          } catch (error) {
            // localStorage 접근 실패는 무시
          }
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Refresh Token 에러 처리 (만료된 토큰인 경우)
        // 근본 원인 해결: 에러를 조용히 처리하고 localStorage 정리
        if (error) {
          // "Invalid Refresh Token" 또는 "Refresh Token Not Found" 에러인 경우
          if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
            // localStorage에서 세션 정보 제거 (에러 메시지 출력 안 함)
            if (typeof window !== 'undefined') {
              localStorage.removeItem('sb-auth-token');
            }
            // 로그아웃 처리 (에러 메시지 출력 안 함)
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
        
        // Supabase 세션이 있으면 바로 대시보드 표시
        setIsAuthenticated(true);
        
        // 사용자 ID 저장
        const currentUserId = session.user.id;
        setUserId(currentUserId);
        
        // family_id 가져오기 (user_metadata에서 가져오거나 기본값 사용)
        // 모든 가족 구성원이 동일한 family_id를 공유하도록 설정
        const userFamilyId = session.user.user_metadata?.family_id 
          || process.env.NEXT_PUBLIC_FAMILY_ID 
          || 'ellena_family'; // 기본 family_id
        setFamilyId(userFamilyId);
        
        // 시스템 관리자 확인
        const { data: isAdmin } = await supabase.rpc('is_system_admin', {
          user_id_param: currentUserId,
        });

        // 그룹 확인
        const { data: memberships } = await supabase
          .from('memberships')
          .select('group_id')
          .eq('user_id', currentUserId)
          .limit(1);

        // 그룹 소유자 확인
        const { data: ownedGroups } = await supabase
          .from('groups')
          .select('id')
          .eq('owner_id', currentUserId)
          .limit(1);

        const hasGroups = (memberships && memberships.length > 0) || (ownedGroups && ownedGroups.length > 0);

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

        // 사용자 이름 가져오기 (profiles 테이블의 nickname 우선, 없으면 user_metadata)
        if (session.user) {
          // 먼저 profiles 테이블에서 nickname 조회
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', currentUserId)
            .single();

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
        
        // ✅ 데이터 로드 (기존 키 또는 새로 생성한 고정 키 사용)
        // await를 추가하여 loadData 완료 후 다음 단계 진행 보장
        await loadData(key, currentUserId);
      } catch (err) {
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
        if (isAuthenticated) {
          router.push('/');
        }
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [isMounted, router, loadData, isAuthenticated]);

  // Piggy Bank 요약 정보 로드 (그룹 선택 시)
  useEffect(() => {
    if (!isAuthenticated || !currentGroupId) {
      setPiggySummary(null);
      return;
    }

    let cancelled = false;
    const loadPiggySummary = async () => {
      try {
        setPiggySummaryError(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
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

        if (cancelled) return;
        setPiggySummary({
          name: result.data?.account?.name || 'Ellena Piggy Bank',
          walletBalance: result.data?.wallet?.balance ?? 0,
          bankBalance: result.data?.account?.balance ?? 0,
        });
      } catch (err: any) {
        if (cancelled) return;
        setPiggySummaryError(err.message || 'Piggy Bank 정보를 불러오지 못했습니다.');
      }
    };

    loadPiggySummary();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentGroupId]);

  // 로그인 후 그룹 선택 모달 (일반 사용자)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (!adminStatusResolved) return;
    if (!groupList || groupList.length <= 1) {
      setShowGroupSelectModal(false);
      return;
    }
    if (typeof window === 'undefined') return;
    const completed = sessionStorage.getItem('groupSelectionCompleted');
    if (completed === 'true') return;
    setSelectedGroupId(currentGroupId || groupList[0]?.id || null);
    setShowGroupSelectModal(true);
  }, [isAuthenticated, userId, isSystemAdmin, adminStatusResolved, groupList, currentGroupId]);

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

    try {
      // 주소 변환 (쓰로틀링: 최소 60초 간격 - 무료 할당량 절약)
      const now = Date.now();
      const lastGeocodeUpdate = sessionStorage.getItem('lastGeocodeUpdate');
      let currentAddress = state.location.address || ''; // 기존 주소 유지
      
      if (!lastGeocodeUpdate || now - parseInt(lastGeocodeUpdate) > 60000) {
        try {
          // reverseGeocode 사용 (일관된 형식으로 변환)
          currentAddress = await reverseGeocode(latitude, longitude);
          
          // 주소 변환이 실패하면 재시도 (최대 2번)
          if (!currentAddress || currentAddress.trim() === '') {
            console.warn('주소 변환 실패, 재시도 중...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            currentAddress = await reverseGeocode(latitude, longitude);
            
            // 여전히 실패하면 한 번 더 시도
            if (!currentAddress || currentAddress.trim() === '') {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
              currentAddress = await reverseGeocode(latitude, longitude);
            }
          }

          // 주소가 여전히 없으면 formatted_address에서 추출 시도
          if (!currentAddress || currentAddress.trim() === '') {
            try {
              const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
              if (googleMapApiKey) {
                const response = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapApiKey}&language=ko`
                );
                const data = await response.json();
                
                if (data.status === 'OK' && data.results && data.results.length > 0) {
                  const formattedAddress = data.results[0].formatted_address;
                  if (formattedAddress) {
                    currentAddress = extractLocationAddress(formattedAddress);
                  }
                }
              }
            } catch (error) {
              console.warn('주소 변환 최종 시도 실패:', error);
            }
          }

          // 주소 변환 성공 시 세션 스토리지에 저장
          if (currentAddress && currentAddress.trim() !== '') {
            sessionStorage.setItem('lastGeocodeUpdate', now.toString());
          }
        } catch (geocodeError) {
          console.warn('주소 변환 오류:', geocodeError);
          // 기존 주소 유지
          currentAddress = state.location.address || '';
        }
      }

      // 주소가 여전히 없으면 저장하지 않음 (좌표는 표시하지 않음)
      if (!currentAddress || currentAddress.trim() === '') {
        console.warn('주소 변환 실패, 위치 업데이트 건너뜀');
        return;
      }

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

      // Supabase에 위치 저장 (일관된 형식으로)
      try {
        const { error } = await supabase
          .from('user_locations')
          .upsert({
            user_id: userId,
            latitude: latitude,
            longitude: longitude,
            address: currentAddress, // extractLocationAddress로 변환된 주소
            last_updated: new Date().toISOString()
          }, {
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

  // 3. Scroll Chat to Bottom
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [state.messages, isAuthenticated]);

  // ✅ 지도 마커 업데이트 함수 (재사용 가능, useCallback으로 외부에서도 호출 가능)
  // AdvancedMarkerElement 사용으로 deprecated 경고 해결
  const updateMapMarkers = useCallback(() => {
    if (!mapRef.current || typeof window === 'undefined' || !(window as any).google) return;

    try {
      const google = (window as any).google;
      const { AdvancedMarkerElement, PinElement } = google.maps.marker || {};

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
            labelDiv.textContent = userName || '나';
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
              text: userName || '나',
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
            labelDiv.textContent = userName || '나';
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
              title: `${userName || '내'} 위치`,
              content: container
            });
          } else {
            // 폴백: 기존 Marker API 사용
            myMarker = new google.maps.Marker({
              position: { lat: state.location.latitude, lng: state.location.longitude },
              map: mapRef.current,
              title: `${userName || '내'} 위치`,
              label: {
                text: userName || '나',
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

      // 승인된 사용자들의 위치 마커 업데이트 또는 생성
      state.familyLocations.forEach((loc) => {
        if (loc.latitude && loc.longitude && loc.userId && loc.userId !== userId) {
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
                background: '#EA4335',
                borderColor: '#ffffff',
                glyphColor: '#ffffff',
                scale: 1.2
              });
              const labelDiv = document.createElement('div');
              labelDiv.textContent = loc.userName || '사용자';
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
              existingMarker.setLabel({
                text: loc.userName || '사용자',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
              });
            }
          } else {
            // 새 마커 생성
            let marker;
            if (useAdvancedMarker) {
              const pinElement = new PinElement({
                background: '#EA4335',
                borderColor: '#ffffff',
                glyphColor: '#ffffff',
                scale: 1.2
              });
              const labelDiv = document.createElement('div');
              labelDiv.textContent = loc.userName || '사용자';
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
                title: `${loc.userName}의 위치`,
                content: container
              });
            } else {
              // 폴백: 기존 Marker API 사용
              marker = new google.maps.Marker({
                position: { lat: loc.latitude, lng: loc.longitude },
                map: mapRef.current,
                title: `${loc.userName}의 위치`,
                label: {
                  text: loc.userName || '사용자',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold'
                },
                icon: {
                  url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                }
              });
            }
            markersRef.current.set(loc.userId, marker);
          }
        }
      });

      // familyLocations에 없는 사용자의 마커 제거
      const currentUserIds = new Set(state.familyLocations.map((loc: any) => loc.userId).filter((id: string) => id !== userId));
      markersRef.current.forEach((marker, markerUserId) => {
        if (markerUserId !== 'my-location' && !currentUserIds.has(markerUserId)) {
          if (useAdvancedMarker && marker.map) {
            marker.map = null;
          } else if (marker.setMap) {
            marker.setMap(null);
          }
          markersRef.current.delete(markerUserId);
        }
      });
    } catch (error) {
      console.error('지도 마커 업데이트 오류:', error);
    }
  }, [state.location, state.familyLocations, userName, userId]);

  // 4. Google Maps 지도 초기화 및 실시간 마커 업데이트 (승인된 사용자만 표시)
  useEffect(() => {
    const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!googleMapApiKey) {
      console.error('Google Maps API 키가 설정되지 않았습니다. NEXT_PUBLIC_GOOGLE_MAP_API_KEY 환경 변수를 확인해주세요.');
      setMapError('Google Maps API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
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
              setMapError('Google Maps API 키 설정 오류: Google Cloud Console에서 API 키의 도메인 제한 설정을 확인하고, Maps JavaScript API가 활성화되어 있는지 확인해주세요.');
            } else if (errorMessage.includes('Referer') || 
                       errorMessage.includes('domain')) {
              setMapError('현재 도메인에서 Google Maps API를 사용할 수 없습니다. Google Cloud Console → API 및 서비스 → 사용자 인증 정보에서 API 키의 HTTP 리퍼러(웹사이트) 제한에 Vercel 도메인을 추가해주세요.');
            } else {
              setMapError('Google Maps를 불러오는데 실패했습니다. Google Cloud Console에서 Maps JavaScript API 활성화 및 결제 계정 연결을 확인해주세요.');
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
        // ✅ 처음 초기화하는 경우에만 기존 마커 제거
        if (!mapRef.current) {
          // 기존 마커 모두 제거 (처음 초기화 시에만)
        markersRef.current.forEach((marker) => {
          marker.setMap(null);
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
          setMapError('Google Maps API 키가 유효하지 않습니다. API 키와 도메인 제한 설정을 확인해주세요.');
        } else if (error?.message?.includes('RefererNotAllowedMapError') ||
                   error?.message?.includes('Referer')) {
          setMapError('현재 도메인에서 Google Maps API를 사용할 수 없습니다. Google Cloud Console에서 API 키의 도메인 제한을 확인해주세요.');
        } else {
          setMapError('Google Maps를 불러오는데 실패했습니다. API 키와 설정을 확인해주세요.');
        }
        setMapLoaded(false);
      }
    };

    // Google Maps API 스크립트 로드 (중복 방지)
    // google.maps.Map이 사용 가능한지 확인 (완전히 로드되었는지 확인)
    if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
      // 이미 로드되어 있으면 바로 초기화
      initializeMap();
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
            setMapError('Google Maps API 스크립트를 불러오는데 시간이 오래 걸립니다. API 키와 설정을 확인해주세요.');
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
              setMapError('Google Maps API를 초기화하는데 실패했습니다. API 키와 설정을 확인해주세요.');
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
          
          setMapError('Google Maps API 스크립트를 불러오는데 실패했습니다. 브라우저 콘솔과 Google Cloud Console의 로그 탐색기를 확인해주세요.');
          setMapLoaded(false);
        };
        
        document.head.appendChild(script);
      }
    }
  }, [state.location.latitude, state.location.longitude, state.familyLocations, locationRequests, userId, mapLoaded, updateMapMarkers]);

  // 5. Supabase 데이터 로드 및 Realtime 구독
  useEffect(() => {
    // SSR 보호: 클라이언트에서만 실행
    if (typeof window === 'undefined') {
      return;
    }
    
    if (!isAuthenticated || !userId || !currentGroupId) {
      console.log('Realtime 구독 스킵 - 인증되지 않음:', { isAuthenticated, userId });
      return;
    }
    
    console.log('✅ Realtime 구독 시작 - userId:', userId);

    // 최신 키를 항상 가져오는 헬퍼 함수 (클로저 문제 해결)
    const getCurrentKey = () => {
      const authKey = getAuthKey(userId);
      return masterKey || sessionStorage.getItem(authKey) || 
        process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
    };

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
      const presenceSubscription = supabase
      .channel(`online_users:${currentGroupId}`)
      .on('presence', { event: 'sync' }, async () => {
        const state = presenceSubscription.presenceState();
        const usersList: Array<{ id: string; name: string; isCurrentUser: boolean }> = [];
        
        // 현재 사용자 정보 추가
        if (userId) {
          usersList.push({
            id: userId,
            name: userName || '나',
            isCurrentUser: true
          });
        }
        
        // 다른 사용자들의 정보 추가 (profiles 테이블에서 nickname 조회)
        const otherUserIds = Object.keys(state)
          .map((presenceId) => {
            const presence = state[presenceId];
            if (Array.isArray(presence) && presence.length > 0) {
              const userPresence = presence[0] as any;
              return userPresence.groupId === currentGroupId ? userPresence.userId : null;
            }
            return null;
          })
          .filter((uid): uid is string => uid !== null && uid !== userId);

        // profiles 테이블에서 다른 사용자들의 nickname 조회
        if (otherUserIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, nickname, email')
            .in('id', otherUserIds);

          const profilesMap = new Map(
            (profilesData || []).map((p: any) => [p.id, p])
          );

        Object.keys(state).forEach((presenceId) => {
            const presence = state[presenceId];
            if (Array.isArray(presence) && presence.length > 0) {
              const userPresence = presence[0] as any;
              const uid = userPresence.userId;
            if (uid && uid !== userId && userPresence.groupId === currentGroupId) {
                // profiles 테이블의 nickname 우선, 없으면 Presence의 userName, 없으면 기본값
                const profile = profilesMap.get(uid);
                const displayName = profile?.nickname 
                  || profile?.email 
                  || userPresence.userName 
                  || `사용자 ${uid.length > 8 ? uid.substring(uid.length - 8) : uid}`;
                usersList.push({
                  id: uid,
                  name: displayName,
                  isCurrentUser: false
                });
              }
            }
          });
        } else {
          // otherUserIds가 없어도 Presence에서 직접 가져오기
          Object.keys(state).forEach((presenceId) => {
            const presence = state[presenceId];
            if (Array.isArray(presence) && presence.length > 0) {
              const userPresence = presence[0] as any;
              const uid = userPresence.userId;
              if (uid && uid !== userId && userPresence.groupId === currentGroupId) {
                const displayName = userPresence.userName || `사용자 ${uid.length > 8 ? uid.substring(uid.length - 8) : uid}`;
                usersList.push({
                  id: uid,
                  name: displayName,
                  isCurrentUser: false
                });
              }
            }
          });
        }
        
        console.log('현재 로그인 중인 사용자 목록 (Presence):', usersList);
        setOnlineUsers(usersList);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('사용자 접속:', key, newPresences);
        const state = presenceSubscription.presenceState();
        const usersList: Array<{ id: string; name: string; isCurrentUser: boolean }> = [];
        
        if (userId) {
          usersList.push({
            id: userId,
            name: userName || '나',
            isCurrentUser: true
          });
        }
        
        Object.keys(state).forEach((presenceId) => {
          const presence = state[presenceId];
          if (Array.isArray(presence) && presence.length > 0) {
            const userPresence = presence[0] as any;
            const uid = userPresence.userId;
            if (uid && uid !== userId && userPresence.groupId === currentGroupId) {
              // Presence에서 userName을 가져오거나, 없으면 기본값 사용
              const displayName = userPresence.userName || `사용자 ${uid.length > 8 ? uid.substring(uid.length - 8) : uid}`;
              usersList.push({
                id: uid,
                name: displayName,
                isCurrentUser: false
              });
            }
          }
        });
        
        setOnlineUsers(usersList);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('사용자 접속 해제:', key, leftPresences);
        const state = presenceSubscription.presenceState();
        const usersList: Array<{ id: string; name: string; isCurrentUser: boolean }> = [];
        
        if (userId) {
          usersList.push({
            id: userId,
            name: userName || '나',
            isCurrentUser: true
          });
        }
        
        Object.keys(state).forEach((presenceId) => {
          const presence = state[presenceId];
          if (Array.isArray(presence) && presence.length > 0) {
            const userPresence = presence[0] as any;
            const uid = userPresence.userId;
            if (uid && uid !== userId && userPresence.groupId === currentGroupId) {
              // Presence에서 userName을 가져오거나, 없으면 기본값 사용
              const displayName = userPresence.userName || `사용자 ${uid.length > 8 ? uid.substring(uid.length - 8) : uid}`;
              usersList.push({
                id: uid,
                name: displayName,
                isCurrentUser: false
              });
            }
          }
        });
        
        setOnlineUsers(usersList);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Presence subscription 연결 성공');
          subscriptionsRef.current.presence = presenceSubscription;
          // 현재 사용자의 presence 전송
          await presenceSubscription.track({
            userId: userId,
            userName: userName || '나',
            groupId: currentGroupId,
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

    // 2. 메시지 구독 설정
    const setupMessagesSubscription = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // 기존 구독 정리
      if (subscriptionsRef.current.messages) {
        supabase.removeChannel(subscriptionsRef.current.messages);
        subscriptionsRef.current.messages = null;
      }

      console.log('📨 메시지 subscription 설정 중...');
      const messagesSubscription = supabase
        .channel('family_messages_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'family_messages' },
          (payload: any) => {
            console.log('Realtime 메시지 INSERT 이벤트 수신 (family_messages 테이블):', payload);
            const newMessage = payload.new;
            
            // 검증: 올바른 테이블에서 온 데이터인지 확인
            if (!newMessage || !newMessage.id) {
              console.error('Realtime 메시지: 잘못된 payload:', payload);
              return;
            }
            
            // 암호화된 메시지 복호화 (암호화된 형식인 경우에만)
            const messageText = newMessage.message_text || '';
            let decryptedText = messageText;
            const messageKey = getCurrentKey();
            if (messageKey && messageText) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = messageText.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(messageText, messageKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    decryptedText = messageText;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = messageText;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = messageText;
              }
            } else {
              decryptedText = messageText;
            }
            
            const createdAt = new Date(newMessage.created_at);
            const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            
            setState(prev => {
              // 같은 ID를 가진 메시지가 이미 있으면 추가하지 않음
              const existingMessage = prev.messages?.find(m => String(m.id) === String(newMessage.id));
              if (existingMessage) {
                return prev;
              }
              
              // 자신이 입력한 항목이면 임시 ID 항목을 찾아서 교체
              if (newMessage.sender_id === userId) {
                // 임시 ID 항목을 찾기: 같은 텍스트를 가진 임시 ID 항목
                const recentDuplicate = prev.messages?.find(m => {
                  const isTempId = typeof m.id === 'number';
                  // 30초 이내에 추가된 임시 항목만 체크 (Realtime 지연 고려)
                  const isRecent = isTempId && (m.id as number) > (Date.now() - 30000);
                  // 텍스트가 정확히 일치하는지 확인
                  return isRecent && m.text === decryptedText;
                });
                
                if (recentDuplicate) {
                  // 임시 항목을 Supabase ID로 교체
                  return {
                    ...prev,
                    messages: prev.messages.map(m => 
                      m.id === recentDuplicate.id 
                        ? {
                            id: newMessage.id,
                            user: '사용자',
                            text: decryptedText,
                            time: timeStr
                          }
                        : m
                    )
                  };
                }
                
                // 임시 항목을 찾지 못했지만, 같은 텍스트를 가진 메시지가 있으면 추가하지 않음 (중복 방지)
                const duplicateByContent = prev.messages?.find(m => 
                  m.text === decryptedText &&
                  String(m.id) !== String(newMessage.id) // 같은 ID가 아닌 경우만
                );
                if (duplicateByContent) {
                  return prev; // 중복이면 추가하지 않음
                }
              }
              
              // 다른 사용자가 입력한 메시지이거나, 자신이 입력한 메시지이지만 임시 항목이 없으면 추가
              return {
                ...prev,
                messages: [...prev.messages, {
                  id: newMessage.id,
                  user: '사용자',
                  text: decryptedText,
                  time: timeStr
                }]
              };
            });
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'family_messages' },
          (payload: any) => {
            const updatedMessage = payload.new;
            
            // 암호화된 메시지 복호화 (암호화된 형식인 경우에만)
            const messageText = updatedMessage.message_text || '';
            let decryptedText = messageText;
            const updateMessageKey = getCurrentKey();
            if (updateMessageKey && messageText) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = messageText.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(messageText, updateMessageKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    decryptedText = messageText;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = messageText;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = messageText;
              }
            } else {
              decryptedText = messageText;
            }
            
            const createdAt = new Date(updatedMessage.created_at);
            const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            
            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m => 
                m.id === updatedMessage.id 
                  ? {
                      id: updatedMessage.id,
                      user: '사용자',
                      text: decryptedText,
                      time: timeStr
                    }
                  : m
              )
            }));
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'family_messages' },
          (payload: any) => {
            console.log('Realtime 메시지 DELETE 이벤트 수신 (family_messages 테이블):', payload);
            
            const deletedMessage = payload.old;
            const deletedId = deletedMessage?.id;
            if (!deletedId) {
              console.warn('Realtime 메시지 DELETE: deletedId가 없음:', payload);
              return;
            }
            // Multi-tenant 아키텍처: group_id 필터링 (group_id가 있는 경우에만 검증)
            if (deletedMessage?.group_id != null && deletedMessage.group_id !== currentGroupId) {
              return;
            }
            const deletedIdStr = String(deletedId).trim();
            console.log('Realtime 메시지 DELETE 처리:', { deletedId, deletedIdStr, deletedIdType: typeof deletedId });
            setState(prev => {
              const beforeCount = prev.messages.length;
              const filtered = prev.messages.filter(m => {
                // ID 비교: 여러 형식 지원 (숫자, 문자열, UUID)
                const mId = m.id;
                const mIdStr = String(mId).trim();
                return mIdStr !== deletedIdStr;
              });
              const afterCount = filtered.length;
              const deletedCount = beforeCount - afterCount;
              console.log('Realtime 메시지 DELETE 결과:', { beforeCount, afterCount, deleted: deletedCount, deletedId: deletedIdStr });
              if (deletedCount === 0 && beforeCount > 0) {
                console.warn('⚠️ Realtime 메시지 DELETE - 삭제된 항목이 없음. ID 불일치 가능성:', {
                  deletedId: deletedIdStr,
                  existingIds: prev.messages.slice(0, 3).map(m => ({ id: m.id, idType: typeof m.id }))
                });
              }
              return {
                ...prev,
                messages: filtered
              };
            });
          }
        )
        .subscribe((status, err) => {
          console.log('📨 Realtime 메시지 subscription 상태:', status);
          if (err) {
            console.error('❌ Realtime 메시지 subscription 오류:', err);
            // 오류 발생 시 상태만 업데이트 (cleanup은 useEffect return에서 수행)
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 메시지 subscription 연결 성공');
            subscriptionsRef.current.messages = messagesSubscription;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('⚠️ Realtime 메시지 subscription 연결 실패:', status);
            // 연결 실패 시 상태만 업데이트 (cleanup은 useEffect return에서 수행)
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
        const hasLocalStorageData = state.messages.length > 0 || 
                                    state.todos.length > 0 || 
                                    state.events.length > 0 || 
                                    state.album.length > 0;
        
        // localStorage에서 직접 사진 데이터 확인 (state 업데이트 지연 문제 해결)
        const storageKey = getStorageKey(userId);
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

        // 메시지 로드
        const { data: messagesData, error: messagesError } = await supabase
          .from('family_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(50);

        if (!messagesError && messagesData) {
          const formattedMessages: Message[] = messagesData.map((msg: any) => {
            const createdAt = new Date(msg.created_at);
            const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            // 암호화된 메시지 복호화 (암호화된 형식인 경우에만)
            let decryptedText = msg.message_text || '';
            if (currentKey && msg.message_text) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = msg.message_text.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(msg.message_text, currentKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    // 복호화 실패 - 원본 텍스트 사용
                    decryptedText = msg.message_text;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = msg.message_text;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = msg.message_text;
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
              decryptedText = msg.message_text;
            }
            return {
              id: msg.id, // 메시지 ID 저장 (DELETE를 위해 필요)
              user: '사용자', // sender_name 컬럼이 없으므로 기본값 사용 (실제로는 sender_id로 조인 필요)
              text: decryptedText,
              time: timeStr
            };
          });
          
          // Supabase 메시지가 있으면 사용
          // localStorage가 비어있으면 Supabase 데이터로 복구, 있으면 Supabase 데이터 우선
          if (formattedMessages.length > 0) {
            setState(prev => ({
              ...prev,
              messages: formattedMessages
            }));
          }
          // Supabase에 메시지가 없고 localStorage 데이터도 없으면 초기 상태 유지
        }

        // 할일 로드 (Multi-tenant: group_id 필터링)
        if (!currentGroupId) {
          console.warn('loadInitialData: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
          return;
        }

        const { data: tasksData, error: tasksError } = await supabase
          .from('family_tasks')
          .select('*')
          .eq('group_id', currentGroupId) // Multi-tenant: group_id로 직접 필터링
          .order('created_at', { ascending: false });

        if (!tasksError && tasksData) {
          const formattedTodos: Todo[] = tasksData.map((task: any) => {
            // 암호화된 텍스트 복호화 (암호화된 형식인 경우에만)
            const taskText = task.title || task.task_text || '';
            let decryptedText = taskText;
            if (currentKey && currentKey.length > 0 && taskText && taskText.length > 0) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = taskText.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(taskText, currentKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    decryptedText = taskText;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = taskText;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = taskText;
              }
            } else {
              decryptedText = taskText;
            }
            // 담당자(assignee) 처리: assigned_to가 UUID 타입이므로 NULL일 수 있음
            // 담당자 정보는 title에 포함되거나 기본값 '누구나' 사용
            let decryptedAssignee = '누구나';
            // assigned_to가 NULL이 아니고 문자열인 경우에만 복호화 시도 (UUID 타입이므로 일반적으로 NULL)
            if (task.assigned_to && typeof task.assigned_to === 'string' && task.assigned_to !== '누구나' && !task.assigned_to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              try {
                const decrypted = CryptoService.decrypt(task.assigned_to, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedAssignee = decrypted;
                }
    } catch (e) {
                // 복호화 실패 시 기본값 사용
                if (process.env.NODE_ENV === 'development') {
                  console.warn('담당자 복호화 실패:', e);
                }
              }
            }
            
            return {
              id: task.id,
              text: decryptedText,
              assignee: decryptedAssignee,
              done: task.is_completed || false, // is_completed 컬럼 사용
              created_by: task.created_by || undefined // 생성자 ID 저장
            };
          });
          
          // Supabase 할일이 있으면 사용
          // localStorage가 비어있으면 Supabase 데이터로 복구, 있으면 Supabase 데이터 우선
          if (formattedTodos.length > 0) {
            setState(prev => ({
              ...prev,
              todos: formattedTodos
            }));
          }
          // Supabase에 할일이 없고 localStorage 데이터도 없으면 초기 상태 유지
        }

        // 일정 로드 (Multi-tenant: group_id 필터링)
        const { data: eventsData, error: eventsError } = await supabase
          .from('family_events')
          .select('*')
          .eq('group_id', currentGroupId) // Multi-tenant: group_id로 직접 필터링
          .order('event_date', { ascending: true }); // event_date 컬럼명 사용

        if (!eventsError && eventsData) {
          const formattedEvents: EventItem[] = eventsData.map((event: any) => {
            // event_date, date, event_date_time 등 여러 가능한 컬럼명 지원
            const eventDateValue = event.event_date || event.date || event.event_date_time || new Date().toISOString();
            const eventDate = new Date(eventDateValue);
            const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const day = eventDate.getDate().toString();
            // 암호화된 제목 및 설명 복호화
            // event_title 대신 title 사용 (실제 테이블 구조에 맞게)
            const eventTitleField = event.title || event.event_title || '';
            const eventDescField = event.description || '';
            let decryptedTitle = eventTitleField;
            let decryptedDesc = eventDescField;
            if (currentKey && currentKey.length > 0) {
              // 제목 복호화 (암호화된 형식인 경우에만)
              if (eventTitleField && eventTitleField.length > 0) {
                const isEncrypted = eventTitleField.startsWith('U2FsdGVkX1');
                if (isEncrypted) {
                  try {
                    const decryptedTitleData = CryptoService.decrypt(eventTitleField, currentKey);
                    if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                      decryptedTitle = decryptedTitleData;
                    } else {
                      decryptedTitle = eventTitleField;
                    }
                  } catch (e: any) {
                    decryptedTitle = eventTitleField;
                  }
                } else {
                  // 이미 평문이면 그대로 사용
                  decryptedTitle = eventTitleField;
                }
              }
              // 설명 복호화 (암호화된 형식인 경우에만)
              if (eventDescField && eventDescField.length > 0) {
                const isEncrypted = eventDescField.startsWith('U2FsdGVkX1');
                if (isEncrypted) {
                  try {
                    const decryptedDescData = CryptoService.decrypt(eventDescField, currentKey);
                    if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                      decryptedDesc = decryptedDescData;
                    } else {
                      decryptedDesc = eventDescField;
                    }
                  } catch (e: any) {
                    decryptedDesc = eventDescField;
                  }
                } else {
                  // 이미 평문이면 그대로 사용
                  decryptedDesc = eventDescField;
                }
              }
            } else {
              decryptedTitle = eventTitleField;
              decryptedDesc = eventDescField;
            }
            return {
              id: event.id,
              month: month,
              day: day,
              title: decryptedTitle,
              desc: decryptedDesc
            };
          });
          
          // Supabase 일정이 있으면 사용
          // localStorage가 비어있으면 Supabase 데이터로 복구, 있으면 Supabase 데이터 우선
          if (formattedEvents.length > 0) {
            setState(prev => ({
              ...prev,
              events: formattedEvents
            }));
          }
          // Supabase에 일정이 없고 localStorage 데이터도 없으면 초기 상태 유지
        }

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


    // 3. 할일 구독 설정
    const setupTasksSubscription = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // 기존 구독 정리
      if (subscriptionsRef.current.tasks) {
        supabase.removeChannel(subscriptionsRef.current.tasks);
        subscriptionsRef.current.tasks = null;
      }

      const tasksSubscription = supabase
        .channel('family_tasks_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'family_tasks' },
          (payload: any) => {
            console.log('Realtime 할일 INSERT 이벤트 수신 (family_tasks 테이블):', payload);
            const newTask = payload.new;
            
            // 검증: 올바른 테이블에서 온 데이터인지 확인
            if (!newTask || !newTask.id) {
              console.error('Realtime 할일: 잘못된 payload:', payload);
              return;
            }
            
            // Multi-tenant 아키텍처: group_id 필터링
            if (newTask.group_id !== currentGroupId) {
              if (process.env.NODE_ENV === 'development') {
                console.log('Realtime 할일: 다른 그룹의 데이터는 무시합니다.', {
                  eventGroupId: newTask.group_id,
                  currentGroupId
                });
              }
              return;
            }
            // 암호화된 텍스트 복호화 (암호화된 형식인 경우에만)
            const taskText = newTask.title || newTask.task_text || '';
            let decryptedText = taskText;
            const taskKey = getCurrentKey();
            if (taskKey && taskKey.length > 0 && taskText && taskText.length > 0) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = taskText.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(taskText, taskKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    decryptedText = taskText;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = taskText;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = taskText;
              }
            } else {
              decryptedText = taskText;
            }
            
            // 담당자(assignee) 처리: assigned_to가 UUID 타입이므로 NULL일 수 있음
            // 담당자 정보는 복호화된 텍스트에서 추출 (예: "텍스트 - Daddy" 형식)
            let decryptedAssignee = '누구나';
            
            // 복호화된 텍스트에서 assignee 추출 (예: "이것도 될까? - Daddy" -> "Daddy")
            if (decryptedText && decryptedText.includes(' - ')) {
              const parts = decryptedText.split(' - ');
              if (parts.length >= 2) {
                // 마지막 부분을 assignee로 사용
                const extractedAssignee = parts[parts.length - 1].trim();
                if (extractedAssignee && extractedAssignee.length > 0) {
                  decryptedAssignee = extractedAssignee;
                }
              }
            }
            
            // assigned_to가 NULL이 아니고 문자열인 경우에만 복호화 시도 (암호화된 형식인 경우에만)
            // 하지만 텍스트에서 추출한 assignee가 우선
            if (decryptedAssignee === '누구나' && newTask.assigned_to && typeof newTask.assigned_to === 'string' && newTask.assigned_to !== '누구나' && !newTask.assigned_to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = newTask.assigned_to.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(newTask.assigned_to, taskKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedAssignee = decrypted;
                  }
                } catch (e) {
                  // 복호화 실패 - 기본값 사용 (조용히 처리)
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedAssignee = newTask.assigned_to;
              }
            }
            
            setState(prev => {
              // 기준 1: 같은 ID를 가진 할일이 이미 있으면 추가하지 않음 (모든 사용자 동일)
              const existingTaskById = prev.todos?.find(t => String(t.id) === String(newTask.id));
              if (existingTaskById) {
                return prev;
              }
              
              // 기준 2: 자신이 입력한 항목이면 임시 ID 항목을 찾아서 교체 (모든 사용자 동일)
              if (newTask.created_by === userId) {
                // 임시 ID 항목을 찾기: 같은 텍스트를 가진 임시 ID 항목 (assignee 포함 여부와 관계없이)
                const recentDuplicate = prev.todos?.find(t => {
                  const isTempId = typeof t.id === 'number';
                  // 30초 이내에 추가된 임시 항목만 체크 (Realtime 지연 고려)
                  const isRecent = isTempId && (t.id as number) > (Date.now() - 30000);
                  // 텍스트가 정확히 일치하는지 확인 (assignee 포함 여부와 관계없이)
                  return isRecent && t.text === decryptedText;
                });
                
                if (recentDuplicate) {
                  // 임시 항목을 Supabase ID로 교체
                  return {
                    ...prev,
                    todos: prev.todos.map(t => 
                      t.id === recentDuplicate.id 
                        ? {
                            id: newTask.id,
                            text: decryptedText,
                            assignee: decryptedAssignee,
                            done: newTask.is_completed || false
                          }
                        : t
                    )
                  };
                }
                
                // 임시 항목을 찾지 못했지만, 같은 텍스트를 가진 항목이 있으면 추가하지 않음 (중복 방지)
                const duplicateByContent = prev.todos?.find(t => 
                  t.text === decryptedText &&
                  String(t.id) !== String(newTask.id) // 같은 ID가 아닌 경우만
                );
                if (duplicateByContent) {
                  return prev; // 중복이면 추가하지 않음
                }
              }
              
              // 기준 3: 다른 사용자가 입력한 항목이거나, 자신이 입력한 항목이지만 임시 항목이 없으면 추가 (모든 사용자 동일)
              return {
                ...prev,
                todos: [{
                  id: newTask.id,
                  text: decryptedText,
                  assignee: decryptedAssignee,
                  done: newTask.is_completed || false
                }, ...prev.todos]
              };
            });
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'family_tasks' },
          (payload: any) => {
            const updatedTask = payload.new;
            
            // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
            // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
            // 암호화된 텍스트 복호화 (암호화된 형식인 경우에만)
            const taskText = updatedTask.title || updatedTask.task_text || '';
            let decryptedText = taskText;
            const updateTaskKey = getCurrentKey();
            if (updateTaskKey && updateTaskKey.length > 0 && taskText && taskText.length > 0) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = taskText.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(taskText, updateTaskKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    decryptedText = taskText;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = taskText;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = taskText;
              }
            } else {
              decryptedText = taskText;
            }
            
            // 담당자(assignee) 처리: assigned_to가 UUID 타입이므로 NULL일 수 있음
            // 담당자 정보는 title에 포함되거나 기본값 '누구나' 사용
            let decryptedAssignee = '누구나';
            // assigned_to가 NULL이 아니고 문자열인 경우에만 복호화 시도 (암호화된 형식인 경우에만)
            if (updatedTask.assigned_to && typeof updatedTask.assigned_to === 'string' && updatedTask.assigned_to !== '누구나' && !updatedTask.assigned_to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = updatedTask.assigned_to.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(updatedTask.assigned_to, updateTaskKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedAssignee = decrypted;
                  }
                } catch (e) {
                  // 복호화 실패 - 기본값 사용 (조용히 처리)
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedAssignee = updatedTask.assigned_to;
              }
            }
            
            setState(prev => ({
              ...prev,
              todos: prev.todos.map(t => 
                t.id === updatedTask.id 
                    ? {
                        id: updatedTask.id,
                        text: decryptedText,
                        assignee: decryptedAssignee || t.assignee,
                        done: updatedTask.is_completed !== undefined ? updatedTask.is_completed : t.done // is_completed 컬럼 사용
                      }
                  : t
              )
            }));
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'family_tasks' },
          (payload: any) => {
            console.log('Realtime 할일 DELETE 이벤트 수신 (family_tasks 테이블):', payload);
            
            // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
            // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
            
            // 기준: 모든 사용자에게 동일하게 삭제 반영 (사용자 구분 없음)
            const deletedTask = payload.old;
            const deletedId = deletedTask?.id;
            if (!deletedId) {
              console.warn('Realtime 할일 DELETE: deletedId가 없음:', payload);
              return;
            }
            const deletedIdStr = String(deletedId).trim();
            console.log('Realtime 할일 DELETE 처리:', { deletedId, deletedIdStr, deletedIdType: typeof deletedId });
            setState(prev => {
              const beforeCount = prev.todos.length;
              const filtered = prev.todos.filter(t => {
                // ID 비교: 여러 형식 지원 (숫자, 문자열, UUID)
                const tId = t.id;
                const tIdStr = String(tId).trim();
                const tSupabaseId = t.supabaseId ? String(t.supabaseId).trim() : null;
                
                // 직접 ID 비교 또는 supabaseId 비교
                const isMatch = tIdStr === deletedIdStr || (tSupabaseId && tSupabaseId === deletedIdStr);
                return !isMatch;
              });
              const afterCount = filtered.length;
              const deletedCount = beforeCount - afterCount;
              console.log('Realtime 할일 DELETE 결과:', { beforeCount, afterCount, deleted: deletedCount, deletedId: deletedIdStr });
              if (deletedCount === 0 && beforeCount > 0) {
                console.warn('⚠️ Realtime 할일 DELETE - 삭제된 항목이 없음. ID 불일치 가능성:', {
                  deletedId: deletedIdStr,
                  existingIds: prev.todos.slice(0, 3).map(t => ({ id: t.id, idType: typeof t.id, supabaseId: t.supabaseId }))
                });
              }
              return {
                ...prev,
                todos: filtered
              };
            });
          }
        )
        .subscribe((status, err) => {
          console.log('📋 Realtime 할일 subscription 상태:', status);
          if (err) {
            console.error('❌ Realtime 할일 subscription 오류:', err);
            // 오류 발생 시 상태만 업데이트 (cleanup은 useEffect return에서 수행)
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 할일 subscription 연결 성공');
            subscriptionsRef.current.tasks = tasksSubscription;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('⚠️ Realtime 할일 subscription 연결 실패:', status);
            // 연결 실패 시 상태만 업데이트 (cleanup은 useEffect return에서 수행)
          }
        });
    };

    // 4. 일정 구독 설정
    const setupEventsSubscription = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // 기존 구독 정리
      if (subscriptionsRef.current.events) {
        supabase.removeChannel(subscriptionsRef.current.events);
        subscriptionsRef.current.events = null;
      }
      
      console.log('📅 일정 subscription 설정 중...');
      const eventsSubscription = supabase
        .channel('family_events_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'family_events' },
          (payload: any) => {
            console.log('Realtime 일정 INSERT 이벤트 수신 (family_events 테이블):', payload);
            const newEvent = payload.new;
            
            // 검증: 올바른 테이블에서 온 데이터인지 확인
            if (!newEvent || !newEvent.id) {
              console.error('Realtime 일정: 잘못된 payload:', payload);
              return;
            }
            
            // Multi-tenant 아키텍처: group_id 필터링
            if (newEvent.group_id !== currentGroupId) {
              if (process.env.NODE_ENV === 'development') {
                console.log('Realtime 일정: 다른 그룹의 데이터는 무시합니다.', {
                  eventGroupId: newEvent.group_id,
                  currentGroupId
                });
              }
              return;
            }
            // event_date, date, event_date_time 등 여러 가능한 컬럼명 지원
            const eventDateValue = newEvent.event_date || newEvent.date || newEvent.event_date_time || new Date().toISOString();
            const eventDate = new Date(eventDateValue);
            const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const day = eventDate.getDate().toString();
            
            // 암호화된 제목 및 설명 복호화
            // event_title 대신 title 사용 (실제 테이블 구조에 맞게)
            const newEventTitleField = newEvent.title || newEvent.event_title || '';
            const newEventDescField = newEvent.description || '';
            let decryptedTitle = newEventTitleField;
            let decryptedDesc = newEventDescField;
            const eventKey = getCurrentKey();
            if (eventKey && eventKey.length > 0) {
              // 제목 복호화 (암호화된 형식인 경우에만)
              if (newEventTitleField && newEventTitleField.length > 0) {
                const isEncrypted = newEventTitleField.startsWith('U2FsdGVkX1');
                if (isEncrypted) {
                  try {
                    const decryptedTitleData = CryptoService.decrypt(newEventTitleField, eventKey);
                    if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                      decryptedTitle = decryptedTitleData;
                    } else {
                      decryptedTitle = newEventTitleField;
                    }
                  } catch (e: any) {
                    decryptedTitle = newEventTitleField;
                  }
                } else {
                  // 이미 평문이면 그대로 사용
                  decryptedTitle = newEventTitleField;
                }
              }
              // 설명 복호화 (암호화된 형식인 경우에만)
              if (newEventDescField && newEventDescField.length > 0) {
                const isEncrypted = newEventDescField.startsWith('U2FsdGVkX1');
                if (isEncrypted) {
                  try {
                    const decryptedDescData = CryptoService.decrypt(newEventDescField, eventKey);
                    if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                      decryptedDesc = decryptedDescData;
                    } else {
                      decryptedDesc = newEventDescField;
                    }
                  } catch (e: any) {
                    decryptedDesc = newEventDescField;
                  }
                } else {
                  // 이미 평문이면 그대로 사용
                  decryptedDesc = newEventDescField;
                }
              }
            } else {
              decryptedTitle = newEventTitleField;
              decryptedDesc = newEventDescField;
            }
            
            setState(prev => {
              // 기준 1: 같은 ID를 가진 일정이 이미 있으면 추가하지 않음 (모든 사용자 동일)
              const existingEventById = prev.events?.find(e => String(e.id) === String(newEvent.id));
              if (existingEventById) {
                return prev;
              }
              
              // 기준 2: 자신이 입력한 항목이면 임시 ID 항목을 찾아서 교체 (모든 사용자 동일)
              if (newEvent.created_by === userId) {
                // 임시 ID 항목을 찾기: 같은 제목, 월, 일을 가진 임시 ID 항목
                const recentDuplicate = prev.events?.find(e => {
                  const isTempId = typeof e.id === 'number';
                  // 30초 이내에 추가된 임시 항목만 체크 (Realtime 지연 고려)
                  const isRecent = isTempId && (e.id as number) > (Date.now() - 30000);
                  return isRecent && 
                         e.title === decryptedTitle && 
                         e.month === month && 
                         e.day === day;
                });
                
                if (recentDuplicate) {
                  // 임시 항목을 Supabase ID로 교체
                  return {
                    ...prev,
                    events: prev.events.map(e => 
                      e.id === recentDuplicate.id 
                        ? {
                            id: newEvent.id,
                            month: month,
                            day: day,
                            title: decryptedTitle,
                            desc: decryptedDesc
                          }
                        : e
                    )
                  };
                }
                
                // 임시 항목을 찾지 못했지만, 같은 제목, 월, 일을 가진 항목이 있으면 추가하지 않음 (중복 방지)
                const duplicateByContent = prev.events?.find(e => 
                  e.title === decryptedTitle && 
                  e.month === month && 
                  e.day === day &&
                  String(e.id) !== String(newEvent.id) // 같은 ID가 아닌 경우만
                );
                if (duplicateByContent) {
                  return prev; // 중복이면 추가하지 않음
                }
              }
              
              // 기준 3: 다른 사용자가 입력한 항목이거나, 자신이 입력한 항목이지만 임시 항목이 없으면 추가 (모든 사용자 동일)
              return {
                ...prev,
                events: [{
                  id: newEvent.id,
                  month: month,
                  day: day,
                  title: decryptedTitle,
                  desc: decryptedDesc
                }, ...prev.events]
              };
            });
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'family_events' },
          (payload: any) => {
            const updatedEvent = payload.new;
            
            // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
            // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
            // event_date, date, event_date_time 등 여러 가능한 컬럼명 지원
            const eventDateValue = updatedEvent.event_date || updatedEvent.date || updatedEvent.event_date_time || new Date().toISOString();
            const eventDate = new Date(eventDateValue);
            const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const day = eventDate.getDate().toString();
            
            // 암호화된 제목 및 설명 복호화
            // event_title 대신 title 사용 (실제 테이블 구조에 맞게)
            const updatedEventTitleField = updatedEvent.title || updatedEvent.event_title || '';
            const updatedEventDescField = updatedEvent.description || '';
            let decryptedTitle = updatedEventTitleField;
            let decryptedDesc = updatedEventDescField;
            const updateEventKey = getCurrentKey();
            if (updateEventKey) {
              // 제목 복호화 (암호화된 형식인 경우에만)
              if (updatedEventTitleField) {
                const isEncrypted = updatedEventTitleField.startsWith('U2FsdGVkX1');
                if (isEncrypted) {
                  try {
                    const decryptedTitleData = CryptoService.decrypt(updatedEventTitleField, updateEventKey);
                    if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                      decryptedTitle = decryptedTitleData;
                    } else {
                      decryptedTitle = updatedEventTitleField;
                    }
                  } catch (e: any) {
                    decryptedTitle = updatedEventTitleField;
                  }
                } else {
                  // 이미 평문이면 그대로 사용
                  decryptedTitle = updatedEventTitleField;
                }
              }
              // 설명 복호화 (암호화된 형식인 경우에만)
              if (updatedEventDescField) {
                const isEncrypted = updatedEventDescField.startsWith('U2FsdGVkX1');
                if (isEncrypted) {
                  try {
                    const decryptedDescData = CryptoService.decrypt(updatedEventDescField, updateEventKey);
                    if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                      decryptedDesc = decryptedDescData;
                    } else {
                      decryptedDesc = updatedEventDescField;
                    }
                  } catch (e: any) {
                    decryptedDesc = updatedEventDescField;
                  }
                } else {
                  // 이미 평문이면 그대로 사용
                  decryptedDesc = updatedEventDescField;
                }
              }
            } else {
              decryptedTitle = updatedEventTitleField;
              decryptedDesc = updatedEventDescField;
            }
            
            setState(prev => ({
              ...prev,
              events: prev.events.map(e =>
                e.id === updatedEvent.id
                  ? {
                      id: updatedEvent.id,
                      month: month,
                      day: day,
                      title: decryptedTitle,
                      desc: decryptedDesc
                    }
                  : e
              )
            }));
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'family_events' },
          (payload: any) => {
            console.log('Realtime 일정 DELETE 이벤트 수신 (family_events 테이블):', payload);
            
            // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
            // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
            
            // 기준: 모든 사용자에게 동일하게 삭제 반영 (사용자 구분 없음)
            const deletedEvent = payload.old;
            const deletedId = deletedEvent?.id;
            if (!deletedId) {
              console.warn('Realtime 일정 DELETE: deletedId가 없음:', payload);
              return;
            }
            const deletedIdStr = String(deletedId).trim();
            console.log('Realtime 일정 DELETE 처리:', { deletedId, deletedIdStr, deletedIdType: typeof deletedId });
            setState(prev => {
              const beforeCount = prev.events.length;
              
              // 상세 로깅: 모든 이벤트 ID 확인
              if (process.env.NODE_ENV === 'development') {
                console.log('Realtime 일정 DELETE - 현재 이벤트 목록:', prev.events.map(e => ({
                  id: e.id,
                  idType: typeof e.id,
                  idStr: String(e.id),
                  supabaseId: e.supabaseId,
                  title: e.title?.substring(0, 20)
                })));
                console.log('Realtime 일정 DELETE - 삭제할 ID:', {
                  deletedId,
                  deletedIdStr,
                  deletedIdType: typeof deletedId
                });
              }
              
              const filtered = prev.events.filter(e => {
                // ID 비교: 여러 형식 지원 (숫자, 문자열, UUID)
                const eId = e.id;
                const eIdStr = String(eId).trim().toLowerCase(); // 대소문자 무시
                const eSupabaseId = e.supabaseId ? String(e.supabaseId).trim().toLowerCase() : null;
                const deletedIdStrLower = deletedIdStr.toLowerCase(); // 대소문자 무시
                
                // 직접 ID 비교 또는 supabaseId 비교 (대소문자 무시)
                const isMatch = eIdStr === deletedIdStrLower || 
                               (eSupabaseId && eSupabaseId === deletedIdStrLower) ||
                               eIdStr.replace(/-/g, '') === deletedIdStrLower.replace(/-/g, ''); // 하이픈 제거 후 비교
                
                if (isMatch && process.env.NODE_ENV === 'development') {
                  console.log('✅ Realtime 일정 DELETE - ID 매칭 성공:', {
                    eId: e.id,
                    eIdStr,
                    deletedIdStr,
                    matchType: eIdStr === deletedIdStrLower ? 'exact' : 
                              (eSupabaseId && eSupabaseId === deletedIdStrLower) ? 'supabaseId' : 'normalized'
                  });
                }
                
                return !isMatch;
              });
              const afterCount = filtered.length;
              const deletedCount = beforeCount - afterCount;
              console.log('Realtime 일정 DELETE 결과:', { beforeCount, afterCount, deleted: deletedCount, deletedId: deletedIdStr });
              if (deletedCount === 0 && beforeCount > 0) {
                console.warn('⚠️ Realtime 일정 DELETE - 삭제된 항목이 없음. ID 불일치 가능성:', {
                  deletedId: deletedIdStr,
                  deletedIdLower: deletedIdStr.toLowerCase(),
                  existingIds: prev.events.map(e => ({ 
                    id: e.id, 
                    idType: typeof e.id, 
                    idStr: String(e.id).toLowerCase(),
                    supabaseId: e.supabaseId,
                    title: e.title?.substring(0, 20)
                  }))
                });
              }
              return {
                ...prev,
                events: filtered
              };
            });
          }
        )
        .subscribe((status, err) => {
          console.log('📅 Realtime 일정 subscription 상태:', status);
          if (err) {
            console.error('❌ Realtime 일정 subscription 오류:', err);
            // 오류 발생 시 상태만 업데이트 (cleanup은 useEffect return에서 수행)
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 일정 subscription 연결 성공');
            subscriptionsRef.current.events = eventsSubscription;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('⚠️ Realtime 일정 subscription 연결 실패:', status);
            // 연결 실패 시 상태만 업데이트 (cleanup은 useEffect return에서 수행)
          }
        });
    };

    // 5. 사진 구독 설정
    const setupPhotosSubscription = () => {
      // 클라이언트에서만 실행되도록 보호
      if (typeof window === 'undefined') {
        return;
      }

      // 기존 구독 정리
      if (subscriptionsRef.current.photos) {
        supabase.removeChannel(subscriptionsRef.current.photos);
        subscriptionsRef.current.photos = null;
      }
      
      console.log('📸 사진 subscription 설정 중...');
      const photosSubscription = supabase
        .channel('memory_vault_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'memory_vault' },
          (payload: any) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('Realtime 사진 INSERT 이벤트 수신:', payload);
            }
            const newPhoto = payload.new;
            
            // Multi-tenant 아키텍처: group_id 필터링
            if (newPhoto.group_id !== currentGroupId) {
              if (process.env.NODE_ENV === 'development') {
                console.log('Realtime 사진: 다른 그룹의 데이터는 무시합니다.', {
                  eventGroupId: newPhoto.group_id,
                  currentGroupId
                });
              }
              return;
            }
            
            if (newPhoto.image_url || newPhoto.cloudinary_url || newPhoto.s3_original_url) {
              setState(prev => {
                // 1. ID 기반 중복 체크 (이미 Supabase ID로 업데이트된 경우)
                const existingPhotoById = prev.album.find(p => {
                  const photoId = String(p.id);
                  const supabaseId = p.supabaseId ? String(p.supabaseId) : null;
                  const newPhotoId = String(newPhoto.id);
                  return photoId === newPhotoId || supabaseId === newPhotoId;
                });
                
                if (existingPhotoById) {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('중복 사진 감지 (ID 기반), 추가하지 않음:', { id: newPhoto.id });
                  }
                  return prev; // 이미 있으면 추가하지 않음
                }
                
                // 2. 자신이 업로드한 사진인 경우, 파일명과 크기로 임시 항목 찾기
                if (newPhoto.uploader_id === userId) {
                  // 임시 ID 항목을 찾기: 파일명과 크기가 일치하는 업로드 중인 임시 항목
                  const recentUploadingPhoto = prev.album.find(p => {
                    const isUploading = p.isUploading === true;
                    const isTempId = typeof p.id === 'number';
                    // 30초 이내에 추가된 임시 항목만 체크 (Realtime 지연 고려)
                    const isRecent = isTempId && (p.id as number) > (Date.now() - 30000);
                    // 파일명과 크기가 정확히 일치하는지 확인
                    const filenameMatch = p.originalFilename && newPhoto.original_filename && 
                      p.originalFilename === newPhoto.original_filename;
                    const sizeMatch = p.originalSize && newPhoto.original_file_size && 
                      p.originalSize === newPhoto.original_file_size;
                    return isUploading && isRecent && filenameMatch && sizeMatch;
                  });
                  
                  if (recentUploadingPhoto) {
                if (process.env.NODE_ENV === 'development') {
                      console.log('임시 항목을 파일명/크기로 찾아 Supabase ID로 업데이트:', {
                        tempId: recentUploadingPhoto.id,
                        newId: newPhoto.id,
                        filename: newPhoto.original_filename,
                        size: newPhoto.original_file_size
                      });
                    }
                    // 임시 항목을 Supabase ID로 교체
                    return {
                      ...prev,
                      album: prev.album.map(p => 
                        p.id === recentUploadingPhoto.id
                          ? {
                              ...p,
                              id: newPhoto.id,
                              data: newPhoto.image_url || newPhoto.cloudinary_url || newPhoto.s3_original_url || p.data,
                              originalSize: newPhoto.original_file_size || p.originalSize,
                              originalFilename: newPhoto.original_filename || p.originalFilename,
                              mimeType: newPhoto.mime_type || p.mimeType,
                              supabaseId: newPhoto.id,
                              isUploaded: true,
                              isUploading: false,
                              created_by: newPhoto.uploader_id || newPhoto.created_by || p.created_by
                            }
                          : p
                      )
                    };
                  }
                  
                  // 임시 항목을 찾지 못했으면 Realtime 이벤트 무시 (이미 updateState로 처리됨)
                  if (process.env.NODE_ENV === 'development') {
                    console.log('자신이 업로드한 사진이지만 임시 항목을 찾지 못함, Realtime 이벤트 무시:', { 
                      id: newPhoto.id,
                      filename: newPhoto.original_filename,
                      size: newPhoto.original_file_size
                    });
                  }
                  return prev; // 자신이 업로드한 사진은 Realtime 이벤트 무시
                }
                
                // 3. 다른 사용자가 업로드한 사진만 추가
                if (process.env.NODE_ENV === 'development') {
                  console.log('새 사진 추가 (다른 사용자):', { id: newPhoto.id, url: (newPhoto.image_url || newPhoto.cloudinary_url || newPhoto.s3_original_url || '').substring(0, 50) });
                }
                
                return {
                  ...prev,
                  album: [{
                    id: newPhoto.id,
                    data: newPhoto.image_url || newPhoto.cloudinary_url || newPhoto.s3_original_url || '',
                    originalSize: newPhoto.original_file_size,
                    originalFilename: newPhoto.original_filename,
                    mimeType: newPhoto.mime_type,
                    supabaseId: newPhoto.id,
                    isUploaded: true,
                    isUploading: false,
                    created_by: newPhoto.uploader_id || newPhoto.created_by || undefined
                  }, ...prev.album]
                };
              });
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'memory_vault' },
          (payload: any) => {
            const updatedPhoto = payload.new;
            if (updatedPhoto.image_url || updatedPhoto.cloudinary_url || updatedPhoto.s3_original_url) {
              setState(prev => ({
                ...prev,
                album: prev.album.map(p => 
                  (p.id === updatedPhoto.id || p.supabaseId === updatedPhoto.id)
                    ? {
                        ...p,
                        id: updatedPhoto.id,
                        data: updatedPhoto.image_url || updatedPhoto.cloudinary_url || updatedPhoto.s3_original_url || '',
                        originalSize: updatedPhoto.original_file_size,
                        originalFilename: updatedPhoto.original_filename,
                        mimeType: updatedPhoto.mime_type,
                        supabaseId: updatedPhoto.id,
                        isUploaded: true,
                        created_by: updatedPhoto.user_id || updatedPhoto.created_by || p.created_by
                      }
                    : p
                )
              }));
            }
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'memory_vault' },
          (payload: any) => {
            const deletedId = payload.old?.id;
            if (!deletedId) {
              return;
            }
            setState(prev => ({
              ...prev,
              album: prev.album.filter(p => 
                String(p.id) !== String(deletedId) && 
                (p.supabaseId ? String(p.supabaseId) !== String(deletedId) : true)
              )
            }));
          }
        )
        .subscribe((status, err) => {
          console.log('📸 Realtime 사진 subscription 상태:', status);
          if (err) {
            console.error('❌ Realtime 사진 subscription 오류:', err);
            // 오류 발생 시 상태만 업데이트 (cleanup은 useEffect return에서 수행)
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 사진 subscription 연결 성공');
            subscriptionsRef.current.photos = photosSubscription;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('⚠️ Realtime 사진 subscription 연결 실패:', status);
            // 🔄 재연결 시도 (5초 후)
            setTimeout(() => {
              if (subscriptionsRef.current.photos) {
                supabase.removeChannel(subscriptionsRef.current.photos);
                subscriptionsRef.current.photos = null;
              }
              if (currentGroupId && userId) {
                console.log('🔄 사진 subscription 재연결 시도...');
                setupPhotosSubscription();
              }
            }, 5000);
          }
        });
    };

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
      
      console.log('📍 위치 subscription 설정 중...');
      const locationsSubscription = supabase
        .channel('user_locations_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_locations' },
          (payload: any) => {
            console.log('Realtime 위치 INSERT 이벤트 수신:', payload);
            loadFamilyLocations(); // 위치 목록 다시 로드
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'user_locations' },
          async (payload: any) => {
            console.log('Realtime 위치 UPDATE 이벤트 수신:', payload);
            await loadFamilyLocations(); // 위치 목록 다시 로드
            // ✅ 지도 마커 즉시 업데이트 (리프레시 없이 표시)
            setTimeout(() => {
              updateMapMarkers();
            }, 200);
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

      console.log('📍 위치 요청 subscription 설정 중...');
      const locationRequestsSubscription = supabase
        .channel('location_requests_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'location_requests' },
          async (payload: any) => {
            console.log('📍 Realtime 위치 요청 INSERT 이벤트 수신:', payload);
            // ✅ 현재 사용자가 요청을 받은 경우(target_id)에만 즉시 로드
            const newRequest = payload.new;
            if (newRequest && newRequest.target_id === userId) {
              await loadLocationRequests(); // 위치 요청 목록 다시 로드
              // ✅ UI 업데이트를 위해 상태 강제 갱신
              setState(prev => ({ ...prev }));
            } else {
              // 요청을 보낸 경우에도 목록 업데이트 (상태 동기화)
              loadLocationRequests();
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'location_requests' },
          async (payload: any) => {
            console.log('📍 Realtime 위치 요청 UPDATE 이벤트 수신:', payload);
            // 위치 요청 목록 다시 로드 (완료 대기)
            await loadLocationRequests();
            // locationRequests 상태가 업데이트될 때까지 약간의 지연
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // ✅ 승인된 요청이 있으면 양쪽 사용자 모두 위치 추적 시작
            const updatedRequest = payload.new;
            if (updatedRequest && updatedRequest.status === 'accepted') {
              const isRequester = updatedRequest.requester_id === userId;
              const isTarget = updatedRequest.target_id === userId;
              
              // 양쪽 사용자 모두 위치 추적 시작 (아직 시작하지 않은 경우)
              if ((isRequester || isTarget) && !isLocationSharing) {
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
                    
                    // 주소 변환 (재시도 로직 포함)
                    let address = await reverseGeocode(latitude, longitude);
                    
                    // 주소 변환이 실패하면 재시도 (최대 2번)
                    if (!address || address.trim() === '') {
                      console.warn('주소 변환 실패, 재시도 중...');
                      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
                      address = await reverseGeocode(latitude, longitude);
                      
                      // 여전히 실패하면 한 번 더 시도
                      if (!address || address.trim() === '') {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
                        address = await reverseGeocode(latitude, longitude);
                      }
                    }

                    // 주소가 여전히 없으면 formatted_address에서 추출 시도
                    if (!address || address.trim() === '') {
                      try {
                        const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
                        if (googleMapApiKey) {
                          const response = await fetch(
                            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapApiKey}&language=ko`
                          );
                          const data = await response.json();
                          
                          if (data.status === 'OK' && data.results && data.results.length > 0) {
                            const formattedAddress = data.results[0].formatted_address;
                            if (formattedAddress) {
                              address = extractLocationAddress(formattedAddress);
                            }
                          }
                        }
                      } catch (error) {
                        console.warn('주소 변환 최종 시도 실패:', error);
                      }
                    }

                    // 주소가 여전히 없으면 저장하지 않음 (좌표는 표시하지 않음)
                    if (!address || address.trim() === '') {
                      console.warn('주소 변환 실패, 위치 저장 건너뜀');
                      return;
                    }
                    
                    // 위치 저장 및 추적 시작
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
                    
                    // 위치 추적 시작 (실시간 업데이트)
                    if (!isLocationSharing) {
                      updateLocation();
                    }
                    
                    // ✅ 양쪽 사용자 모두 위치가 표시되도록 위치 목록 다시 로드
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await loadFamilyLocations();
                    
                    // ✅ 지도 마커 즉시 업데이트 (리프레시 없이 표시)
                    setTimeout(() => {
                      updateMapMarkers();
                    }, 300);
                  }
                } catch (error) {
                  console.warn('위치 추적 시작 실패:', error);
                }
              }
            }
            
            // ✅ 취소된 요청이 있으면 양쪽 사용자 모두 요청 목록에서 제거
            if (updatedRequest && updatedRequest.status === 'cancelled') {
              // loadLocationRequests()가 이미 호출되었으므로 UI가 자동으로 업데이트됨
              // 위치 목록도 다시 로드하여 마커 제거
              await loadFamilyLocations();
            }
            
            // 승인 시 위치 목록도 다시 로드 (승인된 요청이 반영된 후)
            // 양쪽 사용자 모두 위치가 저장될 때까지 충분한 대기 시간
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 위치 목록 다시 로드 (양쪽 사용자 위치 모두 포함)
            await loadFamilyLocations();
            
            // ✅ 지도 마커 즉시 업데이트 (리프레시 없이 표시)
            setTimeout(() => {
              updateMapMarkers();
            }, 300);
            
            // 지도 마커 업데이트를 위해 상태 변경 트리거
            setState(prev => ({ ...prev }));
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'location_requests' },
          (payload: any) => {
            console.log('📍 Realtime 위치 요청 DELETE 이벤트 수신:', payload);
            loadLocationRequests(); // 위치 요청 목록 다시 로드
            loadFamilyLocations(); // 위치 목록도 다시 로드
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

      if (process.env.NODE_ENV === 'development') {
        console.log('setupRealtimeSubscriptions - userId:', userId);
        console.log('setupRealtimeSubscriptions - masterKey from state:', masterKey);
        const authKey = getAuthKey(userId);
        console.log('setupRealtimeSubscriptions - currentKey from sessionStorage:', sessionStorage.getItem(authKey));
        const currentKey = getCurrentKey();
        console.log('setupRealtimeSubscriptions - final currentKey:', currentKey ? '있음' : '없음');
      }
      
      // 각 기능별 구독 함수 호출
      setupPresenceSubscription();
      setupMessagesSubscription();
      setupTasksSubscription();
      setupEventsSubscription();
      setupPhotosSubscription();
      setupLocationsSubscription();
      setupLocationRequestsSubscription();
      
      console.log('✅ 모든 Realtime subscription 설정 완료');
    };

    // Supabase 데이터 로드 및 Realtime 구독 설정
    console.log('🔄 Supabase 데이터 로드 시작...');
    // ✅ loadData 완료 후 실행되도록 지연 시간 증가 (loadData가 먼저 완료되도록 보장)
    // 재로그인 시에도 항상 Supabase에서 데이터 로드
    const timer = setTimeout(() => {
      loadSupabaseData().then(() => {
        console.log('✅ Supabase 데이터 로드 완료, Realtime 구독 시작');
        setupRealtimeSubscriptions();
        // 위치 데이터 로드
          loadMyLocation(); // 자신의 위치 먼저 로드
        loadFamilyLocations();
        loadLocationRequests(); // 위치 요청 목록 로드
      }).catch((error) => {
        console.error('❌ Supabase 데이터 로드 실패:', error);
        // 데이터 로드 실패해도 Realtime 구독은 설정
        setupRealtimeSubscriptions();
        // 위치 데이터 로드 시도
          loadMyLocation(); // 자신의 위치 먼저 로드
        loadFamilyLocations();
      });
    }, 500); // ✅ 지연 시간 증가 (loadData 완료 후 실행되도록 보장)
    
    // 모바일/데스크톱 호환성: 앱이 다시 포그라운드로 올 때 Realtime 재연결
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 앱이 포그라운드로 복귀, Realtime 연결 상태 확인...');
        // Realtime subscription 상태 확인 및 필요시 재연결
        const checkAndReconnect = () => {
          // subscription이 존재하는지 확인 (null이면 연결이 끊어진 것으로 간주)
          const hasSubscriptions = 
            subscriptionsRef.current.messages !== null &&
            subscriptionsRef.current.tasks !== null &&
            subscriptionsRef.current.events !== null &&
            subscriptionsRef.current.photos !== null;
          
          // 재연결 로직 제거 (무한 루프 방지)
          // useEffect가 자동으로 재실행되므로 별도 재연결 불필요
          if (hasSubscriptions && process.env.NODE_ENV === 'development') {
            console.log('✅ Realtime 연결 상태 정상');
          }
        };
        
        // 짧은 지연 후 확인 (연결 상태 업데이트 시간 고려)
        setTimeout(checkAndReconnect, 1000);
      }
    };
    
    // 네트워크 재연결 시 Realtime 재연결 제거 (무한 루프 방지)
    // useEffect가 자동으로 재실행되므로 별도 재연결 불필요
    const handleOnline = () => {
      console.log('🌐 네트워크 연결 복구');
      // 재연결은 useEffect 의존성 배열이 자동으로 처리
    };
    
    // 이벤트 리스너 등록
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);
    }
    
    // 정리 함수
    return () => {
      console.log('🧹 Realtime subscription 정리 중...');
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
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
      if (subscriptionsRef.current.photos) {
        supabase.removeChannel(subscriptionsRef.current.photos);
        subscriptionsRef.current.photos = null;
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
    };
  }, [isAuthenticated, userId, masterKey, userName, familyId, currentGroupId]); // familyId 변경 시 데이터 재로드

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
    
    // 비동기로 로드하여 리렌더링과 완전히 분리
    const loadUsers = async () => {
      try {
        console.log('📋 loadAllUsers 호출 시작');
        await loadAllUsers(0); // 명시적으로 retryCount 0 전달
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
  }, [showLocationRequestModal, isAuthenticated, userId]); // loadAllUsers는 useCallback으로 메모이제이션되어 userId, isAuthenticated 변경 시 자동 재생성됨

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
      // ID 기준으로 정렬 (오래된 것부터)
      const sortedAlbum = [...cleanedState.album].sort((a, b) => a.id - b.id);
      
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
    
    try {
      const storageKey = getStorageKey(userId);
      // originalData 제거 (localStorage 공간 절약)
      const stateForStorage: AppState = {
        ...newState,
        album: newState.album.map(photo => {
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
        const cleanedState = checkAndCleanStorage(newState);
        try {
          const storageKey = getStorageKey(userId);
          const stateForStorage: AppState = {
            ...cleanedState,
            album: cleanedState.album.map(photo => {
              const { originalData, ...photoWithoutOriginal } = photo;
              return photoWithoutOriginal;
            })
          };
          localStorage.setItem(storageKey, CryptoService.encrypt(stateForStorage, key));
          alert("저장 공간이 부족하여 오래된 사진이 자동으로 삭제되었습니다.");
        } catch (retryError) {
          alert("브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 수동으로 삭제해 주세요.");
        }
      } else {
      alert("브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 삭제해 주세요.");
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
        case 'ADD_MESSAGE': {
          // 메시지 암호화
          const encryptedText = CryptoService.encrypt(payload.text, currentKey);
          
          const { error } = await supabase
            .from('family_messages')
            .insert({
              sender_id: userId,
              message_text: encryptedText // 암호화된 메시지 저장
              // sender_name 컬럼이 없을 수 있으므로 제거
              // created_at은 자동 생성되므로 제거
            });
          
          if (error) {
            console.error('메시지 저장 오류:', error);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
          }
          break;
        }
        case 'ADD_TODO': {
          // 검증: payload가 올바른지 확인
          if (!payload || !payload.text) {
            console.error('ADD_TODO: 잘못된 payload:', payload);
            return;
          }
          
          // 할일 텍스트 암호화
          const encryptedText = CryptoService.encrypt(payload.text, currentKey);
          
          // Multi-tenant 아키텍처: currentGroupId 필수 검증
          if (!currentGroupId) {
            console.error('ADD_TODO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
            return;
          }

          // 실제 테이블 구조에 맞게 title 컬럼 사용 (task_text가 없음)
          // assigned_to는 UUID 타입이므로 NULL로 저장 (담당자 정보는 title에 포함하거나 별도 처리)
          const taskData: any = {
            group_id: currentGroupId, // Multi-tenant: group_id 필수
            created_by: userId,
            title: encryptedText, // 암호화된 텍스트 저장 (task_text 대신 title 사용)
            assigned_to: null, // UUID 타입이므로 NULL로 저장 (담당자 정보는 암호화된 텍스트에 포함)
            is_completed: payload.done || false // is_completed 컬럼 사용
          };
          
          console.log('ADD_TODO: family_tasks 테이블에 저장:', { text: payload.text.substring(0, 20), assignee: payload.assignee, groupId: currentGroupId });
          
          const { error, data } = await supabase
            .from('family_tasks')
            .insert(taskData)
            .select();
          
          if (error) {
            console.error('할일 저장 오류:', error);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
          } else {
            console.log('ADD_TODO: family_tasks 테이블 저장 성공:', data);
          }
          break;
        }
        case 'TOGGLE_TODO': {
          // 숫자 ID는 로컬 데이터이므로 Supabase 업데이트 시도하지 않음 (UUID 형식만 Supabase에 저장됨)
          const taskId = String(payload.id);
          const isNumericId = typeof payload.id === 'number' || /^\d+$/.test(taskId);
          
          if (isNumericId) {
            if (process.env.NODE_ENV === 'development') {
              console.log('로컬 데이터 업데이트 (Supabase 업데이트 건너뜀):', taskId);
            }
            break; // 로컬 데이터는 Supabase 업데이트 시도하지 않음
          }
          
          // Multi-tenant 아키텍처: currentGroupId 필수 검증
          if (!currentGroupId) {
            console.error('TOGGLE_TODO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
            return;
          }

          // is_completed 컬럼 사용 (실제 테이블 구조에 맞게)
          const updateData: any = {};
          updateData.is_completed = payload.done; // is_completed 컬럼 사용
          
          const { error } = await supabase
            .from('family_tasks')
            .update(updateData)
            .eq('id', payload.id)
            .eq('group_id', currentGroupId); // Multi-tenant: group_id 검증
          
          if (error) {
            console.error('할일 업데이트 오류:', error);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
          }
          break;
        }
        case 'DELETE_TODO': {
          // ID를 문자열로 변환하여 타입 일치 보장
          const taskId = String(payload);
          // 숫자 ID는 로컬 데이터이므로 Supabase 삭제 시도하지 않음 (UUID 형식만 Supabase에 저장됨)
          const isNumericId = typeof payload === 'number' || /^\d+$/.test(taskId);
          
          console.log('saveToSupabase DELETE_TODO:', { taskId, isNumericId, payloadType: typeof payload, familyId: currentFamilyId });
          
          if (isNumericId) {
            console.log('로컬 데이터 삭제 (Supabase 삭제 건너뜀):', taskId);
            break; // 로컬 데이터는 Supabase 삭제 시도하지 않음
          }
          
          // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
          // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
          
          console.log('Supabase 삭제 시도:', { taskId, userId });
          
          // Multi-tenant 아키텍처: currentGroupId 필수 검증
          if (!currentGroupId) {
            console.error('DELETE_TODO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
            return;
          }

          // 삭제 전에 해당 할일이 존재하는지 확인 (그룹 내에서만)
          const { data: existingTask } = await supabase
            .from('family_tasks')
            .select('id, created_by, title, group_id')
            .eq('id', taskId)
            .eq('group_id', currentGroupId) // Multi-tenant: group_id 검증
            .single();
          
          if (existingTask) {
            console.log('삭제할 할일 확인:', {
              id: existingTask.id,
              created_by: existingTask.created_by,
              title: existingTask.title?.substring(0, 30),
              group_id: existingTask.group_id
            });
          }
          
          const { error, data } = await supabase
            .from('family_tasks')
            .delete()
            .eq('id', taskId)
            .eq('group_id', currentGroupId) // Multi-tenant: group_id 검증
            .select();
          
          if (error) {
            console.error('할일 삭제 오류:', error);
            console.error('삭제 시도한 ID:', taskId, '타입:', typeof taskId, 'userId:', userId);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
            throw error; // 에러를 throw하여 낙관적 업데이트 복구 가능하도록
          } else {
            const deletedCount = data?.length || 0;
            console.log('할일 삭제 결과:', { taskId, deletedCount, deletedData: data, userId });
            
            // 삭제된 행이 없고, 할일이 존재한다면 RLS 정책 문제일 가능성이 높음
            if (deletedCount === 0 && existingTask) {
              console.error('⚠️ 할일 삭제 실패: 할일은 존재하지만 삭제 권한이 없습니다.', {
                taskId,
                existingTaskCreatedBy: existingTask.created_by,
                currentUserId: userId,
                isOwner: existingTask.created_by === userId
              });
              throw new Error('삭제 권한이 없습니다. 이 할일을 삭제할 수 없습니다.');
            } else if (deletedCount === 0) {
              console.warn('⚠️ 할일 삭제: 삭제된 행이 없음. ID가 존재하지 않거나 이미 삭제되었을 수 있습니다:', taskId);
              // 할일이 존재하지 않으면 이미 삭제된 것으로 간주하고 에러를 throw하지 않음
            }
          }
          break;
        }
        case 'ADD_EVENT': {
          // 검증: payload가 올바른지 확인
          if (!payload || !payload.title || !payload.month || !payload.day) {
            console.error('ADD_EVENT: 잘못된 payload:', payload);
            return;
          }
          
          // 일정 제목 및 설명 암호화
          const encryptedTitle = CryptoService.encrypt(payload.title, currentKey);
          const encryptedDesc = CryptoService.encrypt(payload.desc || '', currentKey);
          
          // 날짜 파싱 (예: "JAN 1" 또는 "1 JAN" -> 실제 날짜)
          const monthMap: { [key: string]: number } = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
          };
          
          const monthStr = payload.month.toUpperCase();
          const month = monthMap[monthStr];
          
          // month가 유효한지 확인
          if (month === undefined) {
            console.error('유효하지 않은 월:', payload.month);
            alert('유효하지 않은 월 형식입니다. JAN, FEB, MAR 등을 사용해주세요.');
            return;
          }
          
          const day = parseInt(payload.day);
          if (isNaN(day) || day < 1 || day > 31) {
            console.error('유효하지 않은 일:', payload.day);
            alert('일(day)은 1-31 사이의 숫자여야 합니다.');
            return;
          }
          
          const currentYear = new Date().getFullYear();
          const eventDate = new Date(currentYear, month, day);
          
          // Multi-tenant 아키텍처: currentGroupId 필수 검증
          if (!currentGroupId) {
            console.error('ADD_EVENT: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
            return;
          }

          // event_date 컬럼이 없을 수 있으므로 선택적으로 처리
          const eventData: any = {
            group_id: currentGroupId, // Multi-tenant: group_id 필수
            created_by: userId,
            title: encryptedTitle, // 암호화된 제목 저장 (event_title 대신 title 사용)
            description: encryptedDesc, // 암호화된 설명 저장
            // event_date, date, event_date_time 등 여러 가능한 컬럼명 지원
            event_date: eventDate.toISOString()
            // created_at은 자동 생성되므로 제거
          };
          
          console.log('ADD_EVENT: family_events 테이블에 저장:', { title: payload.title.substring(0, 20), month: payload.month, day: payload.day, groupId: currentGroupId });
          
          const { error, data } = await supabase
            .from('family_events')
            .insert(eventData)
            .select();
          
          if (error) {
            console.error('일정 저장 오류:', error);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
          } else {
            console.log('ADD_EVENT: family_events 테이블 저장 성공:', data);
          }
          break;
        }
        case 'DELETE_EVENT': {
          // ID를 문자열로 변환하여 타입 일치 보장
          const eventId = String(payload);
          // 숫자 ID는 로컬 데이터이므로 Supabase 삭제 시도하지 않음 (UUID 형식만 Supabase에 저장됨)
          const isNumericId = typeof payload === 'number' || /^\d+$/.test(eventId);
          
          console.log('saveToSupabase DELETE_EVENT:', { eventId, isNumericId, payloadType: typeof payload, familyId: currentFamilyId });
          
          if (isNumericId) {
            console.log('로컬 데이터 삭제 (Supabase 삭제 건너뜀):', eventId);
            break; // 로컬 데이터는 Supabase 삭제 시도하지 않음
          }
          
          // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
          // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
          
          console.log('Supabase 삭제 시도:', { eventId, eventIdType: typeof eventId, userId });
          
          // Multi-tenant 아키텍처: currentGroupId 필수 검증
          if (!currentGroupId) {
            console.error('DELETE_EVENT: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
            return;
          }

          // 삭제 전에 해당 이벤트가 존재하는지 확인 (그룹 내에서만)
          const { data: existingEvent } = await supabase
            .from('family_events')
            .select('id, created_by, title, group_id')
            .eq('id', eventId)
            .eq('group_id', currentGroupId) // Multi-tenant: group_id 검증
            .single();
          
          if (existingEvent) {
            console.log('삭제할 이벤트 확인:', {
              id: existingEvent.id,
              created_by: existingEvent.created_by,
              title: existingEvent.title?.substring(0, 30),
              group_id: existingEvent.group_id
            });
          } else {
            console.warn('⚠️ 삭제할 이벤트를 찾을 수 없음:', eventId, 'groupId:', currentGroupId);
          }
          
          const { error, data } = await supabase
            .from('family_events')
            .delete()
            .eq('id', eventId)
            .eq('group_id', currentGroupId) // Multi-tenant: group_id 검증
            .select();
          
          if (error) {
            console.error('일정 삭제 오류:', error);
            console.error('삭제 시도한 ID:', eventId, '타입:', typeof eventId, 'userId:', userId);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
            throw error; // 에러를 throw하여 낙관적 업데이트 복구 가능하도록
          } else {
            const deletedCount = data?.length || 0;
            console.log('일정 삭제 결과:', { eventId, deletedCount, deletedData: data, userId });
            
            // 삭제된 행이 없고, 이벤트가 존재한다면 RLS 정책 문제일 가능성이 높음
            if (deletedCount === 0 && existingEvent) {
              console.error('⚠️ 일정 삭제 실패: 이벤트는 존재하지만 삭제 권한이 없습니다.', {
                eventId,
                existingEventCreatedBy: existingEvent.created_by,
                currentUserId: userId,
                isOwner: existingEvent.created_by === userId
              });
              throw new Error('삭제 권한이 없습니다. 이 이벤트를 삭제할 수 없습니다.');
            } else if (deletedCount === 0) {
              console.warn('⚠️ 일정 삭제: 삭제된 행이 없음. ID가 존재하지 않거나 이미 삭제되었을 수 있습니다:', eventId);
              // 이벤트가 존재하지 않으면 이미 삭제된 것으로 간주하고 에러를 throw하지 않음
            }
          }
          break;
        }
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
        case 'TOGGLE_TODO': {
          const todo = prev.todos.find(t => t.id === payload);
          if (todo) {
          newState.todos = prev.todos.map(t => t.id === payload ? { ...t, done: !t.done } : t);
            // Supabase에 저장
            saveToSupabase('TOGGLE_TODO', { id: payload, done: !todo.done }, userId, currentKey);
          }
          break;
        }
        case 'ADD_TODO': {
          // 중복 체크: 같은 텍스트를 가진 할일이 이미 있는지 확인
          // (임시 ID로 추가된 항목이 Realtime으로 다시 들어오는 경우 방지)
          // 30초 이내에 추가된 같은 내용의 항목이 있으면 중복으로 간주 (Realtime 지연 고려)
          const thirtySecondsAgo = Date.now() - 30000;
          const duplicate = prev.todos?.find(t => {
            // 임시 ID (숫자)를 가진 항목만 체크 (Supabase UUID는 제외)
            const isTempId = typeof t.id === 'number';
            // 임시 ID이고 30초 이내에 추가된 항목인지 확인
            const isRecent = isTempId && (t.id as number) > thirtySecondsAgo;
            // 텍스트가 정확히 일치하는지 확인 (assignee 포함 여부와 관계없이)
            return isRecent && t.text === payload.text;
          });
          
          if (duplicate) {
            console.log('중복 할일 감지 (updateState), 추가하지 않음:', { text: payload.text.substring(0, 20) });
            return prev; // 중복이면 상태 변경하지 않음
          }
          
          // Supabase UUID가 아닌 임시 ID로 추가 (Realtime 이벤트에서 Supabase ID로 교체됨)
          newState.todos = [payload, ...prev.todos];
          // Supabase에 저장
          saveToSupabase('ADD_TODO', payload, userId, currentKey);
          break;
        }
        case 'DELETE_TODO': {
          // ID 비교를 안전하게 처리 (number와 string 모두 지원)
          const deleteTodoId = String(payload).trim();
          console.log('updateState DELETE_TODO 호출:', { payload, deleteTodoId, payloadType: typeof payload });
          
          // 낙관적 업데이트: 먼저 화면에서 제거
          const deletedTodo = prev.todos.find(t => String(t.id).trim() === deleteTodoId);
          newState.todos = prev.todos.filter(t => String(t.id).trim() !== deleteTodoId);
          
          // Supabase에 저장 (비동기, 에러 발생 시 복구)
          saveToSupabase('DELETE_TODO', payload, userId, currentKey)
            .catch((error) => {
              console.error('할일 삭제 실패, 복구 중:', error);
              // 에러 발생 시 복구: 삭제된 항목을 다시 추가
              if (deletedTodo) {
                setState(prevState => ({
                  ...prevState,
                  todos: [...prevState.todos, deletedTodo].sort((a, b) => {
                    // ID 기준 정렬 (숫자 ID는 뒤로, UUID는 앞으로)
                    const aIsNum = typeof a.id === 'number';
                    const bIsNum = typeof b.id === 'number';
                    if (aIsNum && !bIsNum) return 1;
                    if (!aIsNum && bIsNum) return -1;
                    return 0;
                  })
                }));
              }
              // 사용자에게 알림
              alert('삭제에 실패했습니다. 다시 시도해주세요.');
            });
          break;
        }
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
                    cloudinaryDeleted: deleteResult.cloudinaryDeleted,
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
        case 'ADD_EVENT': {
          // 중복 체크: 같은 제목과 날짜를 가진 일정이 이미 있는지 확인
          // (임시 ID로 추가된 항목이 Realtime으로 다시 들어오는 경우 방지)
          // 30초 이내에 추가된 같은 내용의 항목이 있으면 중복으로 간주 (Realtime 지연 고려)
          const thirtySecondsAgo = Date.now() - 30000;
          const duplicate = prev.events?.find(e => {
            // 임시 ID (숫자)를 가진 항목만 체크 (Supabase UUID는 제외)
            const isTempId = typeof e.id === 'number';
            // 임시 ID이고 30초 이내에 추가된 항목인지 확인
            const isRecent = isTempId && (e.id as number) > thirtySecondsAgo;
            return isRecent && 
                   e.title === payload.title && 
                   e.month === payload.month && 
                   e.day === payload.day;
          });
          
          if (duplicate) {
            console.log('중복 일정 감지 (updateState), 추가하지 않음:', { title: payload.title.substring(0, 20) });
            return prev; // 중복이면 상태 변경하지 않음
          }
          
          newState.events = [payload, ...prev.events];
          // Supabase에 저장
          saveToSupabase('ADD_EVENT', payload, userId, currentKey);
          break;
        }
        case 'DELETE_EVENT': {
          // ID 비교를 안전하게 처리 (number와 string 모두 지원)
          const deleteEventId = String(payload).trim();
          console.log('updateState DELETE_EVENT 호출:', { payload, deleteEventId, payloadType: typeof payload });
          
          // 낙관적 업데이트: 먼저 화면에서 제거
          const deletedEvent = prev.events.find(e => String(e.id).trim() === deleteEventId);
          newState.events = prev.events.filter(e => String(e.id).trim() !== deleteEventId);
          
          // Supabase에 저장 (비동기, 에러 발생 시 복구)
          saveToSupabase('DELETE_EVENT', payload, userId, currentKey)
            .catch((error) => {
              console.error('일정 삭제 실패, 복구 중:', error);
              // 에러 발생 시 복구: 삭제된 항목을 다시 추가
              if (deletedEvent) {
                setState(prevState => ({
                  ...prevState,
                  events: [...prevState.events, deletedEvent].sort((a, b) => {
                    // 날짜 기준 정렬
                    const monthOrder: { [key: string]: number } = {
                      'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                      'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                    };
                    const monthDiff = (monthOrder[a.month] || 0) - (monthOrder[b.month] || 0);
                    if (monthDiff !== 0) return monthDiff;
                    return parseInt(a.day) - parseInt(b.day);
                  })
                }));
              }
              // 사용자에게 알림
              alert('삭제에 실패했습니다. 다시 시도해주세요.');
            });
          break;
        }
        case 'ADD_MESSAGE':
          newState.messages = [...(prev.messages || []), payload].slice(-50);
          // Supabase에 저장
          saveToSupabase('ADD_MESSAGE', payload, userId, currentKey);
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
                data: payload.cloudinaryUrl || payload.s3Url || photo.data, // URL로 업데이트 (Base64 대신)
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
                      .from('memory_vault')
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


  const handleRename = () => {
    // prompt() 대신 모달 사용 (SSR 환경에서 prompt() 지원 안 됨)
    setRenameInput(state.familyName || 'Ellena Family Hub');
    setShowRenameModal(true);
  };
  
  const handleRenameSubmit = () => {
    if (renameInput?.trim()) {
      const sanitized = sanitizeInput(renameInput, 50);
      if (sanitized) {
        updateState('RENAME', sanitized);
        setTitleStyle(prev => ({ ...prev, content: sanitized }));
      }
    }
    setShowRenameModal(false);
  };
  
  const handleRenameCancel = () => {
    setShowRenameModal(false);
    setRenameInput('');
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

  // 좌표를 주소로 변환 (Reverse Geocoding) - 시/도, 구/군, 도로이름 반환
  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      // Google Maps Geocoding API 사용 (API 키가 있는 경우)
      const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
      if (googleMapApiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapApiKey}&language=ko`
        );
        const data = await response.json();
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          // 첫 번째 결과의 address_components에서 시/도, 구/군, 도로이름 찾기
          const result = data.results[0];
          if (result.address_components) {
            const cityComponent = result.address_components.find((component: any) => 
              component.types && component.types.includes('administrative_area_level_1')
            );
            const districtComponent = result.address_components.find((component: any) => 
              component.types && component.types.includes('administrative_area_level_2')
            );
            const routeComponent = result.address_components.find((component: any) => 
              component.types && component.types.includes('route')
            );
            
            const city = cityComponent?.long_name || '';
            const district = districtComponent?.long_name || '';
            const road = routeComponent?.long_name || '';
            
            // 시/도, 구/군, 도로이름이 모두 있으면 조합
            if (city && district && road) {
              return `${city} ${district} ${road}`;
            }
            
            // 시/도와 도로이름만 있으면 조합
            if (city && road) {
              return `${city} ${road}`;
            }
            
            // 도로이름만 있으면 도로이름만 반환
            if (road) {
              return road;
            }
            
            // formatted_address에서 추출 시도
            if (result.formatted_address) {
              return extractLocationAddress(result.formatted_address);
            }
          }
          
          // address_components가 없으면 formatted_address 사용
          if (result.formatted_address) {
            return extractLocationAddress(result.formatted_address);
          }
        }
      }
    } catch (error) {
      console.warn('주소 변환 실패:', error);
    }
    
    // 주소 변환 실패 시 빈 문자열 반환 (좌표는 표시하지 않음)
    return '';
  };

  // 위치를 Supabase에 저장 (쓰로틀링 적용: 최소 5초 간격)
  const saveLocationToSupabase = async (latitude: number, longitude: number, address: string) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastLocationUpdateRef.current;
    
    // 최소 10초 간격으로만 저장 (성능 최적화 및 API 호출 최소화)
    if (timeSinceLastUpdate < 10000) {
      return;
    }

    if (!userId || !isAuthenticated) return;

    try {
      const { error } = await supabase
        .from('user_locations')
        .upsert({
          user_id: userId,
          latitude: latitude,
          longitude: longitude,
          address: address,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.warn('위치 저장 오류:', error);
        // RLS 정책 오류일 수 있으므로 에러는 무시하고 로컬에만 저장
      } else {
        lastLocationUpdateRef.current = now;
        console.log('위치 저장 성공');
      }
    } catch (dbError: any) {
      console.warn('위치 저장 시도 중 오류:', dbError);
    }
  };

  // 위치 추적 중지
  const stopLocationTracking = () => {
    if (geolocationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      geolocationWatchIdRef.current = null;
    }
    
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
      alert('로그인이 필요합니다.');
      return;
    }

    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    // 이미 추적 중이면 중지
    if (geolocationWatchIdRef.current !== null) {
      stopLocationTracking();
      alert('위치 추적이 중지되었습니다.');
      return;
    }

    setIsLocationSharing(true);
    
    // 백그라운드 위치 추적 시작
    startBackgroundLocationTracking();

    try {
      // 권한 확인
      const permissionResult = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
      if (permissionResult?.state === 'denied') {
        alert('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
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
                maximumAge: 60000
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

      // 초기 위치 처리
      const { latitude, longitude } = initialPosition.coords;
      
      // 주소 변환 (재시도 로직 포함)
      let address = await reverseGeocode(latitude, longitude);
      
      // 주소 변환이 실패하면 재시도 (최대 2번)
      if (!address || address.trim() === '') {
        console.warn('주소 변환 실패, 재시도 중...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        address = await reverseGeocode(latitude, longitude);
        
        // 여전히 실패하면 한 번 더 시도
        if (!address || address.trim() === '') {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
          address = await reverseGeocode(latitude, longitude);
        }
      }

      // 주소가 여전히 없으면 formatted_address에서 추출 시도
      if (!address || address.trim() === '') {
        try {
          const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
          if (googleMapApiKey) {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapApiKey}&language=ko`
            );
            const data = await response.json();
            
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const formattedAddress = data.results[0].formatted_address;
              if (formattedAddress) {
                address = extractLocationAddress(formattedAddress);
              }
            }
          }
        } catch (error) {
          console.warn('주소 변환 최종 시도 실패:', error);
        }
      }

      // 주소가 여전히 없으면 저장하지 않음 (좌표는 표시하지 않음)
      if (!address || address.trim() === '') {
        console.warn('주소 변환 실패, 위치 저장 건너뜀');
        setIsLocationSharing(false);
        return;
      }

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
        maximumAge: 10000 // 10초 이내 캐시된 위치 허용
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

            // 주소 변환 (쓰로틀링: 60초마다 한 번만 - 무료 할당량 절약)
            const now = Date.now();
            let address = state.location.address || ''; // 기존 주소 유지
            
            if (now - lastLocationUpdateRef.current > 60000) {
              try {
                // 주소 변환 시도
                address = await reverseGeocode(latitude, longitude);
                
                // 주소 변환이 실패하면 재시도 (최대 2번)
                if (!address || address.trim() === '') {
                  console.warn('주소 변환 실패, 재시도 중...');
                  await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
                  address = await reverseGeocode(latitude, longitude);
                  
                  // 여전히 실패하면 한 번 더 시도
                  if (!address || address.trim() === '') {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
                    address = await reverseGeocode(latitude, longitude);
                  }
                }

                // 주소가 여전히 없으면 formatted_address에서 추출 시도
                if (!address || address.trim() === '') {
                  try {
                    const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
                    if (googleMapApiKey) {
                      const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapApiKey}&language=ko`
                      );
                      const data = await response.json();
                      
                      if (data.status === 'OK' && data.results && data.results.length > 0) {
                        const formattedAddress = data.results[0].formatted_address;
                        if (formattedAddress) {
                          address = extractLocationAddress(formattedAddress);
                        }
                      }
                    }
                  } catch (error) {
                    console.warn('주소 변환 최종 시도 실패:', error);
                  }
                }

                // 주소가 여전히 없으면 기존 주소 유지 (좌표는 저장하지 않음)
                if (!address || address.trim() === '') {
                  console.warn('주소 변환 실패, 기존 주소 유지');
                  address = state.location.address || '';
                }
              } catch (geocodeError) {
                console.warn('주소 변환 실패, 기존 주소 유지:', geocodeError);
                address = state.location.address || '';
              }
            }

            // 주소가 없으면 업데이트하지 않음 (좌표는 표시하지 않음)
            if (!address || address.trim() === '') {
              return;
            }

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

            // Supabase에 저장 (쓰로틀링 적용)
            await saveLocationToSupabase(latitude, longitude, address);

            // 가족 구성원 위치 목록 업데이트 (60초마다 - 무료 할당량 절약)
            if (now - lastLocationUpdateRef.current > 60000) {
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
              errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
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

      // 주기적으로 가족 구성원 위치 업데이트 (30초마다)
      locationUpdateIntervalRef.current = setInterval(async () => {
        await loadFamilyLocations();
      }, 30000);

    } catch (error: any) {
      console.error('위치 추적 시작 오류:', error);
      
      let errorMessage = '위치 추적을 시작할 수 없습니다.';
      let shouldAlert = true;

      if (error.code === 1) {
        errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
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
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // 위치가 없으면 초기화 상태 유지
        if (error.code === 'PGRST116') {
          // 데이터가 없음 (정상)
          if (process.env.NODE_ENV === 'development') {
            console.log('자신의 위치가 Supabase에 없음');
          }
          return;
        }
        if (process.env.NODE_ENV === 'development') {
          console.warn('자신의 위치 로드 오류:', error);
        }
        return;
      }

      if (data && data.latitude && data.longitude) {
        // 저장된 주소 확인 및 변환 (좌표 형식인 경우 다시 변환)
        let locationAddress = data.address || '';
        
        // 좌표 형식인지 확인 (예: "3.123456, 101.654321" 또는 "3.123456,101.654321")
        const isCoordinateFormat = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(locationAddress.trim());
        
        if (!locationAddress || isCoordinateFormat) {
          // 주소가 없거나 좌표 형식이면 다시 변환 시도
          console.log('저장된 주소가 좌표 형식이거나 없음, 다시 변환 시도...');
          locationAddress = await reverseGeocode(data.latitude, data.longitude);
          
          // 주소 변환이 실패하면 재시도 (최대 2번)
          if (!locationAddress || locationAddress.trim() === '') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            locationAddress = await reverseGeocode(data.latitude, data.longitude);
            
            if (!locationAddress || locationAddress.trim() === '') {
              await new Promise(resolve => setTimeout(resolve, 1000));
              locationAddress = await reverseGeocode(data.latitude, data.longitude);
            }
          }

          // 주소가 여전히 없으면 formatted_address에서 추출 시도
          if (!locationAddress || locationAddress.trim() === '') {
            try {
              const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
              if (googleMapApiKey) {
                const response = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${data.latitude},${data.longitude}&key=${googleMapApiKey}&language=ko`
                );
                const data_geocode = await response.json();
                
                if (data_geocode.status === 'OK' && data_geocode.results && data_geocode.results.length > 0) {
                  const formattedAddress = data_geocode.results[0].formatted_address;
                  if (formattedAddress) {
                    locationAddress = extractLocationAddress(formattedAddress);
                  }
                }
              }
            } catch (error) {
              console.warn('주소 변환 최종 시도 실패:', error);
            }
          }

          // 주소 변환 성공 시 Supabase에 업데이트
          if (locationAddress && locationAddress.trim() !== '') {
            await supabase
              .from('user_locations')
              .update({ address: locationAddress })
              .eq('user_id', userId);
          }
        } else {
          // 이미 주소 형식이면 extractLocationAddress로 일관된 형식으로 변환
          locationAddress = extractLocationAddress(locationAddress);
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

        // 지도 마커 업데이트
        setTimeout(() => {
          updateMapMarkers();
        }, 100);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('자신의 위치 로드 시도 중 오류:', error);
      }
    }
  };

  // 가족 구성원 위치 로드 (승인된 관계만 표시)
  const loadFamilyLocations = async () => {
    if (!userId || !isAuthenticated) return;
    if (!currentGroupId) {
      console.warn('loadFamilyLocations: currentGroupId가 없습니다. groupId가 필요합니다.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('loadFamilyLocations: 인증 세션이 없습니다.');
        return;
      }

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
        if (result.success && result.data) {
          currentLocationRequests = result.data;
        }
      } catch (err) {
        // 조회 실패 시 기존 locationRequests 사용
        console.warn('위치 요청 조회 실패, 기존 상태 사용:', err);
      }

      // 승인된 위치 요청이 있는 사용자들의 위치만 조회
      // RLS 정책에 의해 승인된 관계의 위치만 반환됨
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('위치 로드 오류:', error);
        }
        return;
      }

      if (data && data.length > 0) {
        // ✅ 승인된 다른 사용자 위치만 표시 (본인 위치는 제외)
        const locations = data
          .filter((loc: any) => {
            // ✅ 본인 위치는 확실히 제외 (본인 위치는 state.location에만 있음)
            if (loc.user_id === userId) {
              if (process.env.NODE_ENV === 'development') {
                console.log('loadFamilyLocations: 본인 위치 제외', loc.user_id);
              }
              return false;
            }
            // 다른 사용자 위치는 승인된 요청이 있는 경우만 표시 (최신 locationRequests 사용)
            const hasAcceptedRequest = currentLocationRequests.some(
              req => 
                (req.requester_id === userId && req.target_id === loc.user_id && req.status === 'accepted') ||
                (req.requester_id === loc.user_id && req.target_id === userId && req.status === 'accepted')
            );
            
            if (process.env.NODE_ENV === 'development') {
              if (hasAcceptedRequest) {
                console.log('loadFamilyLocations: 승인된 사용자 위치 포함', loc.user_id);
              } else {
                console.log('loadFamilyLocations: 승인되지 않은 사용자 위치 제외', loc.user_id);
              }
            }
            
            return hasAcceptedRequest;
          })
          .map((loc: any) => {
            const onlineUser = onlineUsers.find(u => u.id === loc.user_id);
            const userName = onlineUser?.name || `사용자 ${loc.user_id.substring(0, 8)}`;
            
            // 저장된 주소 확인 및 변환 (좌표 형식인 경우 다시 변환)
            let locationAddress = loc.address || '';
            
            // 좌표 형식인지 확인 (예: "3.123456, 101.654321" 또는 "3.123456,101.654321")
            const isCoordinateFormat = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(locationAddress.trim());
            
            if (!locationAddress || isCoordinateFormat) {
              // 주소가 없거나 좌표 형식이면 비동기로 변환 시도 (백그라운드 처리)
              // 즉시 반환하되, 백그라운드에서 주소 변환 후 업데이트
              (async () => {
                if (process.env.NODE_ENV === 'development') {
                  console.log('가족 위치 주소가 좌표 형식이거나 없음, 다시 변환 시도...', loc.user_id);
                }
                let convertedAddress = await reverseGeocode(loc.latitude, loc.longitude);
                
                // 주소 변환이 실패하면 재시도 (최대 2번)
                if (!convertedAddress || convertedAddress.trim() === '') {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  convertedAddress = await reverseGeocode(loc.latitude, loc.longitude);
                  
                  if (!convertedAddress || convertedAddress.trim() === '') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    convertedAddress = await reverseGeocode(loc.latitude, loc.longitude);
                  }
                }

                // 주소가 여전히 없으면 formatted_address에서 추출 시도
                if (!convertedAddress || convertedAddress.trim() === '') {
                  try {
                    const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
                    if (googleMapApiKey) {
                      const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.latitude},${loc.longitude}&key=${googleMapApiKey}&language=ko`
                      );
                      const data = await response.json();
                      
                      if (data.status === 'OK' && data.results && data.results.length > 0) {
                        const formattedAddress = data.results[0].formatted_address;
                        if (formattedAddress) {
                          convertedAddress = extractLocationAddress(formattedAddress);
                        }
                      }
                    }
                  } catch (error) {
                    console.warn('주소 변환 최종 시도 실패:', error);
                  }
                }

                // 주소 변환 성공 시 Supabase에 업데이트 및 상태 업데이트
                if (convertedAddress && convertedAddress.trim() !== '') {
                  await supabase
                    .from('user_locations')
                    .update({ address: convertedAddress })
                    .eq('user_id', loc.user_id);
                  
                  // 상태 업데이트 (해당 사용자 위치만 업데이트)
                  setState(prev => ({
                    ...prev,
                    familyLocations: prev.familyLocations.map((fl: any) =>
                      fl.userId === loc.user_id
                        ? { ...fl, address: convertedAddress }
                        : fl
                    )
                  }));
                }
              })();
              
              // 즉시 반환 (주소 없음)
              locationAddress = '';
            } else {
              // 이미 주소 형식이면 extractLocationAddress로 일관된 형식으로 변환
              locationAddress = extractLocationAddress(locationAddress);
            }
            
            return {
              userId: loc.user_id,
              userName: userName,
              address: locationAddress || '', // 시/도, 구/군, 도로이름 저장
              latitude: loc.latitude,
              longitude: loc.longitude,
              updatedAt: loc.last_updated
            };
          });

        setState(prev => ({
          ...prev,
          familyLocations: locations
        }));
      } else {
        // 데이터가 없을 때도 빈 배열로 설정하여 기존 위치 제거
        setState(prev => ({
          ...prev,
          familyLocations: []
        }));
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
        const processedRequests = result.data.map((req: any) => {
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
        alert('로그인이 필요합니다.');
      }
      return;
    }
    if (!currentGroupId) {
      console.warn('endLocationSharing: currentGroupId가 없습니다. groupId가 필요합니다.');
      return;
    }

    // silent 모드가 아닐 때만 확인 창 표시
    if (!silent && !confirm('위치 공유를 종료하시겠습니까?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (!silent) {
          alert('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
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
          alert('위치 공유가 종료되었습니다.');
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
        alert('위치 공유 종료 중 오류가 발생했습니다.');
      }
    }
  };

  // 모든 사용자 목록 로드 (로그인한/안한 모두) - profiles 테이블에서 직접 조회
  const loadAllUsers = useCallback(async (retryCount = 0) => {
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
      console.log('📋 사용자 목록 로드 시작 - API 호출:', { userId, retryCount });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
      }

      // API를 통해 서버 사이드에서 모든 사용자 조회 (profiles가 비어있으면 auth.users에서 조회)
      const response = await fetch(`/api/users/list?currentUserId=${userId}`, {
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
          loadAllUsers(retryCount + 1);
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
      alert('로그인이 필요합니다.');
      return;
    }

    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
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

      // 주소 변환 (재시도 로직 포함)
      let address = await reverseGeocode(latitude, longitude);
      
      // 주소 변환이 실패하면 재시도 (최대 2번)
      if (!address || address.trim() === '') {
        console.warn('주소 변환 실패, 재시도 중...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        address = await reverseGeocode(latitude, longitude);
        
        // 여전히 실패하면 한 번 더 시도
        if (!address || address.trim() === '') {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
          address = await reverseGeocode(latitude, longitude);
        }
      }

      // 주소가 여전히 없으면 formatted_address에서 추출 시도
      if (!address || address.trim() === '') {
        try {
          const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
          if (googleMapApiKey) {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapApiKey}&language=ko`
            );
            const data = await response.json();
            
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const formattedAddress = data.results[0].formatted_address;
              if (formattedAddress) {
                address = extractLocationAddress(formattedAddress);
              }
            }
          }
        } catch (error) {
          console.warn('주소 변환 최종 시도 실패:', error);
        }
      }

      // 주소가 여전히 없으면 저장하지 않음 (좌표는 표시하지 않음)
      if (!address || address.trim() === '') {
        console.warn('주소 변환 실패, 위치 저장 건너뜀');
        return;
      }

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

      alert('위치를 공유했습니다!');
    } catch (error: any) {
      console.error('위치 공유 오류:', error);
      if (error.code === 1) {
        alert('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
      } else {
        alert('위치를 가져오는데 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  // 위치 요청 보내기
  const sendLocationRequest = async (targetUserId: string) => {
    if (!userId || !isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!currentGroupId) {
      alert('그룹 정보가 없습니다. 그룹을 선택한 후 다시 시도해주세요.');
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
        alert('위치 요청을 보냈습니다.');
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
      alert('위치 요청 전송 중 오류가 발생했습니다.');
    }
  };

  // 위치 요청 승인/거부/취소
  const handleLocationRequestAction = async (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
    if (!userId || !isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!currentGroupId) {
      alert('그룹 정보가 없습니다. 그룹을 선택한 후 다시 시도해주세요.');
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
              const address = await reverseGeocode(latitude, longitude);
              
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
              
              // ✅ 지도 마커 즉시 업데이트 (리프레시 없이 표시)
              setTimeout(() => {
                updateMapMarkers();
              }, 300);
            }
          } catch (locationError) {
            console.warn('위치 가져오기 실패:', locationError);
            // 위치 가져오기 실패해도 승인은 완료되었으므로 계속 진행
          }
          
          alert('위치 공유가 승인되었습니다.');
        } else if (action === 'reject') {
          alert('위치 요청을 거부했습니다.');
        } else {
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
          
          alert('위치 요청을 취소했습니다.');
        }
        
        await loadLocationRequests();
        
        // ✅ 양쪽 사용자 모두 위치가 표시되도록 충분한 대기 시간
        // 위치 저장 및 로드가 완료될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 위치 목록 다시 로드 (양쪽 사용자 위치 모두 포함)
        await loadFamilyLocations();
        
        // ✅ 지도 마커 즉시 업데이트 (리프레시 없이 표시)
        setTimeout(() => {
          updateMapMarkers();
        }, 300);
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
      alert('요청 처리 중 오류가 발생했습니다.');
    } finally {
      // 처리 완료 표시 제거
      processingRequestsRef.current.delete(requestKey);
    }
  };

  // 회원탈퇴 Handler
  const handleDeleteAccount = async () => {
    // 이중 확인
    const firstConfirm = confirm('⚠️ 정말로 회원탈퇴를 하시겠습니까?\n\n탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.');
    if (!firstConfirm) return;

    const secondConfirm = confirm('⚠️ 최종 확인\n\n회원탈퇴를 진행하시겠습니까?');
    if (!secondConfirm) return;

    try {
      // 인증 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('인증 정보를 가져올 수 없습니다. 다시 로그인해주세요.');
        return;
      }

      // 회원탈퇴 API 호출
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '회원탈퇴에 실패했습니다.');
      }

      // 성공 시 모든 데이터 정리 및 로그아웃
      alert('회원탈퇴가 완료되었습니다.');
      
      // 모든 localStorage 및 sessionStorage 데이터 정리
      localStorage.clear();
      sessionStorage.clear();
      
      // Supabase 세션 종료
      await supabase.auth.signOut();
      
      // 로그인 페이지로 리다이렉트
      router.push('/');
    } catch (error: any) {
      console.error('회원탈퇴 오류:', error);
      alert(error.message || '회원탈퇴 처리 중 오류가 발생했습니다.');
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      // Push 토큰 삭제 (백그라운드 알림 방지)
      if (userId) {
        try {
          // 현재 Push 토큰 가져오기
          const token = await getPushToken();
          if (token) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              console.warn('Push 토큰 삭제: 인증 세션이 없습니다.');
              return;
            }
            await fetch(`/api/push/register-token?userId=${userId}&token=${encodeURIComponent(token)}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            }).catch(err => console.warn('Push 토큰 삭제 실패:', err));
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
        
        // 사용자별 localStorage 및 sessionStorage 데이터 정리
        if (userId) {
          const storageKey = getStorageKey(userId);
          const authKey = getAuthKey(userId);
          localStorage.removeItem(storageKey);
          sessionStorage.removeItem(authKey);
        }
        
        // 모든 Supabase 관련 세션 데이터 정리
        localStorage.removeItem('sb-auth-token');
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
      alert("닉네임을 입력해주세요.");
      return;
    }

    // 보안: 입력 검증
    const sanitizedNickname = sanitizeInput(nickname, 20);
    if (!sanitizedNickname || sanitizedNickname.length < 2) {
      alert("닉네임은 2자 이상 20자 이하로 입력해주세요.");
      return;
    }

    if (!userId || !isAuthenticated) {
      alert("로그인이 필요합니다.");
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

      // 4. 사용자 목록 새로고침 (다른 사용자에게 변경사항 반영)
      await loadAllUsers();

      alert("닉네임이 업데이트되었습니다.");
    } catch (error: any) {
      console.error('닉네임 업데이트 오류:', error);
      alert("닉네임 업데이트 실패: " + (error.message || "알 수 없는 오류"));
    }
  };

  // Todo Handlers
  const submitNewTodo = () => {
    const text = todoTextRef.current?.value;
    const who = todoWhoRef.current?.value;
    if (!text?.trim()) return alert("할 일을 입력해주세요.");
    
    // 보안: 입력 검증
    const sanitizedText = sanitizeInput(text, 100);
    const sanitizedWho = sanitizeInput(who, 20);
    
    if (!sanitizedText) return alert("유효하지 않은 입력입니다.");
    
    // assignee를 텍스트에 포함시켜서 저장 (Realtime 핸들러에서 추출)
    const textWithAssignee = sanitizedWho && sanitizedWho !== "누구나" 
      ? `${sanitizedText} - ${sanitizedWho}`
      : sanitizedText;
    
    updateState('ADD_TODO', { 
      id: Date.now(), 
      text: textWithAssignee, 
      assignee: sanitizedWho || "누구나", 
      done: false 
    });
    
    // Clear & Close
    if (todoTextRef.current) todoTextRef.current.value = "";
    if (todoWhoRef.current) todoWhoRef.current.value = "";
    setIsTodoModalOpen(false);
  };

  // Event Handlers
  const openEventModal = () => {
    setEventForm({ title: '', month: '', day: '', desc: '' });
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEventForm({ title: '', month: '', day: '', desc: '' });
  };

  const handleEventSubmit = () => {
    if (!eventForm.title.trim()) {
      alert("일정 제목을 입력해주세요.");
      return;
    }
    
    if (!eventForm.month || !eventForm.day) {
      alert("날짜를 선택해주세요.");
      return;
    }
    
    // day가 숫자인지 확인
    const dayNum = parseInt(eventForm.day);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      alert("일(day)은 1-31 사이의 숫자여야 합니다.");
      return;
    }
    
    // 보안: 입력 검증
    const sanitizedTitle = sanitizeInput(eventForm.title, 100);
    const sanitizedMonth = sanitizeInput(eventForm.month, 10);
    const sanitizedDay = dayNum.toString();
    const sanitizedDesc = sanitizeInput(eventForm.desc, 200);
    
    if (!sanitizedTitle) {
      alert("유효하지 않은 제목입니다.");
      return;
    }
    
    updateState('ADD_EVENT', { 
      id: Date.now(), 
      month: sanitizedMonth, 
      day: sanitizedDay, 
      title: sanitizedTitle, 
      desc: sanitizedDesc 
    });
    
    closeEventModal();
  };

  // Chat Handlers
  const sendChat = () => {
    const input = chatInputRef.current;
    if (!input || !input.value.trim()) return;
    
    // 보안: 입력 검증
    const sanitizedText = sanitizeInput(input.value, 500);
    if (!sanitizedText) return;
    
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 임시 ID로 메시지 추가 (Realtime으로 Supabase ID가 들어오면 교체됨)
    updateState('ADD_MESSAGE', { 
      id: Date.now(), // 임시 ID (Realtime으로 Supabase ID가 들어오면 교체)
      user: "나", 
      text: sanitizedText, 
      time: timeStr 
    });
    input.value = "";
  };

  // Photo Handlers
  // 이미지 리사이징 및 압축 함수
  const resizeImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('이미지 로드 완료:', { 
              originalWidth: img.width, 
              originalHeight: img.height,
              maxWidth,
              maxHeight
            });
          }

          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const originalWidth = width;
          const originalHeight = height;

          // 비율 유지하면서 리사이징
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            } else {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log('리사이징 적용:', { 
                from: `${originalWidth}x${originalHeight}`,
                to: `${Math.round(width)}x${Math.round(height)}`
              });
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('리사이징 불필요 (이미 작음)');
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 가져올 수 없습니다.'));
      return;
    }
    
          // 고품질 리사이징
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // JPEG로 압축 (PNG는 투명도가 있을 때만, HEIC/HEIF도 JPEG로 변환)
          // HEIC/HEIF는 브라우저에서 자동으로 변환되므로 JPEG로 처리
          const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
          const isPNG = file.type === 'image/png' || fileExt === 'png';
          const outputFormat = isPNG ? 'image/png' : 'image/jpeg';
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('이미지 압축에 실패했습니다.'));
                return;
              }
              
              if (process.env.NODE_ENV === 'development') {
                console.log('압축 완료:', { 
                  blobSize: Math.round(blob.size / 1024) + 'KB',
                  quality: Math.round(quality * 100) + '%',
                  format: outputFormat
                });
              }
              
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('압축된 이미지 읽기에 실패했습니다.'));
              reader.readAsDataURL(blob);
            },
            outputFormat,
            quality
          );
        };
        img.onerror = (error) => {
          console.error('이미지 로드 오류:', error);
          reject(new Error('이미지 로드에 실패했습니다.'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
      reader.readAsDataURL(file);
    });
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  };

  const replaceFileExtension = (fileName: string, newExtension: string): string => {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) {
      return `${fileName}.${newExtension}`;
    }
    return `${fileName.slice(0, dotIndex)}.${newExtension}`;
  };

  const getMimeTypeFromExtension = (extension: string): string | null => {
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      heic: 'image/heic',
      heif: 'image/heif',
      cr2: 'image/x-canon-cr2',
      nef: 'image/x-nikon-nef',
      arw: 'image/x-sony-arw',
      dng: 'image/x-adobe-dng',
      raw: 'image/x-raw',
      raf: 'image/x-fuji-raf',
      orf: 'image/x-olympus-orf',
      rw2: 'image/x-panasonic-rw2',
      srw: 'image/x-samsung-srw',
      tif: 'image/tiff',
      tiff: 'image/tiff',
    };
    return map[extension] || null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 보안: 파일 타입 검증 (아이폰 HEIC/HEIF 및 RAW 형식 지원 포함)
    const ALLOWED_TYPES = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/webp', 
      'image/gif',
      'image/heic',  // 아이폰 HEIC 형식
      'image/heif',  // HEIF 형식
      'image/x-canon-cr2',  // Canon RAW
      'image/x-nikon-nef',  // Nikon RAW
      'image/x-sony-arw',   // Sony RAW
      'image/x-adobe-dng',  // Adobe DNG
    ];
    
    // 파일 확장자 기반 검증 (MIME 타입이 없는 경우 대비)
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = [
      'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
      // RAW 형식 확장자
      'raw', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'dng', 'raf', 'srw', '3fr', 'ari', 'bay', 'crw', 'cap', 'data', 'dcs', 'dcr', 'drf', 'eip', 'erf', 'fff', 'iiq', 'k25', 'kdc', 'mef', 'mos', 'mrw', 'nrw', 'obm', 'pef', 'ptx', 'pxn', 'r3d', 'raf', 'raw', 'rwl', 'rw2', 'rwz', 'sr2', 'srf', 'srw', 'tif', 'x3f'
    ];
    
    // RAW 파일 여부 확인
    const isRawFile = [
      'raw', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'dng', 'raf', 'srw', '3fr', 'ari', 'bay', 'crw', 'cap', 'data', 'dcs', 'dcr', 'drf', 'eip', 'erf', 'fff', 'iiq', 'k25', 'kdc', 'mef', 'mos', 'mrw', 'nrw', 'obm', 'pef', 'ptx', 'pxn', 'r3d', 'raf', 'raw', 'rwl', 'rw2', 'rwz', 'sr2', 'srf', 'srw', 'tif', 'x3f'
    ].includes(fileExtension);

    const normalizedMimeType = file.type || getMimeTypeFromExtension(fileExtension) || 'application/octet-stream';

    let uploadFile: File = file;
    let uploadFileName = file.name;
    let uploadMimeType = normalizedMimeType;
    let uploadFileSize = file.size;
    let clientResizedForUpload = false;
    
    // MIME 타입 또는 확장자로 검증
    const isValidType = ALLOWED_TYPES.includes(file.type) || 
                        (file.type === '' && allowedExtensions.includes(fileExtension));
    
    if (!isValidType) {
      alert('지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF, HEIC/HEIF, RAW 형식만 가능)');
      e.target.value = "";
      return;
    }
    
    // 보안: 파일 이름 검증 (악성 파일명 방지)
    const fileName = file.name;
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      alert('유효하지 않은 파일명입니다.');
      e.target.value = "";
      return;
    }

    // 파일 크기 체크 및 경고
    // ⚠️ 매우 큰 파일은 메모리 문제를 일으킬 수 있음
    const MAX_SAFE_FILE_SIZE = 100 * 1024 * 1024; // 100MB (안전한 최대 크기)
    if (file.size > MAX_SAFE_FILE_SIZE) {
      const confirmMessage = `파일이 매우 큽니다 (${Math.round(file.size / 1024 / 1024)}MB).\n\n` +
        `업로드에 시간이 오래 걸릴 수 있고, 브라우저 메모리 부족으로 오류가 발생할 수 있습니다.\n\n` +
        `계속하시겠습니까?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    // localStorage에는 표시용 리사이징된 이미지만 저장하고, 원본은 S3에 직접 업로드

    // photoId를 함수 스코프에서 선언 (catch 블록에서 접근 가능하도록)
    let photoId: number | null = null;

    try {
      // 원본 파일 정보 저장 (S3 업로드용)
      const originalReader = new FileReader();
      const originalData = await new Promise<string>((resolve, reject) => {
        originalReader.onload = (event) => {
      if (event.target?.result) {
            resolve(event.target.result as string);
          } else {
            reject(new Error('원본 파일 읽기 실패'));
          }
        };
        originalReader.onerror = () => reject(new Error('원본 파일 읽기 오류'));
        originalReader.readAsDataURL(file);
      });

      let imageData: string; // 표시용 리사이징된 이미지
      const RESIZE_THRESHOLD = 500 * 1024; // 500KB

      // RAW 파일은 브라우저에서 리사이징 불가능할 수 있으므로 시도 후 실패 시 원본 그대로 사용
      if (isRawFile) {
        const RAW_CLIENT_MAX_DIMENSION = 2560;
        const RAW_CLIENT_QUALITY = 0.85;
        let resizedDataUrl: string | null = null;

        try {
          resizedDataUrl = await resizeImage(file, RAW_CLIENT_MAX_DIMENSION, RAW_CLIENT_MAX_DIMENSION, RAW_CLIENT_QUALITY);
        } catch (resizeError: any) {
          console.warn('RAW 1차 축소 실패 - 원본으로 진행:', resizeError?.message || resizeError);
        }

        if (resizedDataUrl) {
          const resizedBlob = dataUrlToBlob(resizedDataUrl);
          const resizedFileName = replaceFileExtension(file.name, 'jpg');
          const resizedFile = new File([resizedBlob], resizedFileName, { type: 'image/jpeg' });
          uploadFile = resizedFile;
          uploadFileName = resizedFileName;
          uploadMimeType = 'image/jpeg';
          uploadFileSize = resizedFile.size;
          clientResizedForUpload = true;

          imageData = resizedDataUrl;

          if (process.env.NODE_ENV === 'development') {
            console.log('RAW 1차 축소 완료:', {
              originalSize: Math.round(file.size / 1024) + 'KB',
              resizedSize: Math.round(resizedFile.size / 1024) + 'KB',
              maxDimension: RAW_CLIENT_MAX_DIMENSION,
            });
          }
        } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('RAW 파일 감지 - 리사이징 건너뜀:', {
            fileName: file.name,
            fileSize: Math.round(file.size / 1024) + 'KB',
            extension: fileExtension
          });
        }
        
        // RAW 파일은 표시용 이미지를 생성할 수 없으므로 원본 데이터 사용
        // (실제로는 표시되지 않지만, 구조상 유지)
        imageData = originalData;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('RAW 파일 처리 완료 - 원본 그대로 업로드');
        }
        }
      }
      // 일반 이미지 파일: 파일이 500KB 이상이면 리사이징 및 압축
      else if (file.size > RESIZE_THRESHOLD) {
        if (process.env.NODE_ENV === 'development') {
          console.log('리사이징 시작:', { 
            originalSize: file.size, 
            fileName: file.name,
            fileType: file.type 
          });
        }
        
        // 리사이징 및 압축 (최대 1920x1920, 품질 80%)
        imageData = await resizeImage(file, 1920, 1920, 0.8);
        
        if (process.env.NODE_ENV === 'development') {
          const resizedSize = (imageData.length * 3) / 4;
          console.log('1차 리사이징 완료:', { 
            resizedSize: Math.round(resizedSize / 1024) + 'KB',
            compression: Math.round((1 - resizedSize / file.size) * 100) + '%'
          });
        }
        
        // 리사이징 후에도 2MB를 초과하면 추가 압축 (표시용이므로 적당한 크기 유지)
        const MAX_FINAL_SIZE = 2 * 1024 * 1024; // 2MB (표시용이므로 여유있게)
        const base64Size = (imageData.length * 3) / 4; // Base64 크기 추정
        
        if (base64Size > MAX_FINAL_SIZE) {
          if (process.env.NODE_ENV === 'development') {
            console.log('추가 압축 필요:', { 
              currentSize: Math.round(base64Size / 1024) + 'KB',
              targetSize: '2MB 이하'
            });
          }
          
          // 더 강한 압축 시도 (품질 60%, 크기 1280x1280)
          imageData = await resizeImage(file, 1280, 1280, 0.6);
          
          if (process.env.NODE_ENV === 'development') {
            const finalSize = (imageData.length * 3) / 4;
            console.log('2차 압축 완료:', { 
              finalSize: Math.round(finalSize / 1024) + 'KB',
              totalCompression: Math.round((1 - finalSize / file.size) * 100) + '%'
            });
          }
          
          // 최종 체크: 리사이징 후에도 너무 크면 에러
          const finalBase64Size = (imageData.length * 3) / 4;
          if (finalBase64Size > MAX_FINAL_SIZE) {
            // 3차 압축: 최대한 압축 (품질 50%, 크기 1024x1024)
            imageData = await resizeImage(file, 1024, 1024, 0.5);
            
            if (process.env.NODE_ENV === 'development') {
              const ultimateSize = (imageData.length * 3) / 4;
              console.log('3차 압축 완료:', { 
                ultimateSize: Math.round(ultimateSize / 1024) + 'KB',
                totalCompression: Math.round((1 - ultimateSize / file.size) * 100) + '%'
              });
            }
          }
        }
      } else {
        // 작은 파일은 리사이징 없이 원본 사용 (표시용도 원본)
        imageData = originalData;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('리사이징 생략 (작은 파일):', { 
            size: Math.round(file.size / 1024) + 'KB',
            threshold: '500KB 미만'
          });
        }
      }

      // 사진 추가 (리사이징된 이미지는 표시용)
      // originalData는 localStorage에 저장하지 않음 (공간 절약)
      // 업로드 시에만 사용하기 위해 별도 변수로 보관
      photoId = Date.now();
      const originalDataForUpload = clientResizedForUpload ? imageData : originalData; // 업로드용 원본 데이터 보관
      
      updateState('ADD_PHOTO', { 
        id: photoId, 
        data: imageData, // 표시용 리사이징된 이미지 (localStorage에 저장)
        // originalData는 localStorage에 저장하지 않음 (공간 절약)
        originalSize: file.size, // 원본 파일 크기
        originalFilename: file.name, // 원본 파일명
        mimeType: uploadMimeType, // MIME 타입
        isUploading: true // 업로드 시작
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('사진 추가 완료 (localStorage):', {
          displaySize: Math.round((imageData.length * 3) / 4 / 1024) + 'KB',
          originalSize: Math.round(file.size / 1024) + 'KB',
          saved: '표시용 리사이징만 저장 (원본은 업로드 후 제거)'
        });
      }

      // Cloudinary와 AWS S3 업로드 (비동기, 백그라운드 처리)
      // 하이브리드 방식: 작은 파일은 서버 경유, 큰 파일은 Presigned URL 방식
      let uploadCompleted = false;
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Refresh Token 에러 처리
        if (sessionError) {
          if (sessionError.message?.includes('Refresh Token') || sessionError.message?.includes('refresh_token')) {
            console.warn('Refresh Token 에러 - 업로드 건너뜀:', sessionError.message);
          }
        }
        
        if (!session) {
          console.warn('세션이 없어 Cloudinary/S3 업로드를 건너뜁니다.');
          // 세션이 없어도 isUploading 플래그는 해제
          updateState('UPDATE_PHOTO_ID', {
            oldId: photoId,
            newId: photoId,
            cloudinaryUrl: null,
            s3Url: null,
            uploadFailed: true
          });
          return;
        }

        // 파일 크기 기준으로 업로드 방식 결정
        // ⚠️ 중요: Vercel 서버 경유 방식은 4.5MB 제한이 있음
        // Base64 인코딩 시 원본의 약 1.33배 크기 증가하므로,
        // 안전하게 3MB 이상은 Presigned URL 방식 사용
        // RAW 파일은 리사이징 불가능하므로 무조건 Presigned URL 방식 사용
        const PRESIGNED_URL_THRESHOLD = 3 * 1024 * 1024; // 3MB (Vercel 제한 고려하여 5MB -> 3MB로 변경)
        const usePresignedUrl = isRawFile || uploadFileSize >= PRESIGNED_URL_THRESHOLD;

        if (process.env.NODE_ENV === 'development') {
          console.log('Cloudinary & S3 업로드 시작...', {
            method: usePresignedUrl ? 'Presigned URL (직접 업로드)' : '서버 경유 (3MB 이하)',
            fileSize: Math.round(uploadFileSize / 1024) + 'KB',
            originalFileSize: Math.round(file.size / 1024) + 'KB',
            threshold: '3MB',
            reason: isRawFile ? 'RAW 파일' : (file.size >= PRESIGNED_URL_THRESHOLD ? '3MB 이상' : '3MB 미만')
          });
        }
        
        // 3MB 이상 파일이 서버 경유 방식으로 시도되는 경우 경고
        if (!usePresignedUrl && file.size >= 3 * 1024 * 1024) {
          console.warn('⚠️ 3MB 이상 파일이 서버 경유 방식으로 시도됩니다. Presigned URL 방식으로 자동 전환합니다.');
          // 자동으로 Presigned URL 방식으로 전환
          const usePresignedUrl = true;
        }

        if (usePresignedUrl) {
          // Presigned URL 방식 (큰 파일)
          try {
            if (!currentGroupId) {
              throw new Error('그룹 정보가 없습니다. 그룹을 선택한 후 다시 시도해주세요.');
            }
            const uploadDebugPayload = {
              fileName: uploadFileName,
              mimeType: uploadMimeType || null,
              fileSize: uploadFileSize,
              originalFileSize: file.size,
              groupId: currentGroupId,
              isRawFile,
              clientResizedForUpload,
              usePresignedUrl,
            };
            console.info('업로드 디버그 정보 (Presigned URL):', uploadDebugPayload);
            // 1. Presigned URL 요청 (타임아웃: 10초)
            const urlController = new AbortController();
            const urlTimeout = setTimeout(() => urlController.abort(), 10000);
            
            let urlResponse;
            try {
              urlResponse = await fetch('/api/get-upload-url', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  fileName: uploadFileName,
                  mimeType: uploadMimeType,
                  fileSize: uploadFileSize,
                  groupId: currentGroupId,
                }),
                signal: urlController.signal,
              });
              clearTimeout(urlTimeout);
            } catch (urlError: any) {
              clearTimeout(urlTimeout);
              if (urlError.name === 'AbortError') {
                throw new Error('Presigned URL 요청 타임아웃 (10초 초과)');
              }
              throw urlError;
            }

            // 응답 본문 읽기 (JSON 파싱 전에 텍스트로 먼저 읽기)
            let responseText = '';
            let urlResult: any = null;
            
            try {
              // 응답 본문을 텍스트로 먼저 읽기
              responseText = await urlResponse.text();
              
              // 빈 응답 체크
              if (!responseText || responseText.trim().length === 0) {
                console.error('Presigned URL 응답이 비어있음:', {
                  status: urlResponse.status,
                  statusText: urlResponse.statusText,
                  headers: Object.fromEntries(urlResponse.headers.entries())
                });
                throw new Error(`Presigned URL 생성 실패 (${urlResponse.status}): 응답이 비어있습니다.`);
              }
              
              // JSON 파싱 시도
              try {
                urlResult = JSON.parse(responseText);
              } catch (jsonError: any) {
                // JSON 파싱 실패 시 원본 텍스트 사용
                console.error('Presigned URL JSON 파싱 실패:', {
                  status: urlResponse.status,
                  responseText: responseText.substring(0, 500),
                  jsonError: jsonError.message
                });
                throw new Error(`Presigned URL 생성 실패 (${urlResponse.status}): ${responseText.substring(0, 200) || '알 수 없는 오류'}`);
              }
            } catch (readError: any) {
              // 응답 본문 읽기 실패
              console.error('Presigned URL 응답 읽기 실패:', {
                status: urlResponse.status,
                statusText: urlResponse.statusText,
                error: readError.message
              });
              throw readError;
            }

            // HTTP 상태 코드 확인
            if (!urlResponse.ok) {
              // 에러 응답 상세 정보 추출
              const errorDetails: any = {
                status: urlResponse.status,
                statusText: urlResponse.statusText || 'Unknown',
                responseText: responseText ? responseText.substring(0, 500) : '(응답 없음)',
                hasResponseText: !!responseText,
                responseTextLength: responseText?.length || 0,
              };
              
              // urlResult에서 에러 정보 추출
              let errorMessage = '';
              
              if (urlResult) {
                // urlResult가 빈 객체가 아닌지 확인
                const urlResultKeys = Object.keys(urlResult);
                const hasErrorInfo = urlResultKeys.length > 0;
                
                errorDetails.urlResultType = typeof urlResult;
                errorDetails.urlResultKeys = urlResultKeys;
                errorDetails.urlResultKeysCount = urlResultKeys.length;
                
                if (hasErrorInfo) {
                  // 에러 메시지 우선순위: error > message > details > missing > 전체 JSON
                  errorMessage = urlResult.error || 
                                urlResult.message || 
                                (typeof urlResult.details === 'string' ? urlResult.details : '') ||
                                (urlResult.missing && Array.isArray(urlResult.missing) 
                                  ? `누락된 환경 변수: ${urlResult.missing.join(', ')}` 
                                  : '') ||
                                (urlResultKeys.length > 0 ? JSON.stringify(urlResult) : '');
                  
                  errorDetails.fullResponse = urlResult;
                  errorDetails.extractedError = urlResult.error;
                  errorDetails.extractedMessage = urlResult.message;
                  errorDetails.extractedDetails = urlResult.details;
                  errorDetails.extractedMissing = urlResult.missing;
                } else {
                  // 빈 객체인 경우
                  errorMessage = `HTTP ${urlResponse.status} 오류: 응답이 빈 객체입니다.`;
                  errorDetails.isEmpty = true;
                  errorDetails.urlResultStringified = JSON.stringify(urlResult);
                }
              } else {
                // urlResult가 null 또는 undefined인 경우
                errorMessage = `HTTP ${urlResponse.status} 오류: 응답을 파싱할 수 없습니다.`;
                errorDetails.isNull = urlResult === null;
                errorDetails.isUndefined = urlResult === undefined;
              }
              
              // 기본 에러 메시지가 없으면 상태 코드 기반 메시지 생성
              if (!errorMessage || errorMessage.trim().length === 0) {
                const statusMessages: Record<number, string> = {
                  400: '잘못된 요청입니다. 파일 정보를 확인해주세요.',
                  401: '인증이 필요합니다. 로그인 상태를 확인해주세요.',
                  403: '접근 권한이 없습니다.',
                  404: 'API 엔드포인트를 찾을 수 없습니다.',
                  413: '파일이 너무 큽니다.',
                  500: '서버 오류가 발생했습니다. AWS 자격 증명을 확인해주세요.',
                  503: '서비스를 일시적으로 사용할 수 없습니다.',
                };
                errorMessage = statusMessages[urlResponse.status] || 
                              `HTTP ${urlResponse.status} 오류`;
                errorDetails.fallbackMessage = true;
              }
              
              // 최종 에러 로깅 (명시적으로 모든 정보 포함)
              const finalErrorLog: any = {};
              
              // 기본 정보 (항상 포함)
              finalErrorLog.status = urlResponse.status;
              finalErrorLog.statusText = urlResponse.statusText || 'Unknown';
              finalErrorLog.errorMessage = errorMessage || '(에러 메시지 없음)';
              finalErrorLog.url = '/api/get-upload-url';
              finalErrorLog.method = 'POST';
              finalErrorLog.uploadDebugPayload = uploadDebugPayload;
              
              // 응답 본문 정보
              if (responseText) {
                finalErrorLog.responseText = responseText.substring(0, 500);
                finalErrorLog.responseTextLength = responseText.length;
              } else {
                finalErrorLog.responseText = '(응답 없음)';
                finalErrorLog.responseTextLength = 0;
              }
              
              // urlResult 정보
              if (urlResult !== null && urlResult !== undefined) {
                finalErrorLog.urlResultType = typeof urlResult;
                const urlResultKeys = Object.keys(urlResult);
                finalErrorLog.urlResultKeys = urlResultKeys;
                finalErrorLog.urlResultKeysCount = urlResultKeys.length;
                
                if (urlResultKeys.length > 0) {
                  finalErrorLog.urlResult = urlResult;
                  
                  // 개별 속성 추출
                  if (urlResult.error) finalErrorLog.extractedError = urlResult.error;
                  if (urlResult.message) finalErrorLog.extractedMessage = urlResult.message;
                  if (urlResult.details) finalErrorLog.extractedDetails = urlResult.details;
                  if (urlResult.missing) finalErrorLog.extractedMissing = urlResult.missing;
                } else {
                  finalErrorLog.isEmpty = true;
                  finalErrorLog.urlResultStringified = JSON.stringify(urlResult);
                }
              } else {
                finalErrorLog.isNull = urlResult === null;
                finalErrorLog.isUndefined = urlResult === undefined;
              }
              
              // 추가 플래그
              if (errorDetails.fallbackMessage) finalErrorLog.fallbackMessage = true;
              
              // 명시적으로 로깅 (여러 줄로 나누어 더 명확하게)
              console.error('❌ Presigned URL 생성 실패');
              console.error('상태:', finalErrorLog.status, finalErrorLog.statusText);
              console.error('에러 메시지:', finalErrorLog.errorMessage);
              console.error('응답 본문:', finalErrorLog.responseText);
              console.error('응답 본문 길이:', finalErrorLog.responseTextLength);
              
              if (finalErrorLog.urlResult) {
                console.error('응답 객체:', finalErrorLog.urlResult);
                if (finalErrorLog.urlResultKeys) {
                  console.error('응답 객체 키:', finalErrorLog.urlResultKeys);
                }
              } else {
                console.error('응답 객체:', finalErrorLog.isNull ? 'null' : finalErrorLog.isUndefined ? 'undefined' : '없음');
              }
              
              // 전체 에러 로그도 함께 출력 (디버깅용)
              console.error('전체 에러 정보:', finalErrorLog);
              
              throw new Error(errorMessage);
            }

            if (!urlResult.presignedUrl) {
              console.error('Presigned URL이 응답에 없음:', urlResult);
              throw new Error('Presigned URL이 응답에 포함되지 않았습니다.');
            }

            const { presignedUrl, s3Key, s3Url } = urlResult;

            // 2. 클라이언트에서 직접 S3에 원본 파일 업로드
            // 타임아웃 설정 (120초)
            const uploadController = new AbortController();
            const uploadTimeout = setTimeout(() => uploadController.abort(), 120000);
            
            try {
            const s3UploadResponse = await fetch(presignedUrl, {
              method: 'PUT',
              body: uploadFile, // 원본 또는 1차 축소된 파일
              headers: {
                'Content-Type': uploadMimeType,
              },
              signal: uploadController.signal,
            });

              clearTimeout(uploadTimeout);

              if (!s3UploadResponse.ok) {
                // 에러 응답 본문 읽기 시도 (실패 시 대체 메시지 사용)
                let errorText = '';
                let errorCode = '';
                let errorDetails: any = {
                  status: s3UploadResponse.status,
                  statusText: s3UploadResponse.statusText,
                };
                
                try {
                  // 응답 본문 읽기
                  const responseText = await s3UploadResponse.text();
                  
                  // XML 형식의 AWS 에러 응답 파싱
                  if (responseText && responseText.trim().startsWith('<?xml')) {
                    try {
                      const parser = new DOMParser();
                      const xmlDoc = parser.parseFromString(responseText, 'text/xml');
                      const errorElement = xmlDoc.querySelector('Error');
                      
                      if (errorElement) {
                        const codeElement = errorElement.querySelector('Code');
                        const messageElement = errorElement.querySelector('Message');
                        const requestIdElement = errorElement.querySelector('RequestId');
                        
                        errorCode = codeElement?.textContent || '';
                        errorText = messageElement?.textContent || '';
                        
                        errorDetails = {
                          ...errorDetails,
                          awsErrorCode: errorCode,
                          awsRequestId: requestIdElement?.textContent || '',
                          rawXml: responseText.substring(0, 500),
                        };
                        
                        // AWS 에러 코드별 사용자 친화적 메시지
                        const awsErrorMessages: Record<string, string> = {
                          'AuthorizationQueryParametersError': 'AWS 자격 증명 파라미터 오류: 환경 변수(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)를 확인해주세요.',
                          'AccessDenied': 'S3 버킷 접근 권한이 없습니다. 버킷 정책을 확인해주세요.',
                          'InvalidAccessKeyId': 'AWS Access Key ID가 유효하지 않습니다.',
                          'SignatureDoesNotMatch': 'AWS 자격 증명 서명이 일치하지 않습니다.',
                          'InvalidBucketName': 'S3 버킷 이름이 유효하지 않습니다.',
                          'NoSuchBucket': 'S3 버킷을 찾을 수 없습니다.',
                          'RequestTimeout': 'S3 요청이 타임아웃되었습니다.',
                        };
                        
                        if (errorCode && awsErrorMessages[errorCode]) {
                          errorText = `${awsErrorMessages[errorCode]}\n\n원본 메시지: ${errorText}`;
                        }
                      } else {
                        // XML 파싱은 성공했지만 Error 요소를 찾을 수 없음
                        errorText = responseText.substring(0, 500);
                      }
                    } catch (xmlError: any) {
                      // XML 파싱 실패 시 원본 텍스트 사용
                      errorText = responseText.substring(0, 500);
                      errorDetails.xmlParseError = xmlError.message;
                    }
                  } else {
                    // JSON 또는 일반 텍스트 응답
                    const contentType = s3UploadResponse.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                      try {
                        const errorJson = JSON.parse(responseText);
                        errorText = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                        errorDetails = { ...errorDetails, ...errorJson };
                      } catch (jsonError) {
                        errorText = responseText.substring(0, 500);
                      }
                    } else {
                      errorText = responseText.substring(0, 500);
                      if (errorText) {
                        errorDetails.error = errorText;
                      }
                    }
                  }
                } catch (textError: any) {
                  // 응답 본문 읽기 실패 시 상태 코드 기반 메시지 생성
                  errorText = `응답 본문을 읽을 수 없습니다: ${textError.message || '알 수 없는 오류'}`;
                  errorDetails.readError = textError.message;
                }
                
                // 에러 메시지가 비어있으면 상태 코드 기반 메시지 생성
                if (!errorText || errorText.trim().length === 0) {
                  const statusMessages: Record<number, string> = {
                    403: 'S3 업로드 권한이 없습니다. 버킷 정책을 확인해주세요.',
                    404: 'S3 버킷을 찾을 수 없습니다.',
                    400: '잘못된 요청입니다. 파일 형식이나 크기를 확인해주세요.',
                    413: '파일이 너무 큽니다.',
                    500: 'S3 서버 오류가 발생했습니다.',
                    503: 'S3 서비스가 일시적으로 사용할 수 없습니다.',
                  };
                  errorText = statusMessages[s3UploadResponse.status] || 
                    `S3 업로드 실패 (HTTP ${s3UploadResponse.status})`;
                }
                
                console.error('S3 업로드 실패:', {
                  ...errorDetails,
                  errorMessage: errorText,
                  errorCode: errorCode || 'N/A',
                  url: presignedUrl.substring(0, 100) + '...', // URL 일부만 표시
                });
                
                // CORS 오류 확인
                if (s3UploadResponse.status === 0 || 
                    errorText.includes('CORS') || 
                    errorText.includes('cors') ||
                    errorText.includes('Access-Control')) {
                  console.error('CORS 오류로 의심됨');
                  throw new Error('CORS 오류: S3 버킷 CORS 설정이 필요합니다.');
                }
                
                // AuthorizationQueryParametersError는 presigned URL 생성 문제
                if (errorCode === 'AuthorizationQueryParametersError' || 
                    errorText.includes('X-Amz-Credential') ||
                    errorText.includes('Credential is mal-formed')) {
                  throw new Error(`AWS 자격 증명 오류: ${errorText}\n\n환경 변수(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)를 확인해주세요.`);
                }
                
                throw new Error(`S3 업로드 실패: ${errorText}`);
              }
            } catch (uploadError: any) {
              clearTimeout(uploadTimeout);
              
              // 상세한 에러 정보 로깅
              console.error('S3 업로드 중 예외 발생:', {
                name: uploadError.name,
                message: uploadError.message,
                stack: uploadError.stack?.substring(0, 200),
                cause: uploadError.cause,
              });
              
              // CORS 오류 감지 (더 포괄적으로)
              const isCorsError = 
                uploadError.message?.includes('CORS') ||
                uploadError.message?.includes('cors') ||
                uploadError.message?.includes('Failed to fetch') ||
                uploadError.message?.includes('NetworkError') ||
                uploadError.message?.includes('blocked by CORS policy') ||
                uploadError.message?.includes('Access-Control') ||
                uploadError.name === 'TypeError' ||
                (uploadError.name === 'TypeError' && uploadError.message?.includes('fetch'));
              
              if (uploadError.name === 'AbortError') {
                throw new Error('S3 업로드 타임아웃 (30초 초과)');
              }
              
              // CORS 오류 발생 시 서버 경유 방식으로 자동 폴백
              if (isCorsError) {
                console.warn('CORS 오류 감지, 서버 경유 방식으로 자동 재시도:', {
                  errorName: uploadError.name,
                  errorMessage: uploadError.message,
                });
                
                try {
                  const fallbackController = new AbortController();
                  const fallbackTimeout = setTimeout(() => fallbackController.abort(), 120000); // 2분으로 증가
                  
                  const fallbackResponse = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      originalData: originalDataForUpload,
                      resizedData: imageData !== originalDataForUpload ? imageData : null,
                      fileName: uploadFileName,
                      mimeType: uploadMimeType,
                      originalSize: uploadFileSize,
                      groupId: currentGroupId,
                      forceCloudinary: isRawFile,
                    }),
                    signal: fallbackController.signal,
                  });

                  clearTimeout(fallbackTimeout);

                  const fallbackResult = await fallbackResponse.json();

                  if (!fallbackResponse.ok) {
                    throw new Error(fallbackResult.error || '서버 경유 업로드 실패');
                  }

                  // 서버 경유 업로드 성공
                  if (fallbackResult.id && (fallbackResult.cloudinaryUrl || fallbackResult.s3Url)) {
                    updateState('UPDATE_PHOTO_ID', {
                      oldId: photoId,
                      newId: fallbackResult.id,
                      cloudinaryUrl: fallbackResult.cloudinaryUrl,
                      s3Url: fallbackResult.s3Url
                    });
                    
                    uploadCompleted = true;
                    // 성공 알림
                    alert('업로드 완료: CORS 오류로 인해 서버 경유 방식으로 업로드되었습니다.');
                  }
                  
                  return; // 성공적으로 폴백 완료
                } catch (fallbackError: any) {
                  // 폴백도 실패한 경우 원래 에러를 throw하여 최종 catch 블록에서 처리
                  throw new Error(`CORS 오류 후 서버 경유 재시도 실패: ${fallbackError.message || '알 수 없는 오류'}`);
                }
              }
              
              throw uploadError;
            }

          if (process.env.NODE_ENV === 'development') {
            console.log('S3 직접 업로드 완료:', { s3Key, s3Url });
          }

          // 3. 업로드 완료 처리 (Cloudinary 업로드 + Supabase 저장)
          // 타임아웃 설정 (180초)
          const completeController = new AbortController();
          const completeTimeout = setTimeout(() => completeController.abort(), 180000);
          
          try {
            const completeResponse = await fetch('/api/complete-upload', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                s3Key,
                s3Url,
                fileName: uploadFileName,
                mimeType: uploadMimeType,
                originalSize: uploadFileSize,
                resizedData: imageData !== originalData ? imageData : null, // 리사이징된 이미지 (Cloudinary용)
                groupId: currentGroupId,
                forceCloudinary: isRawFile,
              }),
              signal: completeController.signal,
            });

            clearTimeout(completeTimeout);

            if (!completeResponse.ok) {
              // complete-upload 실패해도 S3 업로드는 성공했으므로 S3 URL로 저장
              const completeResult = await completeResponse.json().catch(() => ({ error: '업로드 완료 처리 실패' }));
              console.warn('complete-upload 실패, S3 URL로 저장:', completeResult.error);
              updateState('UPDATE_PHOTO_ID', {
                oldId: photoId,
                newId: photoId, // 임시 ID 유지 (나중에 Supabase에서 로드)
                cloudinaryUrl: null,
                s3Url: s3Url // S3 URL은 있음
              });
              uploadCompleted = true;
              return; // S3 업로드는 성공했으므로 종료
            }

            const completeResult = await completeResponse.json();

            if (process.env.NODE_ENV === 'development') {
              console.log('Presigned URL 업로드 완료:', {
                cloudinaryUrl: completeResult.cloudinaryUrl,
                s3Url: completeResult.s3Url,
                memoryId: completeResult.id,
              });
            }

            // 업로드 완료 후 Photo 객체 업데이트 (localStorage ID를 Supabase ID로 업데이트)
            if (completeResult.id && (completeResult.cloudinaryUrl || completeResult.s3Url)) {
              updateState('UPDATE_PHOTO_ID', {
                oldId: photoId, // localStorage의 타임스탬프 ID
                newId: completeResult.id, // Supabase ID
                cloudinaryUrl: completeResult.cloudinaryUrl,
                s3Url: completeResult.s3Url
              });
              
              uploadCompleted = true;
              // 업로드 완료 알림 (3초 후 자동 사라짐)
              setTimeout(() => {
                if (process.env.NODE_ENV === 'development') {
                  console.log('업로드 완료:', completeResult.id);
                }
              }, 100);
            } else {
              // ID가 없어도 S3 업로드는 성공했으므로 완료 처리
              console.warn('complete-upload 응답에 ID가 없음, S3 URL로 저장');
              updateState('UPDATE_PHOTO_ID', {
                oldId: photoId,
                newId: photoId,
                cloudinaryUrl: null,
                s3Url: s3Url
              });
              uploadCompleted = true;
            }
          } catch (completeError: any) {
            clearTimeout(completeTimeout);
            // complete-upload 실패해도 S3 업로드는 성공했으므로 완료 처리
            console.warn('complete-upload 오류, S3 URL로 저장:', completeError.message);
            updateState('UPDATE_PHOTO_ID', {
              oldId: photoId,
              newId: photoId,
              cloudinaryUrl: null,
              s3Url: s3Url // S3 URL은 있음
            });
            uploadCompleted = true;
          }
          } catch (presignedError: any) {
            // Presigned URL 생성 실패 시에도 서버 경유 방식으로 폴백
            console.warn('Presigned URL 생성 실패, 서버 경유 방식으로 재시도:', presignedError.message);
            
            try {
              const fallbackController = new AbortController();
              const fallbackTimeout = setTimeout(() => fallbackController.abort(), 60000);
              
              const fallbackResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  originalData: originalDataForUpload,
                  resizedData: imageData !== originalDataForUpload ? imageData : null,
                  fileName: uploadFileName,
                  mimeType: uploadMimeType,
                  originalSize: uploadFileSize,
                  groupId: currentGroupId,
                  forceCloudinary: isRawFile,
                }),
                signal: fallbackController.signal,
              });

              clearTimeout(fallbackTimeout);

              const fallbackResult = await fallbackResponse.json();

              if (!fallbackResponse.ok) {
                throw new Error(fallbackResult.error || '서버 경유 업로드 실패');
              }

              // 서버 경유 업로드 성공
              if (fallbackResult.id && (fallbackResult.cloudinaryUrl || fallbackResult.s3Url)) {
                updateState('UPDATE_PHOTO_ID', {
                  oldId: photoId,
                  newId: fallbackResult.id,
                  cloudinaryUrl: fallbackResult.cloudinaryUrl,
                  s3Url: fallbackResult.s3Url
                });
                
                uploadCompleted = true;
                
                // S3 에러가 있으면 경고 메시지 표시
                if (fallbackResult.s3Error) {
                  alert('업로드 완료: Cloudinary 업로드는 성공했지만 S3 업로드는 실패했습니다.\n\nS3 환경 변수를 설정하면 원본 파일도 저장됩니다.');
                } else {
                  alert('업로드 완료: Presigned URL 생성 실패로 서버 경유 방식으로 업로드되었습니다.');
                }
              }
              
              return; // 성공적으로 폴백 완료
            } catch (fallbackError: any) {
              // 폴백도 실패한 경우
              const fallbackErrorMessage = fallbackError.message || '알 수 없는 오류';
              
              // S3 환경 변수 문제인 경우 Cloudinary만 사용 가능하다는 안내
              if (fallbackErrorMessage.includes('AWS_S3_BUCKET_NAME')) {
                console.warn('S3 환경 변수가 설정되지 않아 Cloudinary만 사용합니다.');
                // Cloudinary 업로드는 이미 성공했을 수 있으므로 에러를 던지지 않고 경고만 표시
                alert('S3 업로드가 실패했지만 Cloudinary 업로드는 완료되었습니다. S3 환경 변수를 설정하면 원본 파일도 저장됩니다.');
                return; // 로컬 저장은 이미 완료되었으므로 계속 진행
              }
              
              // 다른 에러인 경우 원래 에러를 throw하여 최종 catch 블록에서 처리
              throw new Error(`Presigned URL 생성 실패 후 서버 경유 재시도도 실패: ${fallbackErrorMessage}`);
            }
          }
        } else {
          // 기존 방식 (작은 파일, 서버 경유)
          // 타임아웃 설정 (60초)
          const uploadController = new AbortController();
          const uploadTimeout = setTimeout(() => uploadController.abort(), 60000);
          
          try {
            const uploadResponse = await fetch('/api/upload', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                originalData: originalDataForUpload, // 원본 (S3용, 별도 보관된 데이터)
                resizedData: imageData !== originalDataForUpload ? imageData : null, // 리사이징된 이미지 (Cloudinary용, 원본과 다를 때만)
                fileName: uploadFileName,
                mimeType: uploadMimeType,
                originalSize: uploadFileSize,
                groupId: currentGroupId,
                forceCloudinary: isRawFile,
              }),
              signal: uploadController.signal,
            });

            clearTimeout(uploadTimeout);

            if (!uploadResponse.ok) {
              const uploadResult = await uploadResponse.json().catch(() => ({ error: '업로드 실패' }));
              throw new Error(uploadResult.error || `업로드 실패: ${uploadResponse.status}`);
            }

            const uploadResult = await uploadResponse.json();

            if (process.env.NODE_ENV === 'development') {
              console.log('서버 경유 업로드 완료:', {
                cloudinaryUrl: uploadResult.cloudinaryUrl,
                s3Url: uploadResult.s3Url,
                memoryId: uploadResult.id,
              });
            }

            // 업로드 완료 후 Photo 객체 업데이트 (localStorage ID를 Supabase ID로 업데이트)
            if (uploadResult.id && (uploadResult.cloudinaryUrl || uploadResult.s3Url)) {
              updateState('UPDATE_PHOTO_ID', {
                oldId: photoId, // localStorage의 타임스탬프 ID
                newId: uploadResult.id, // Supabase ID
                cloudinaryUrl: uploadResult.cloudinaryUrl,
                s3Url: uploadResult.s3Url
              });
              
              uploadCompleted = true;
              // 업로드 완료 알림 (3초 후 자동 사라짐)
              setTimeout(() => {
                if (process.env.NODE_ENV === 'development') {
                  console.log('업로드 완료:', uploadResult.id);
                }
              }, 100);
            }
          } catch (fetchError: any) {
            clearTimeout(uploadTimeout);
            if (fetchError.name === 'AbortError') {
              throw new Error('업로드 타임아웃 (60초 초과)');
            }
            throw fetchError;
          }
        }

        // 업로드 성공 시 Photo 객체에 URL 정보 추가 (선택적)
        // localStorage의 데이터는 그대로 유지하고, 필요시 Supabase에서 최신 데이터를 가져올 수 있음
        
      } catch (uploadError: any) {
        // 업로드 실패해도 localStorage 저장은 유지 (오프라인 지원)
        console.error('Cloudinary/S3 업로드 오류 (localStorage는 저장됨):', uploadError);
        if (process.env.NODE_ENV === 'development') {
          console.warn('업로드 실패했지만 로컬 저장은 완료되었습니다.');
        }
        
        // 업로드 실패 시 isUploading 플래그 해제 (재시도 가능하도록)
        updateState('UPDATE_PHOTO_ID', {
          oldId: photoId,
          newId: photoId, // ID는 변경하지 않음
          cloudinaryUrl: null,
          s3Url: null,
          uploadFailed: true // 실패 플래그
        });
        
        // 사용자에게 에러 알림 (환경 변수 정보 포함)
        const errorMessage = uploadError.message || '업로드 중 오류가 발생했습니다.';
        let userMessage = '';
        
        if (errorMessage.includes('Cloudinary 환경 변수') || errorMessage.includes('CLOUDINARY')) {
          userMessage = 'Cloudinary 환경 변수가 설정되지 않았습니다.\n\n로컬 저장은 완료되었습니다.\n\n필요한 환경 변수:\n- CLOUDINARY_CLOUD_NAME\n- CLOUDINARY_API_KEY\n- CLOUDINARY_API_SECRET\n\n.env.local 파일과 Vercel 환경 변수에 설정해주세요.';
        } else if (errorMessage.includes('AWS_S3_BUCKET_NAME') || errorMessage.includes('S3 환경 변수')) {
          userMessage = 'S3 환경 변수가 설정되지 않았습니다.\n\n로컬 저장은 완료되었습니다. S3 환경 변수를 설정하면 원본 파일도 저장됩니다.\n\n필요한 환경 변수:\n- AWS_S3_BUCKET_NAME\n- AWS_ACCESS_KEY_ID\n- AWS_SECRET_ACCESS_KEY\n- AWS_REGION\n\n.env.local 파일과 Vercel 환경 변수에 설정해주세요.';
        } else if (errorMessage.includes('Cloudinary와 S3 업로드가 모두 실패')) {
          userMessage = 'Cloudinary와 S3 업로드가 모두 실패했습니다.\n\n로컬 저장은 완료되었습니다.\n\n환경 변수를 확인해주세요:\n- Cloudinary: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET\n- S3: AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION';
        } else if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
          userMessage = '업로드 실패: S3 버킷 CORS 설정이 필요합니다.\n\n로컬 저장은 완료되었습니다.\n\nS3 버킷의 CORS 설정을 확인하거나 관리자에게 문의하세요.';
        } else if (errorMessage.includes('타임아웃')) {
          userMessage = '업로드 타임아웃: 파일이 너무 크거나 네트워크 연결이 불안정합니다.\n\n로컬 저장은 완료되었습니다.';
        } else {
          userMessage = `업로드 실패: ${errorMessage}\n\n로컬 저장은 완료되었습니다.`;
        }
        
        alert(userMessage);
      } finally {
        // 업로드가 완료되지 않았고 플래그가 아직 true인 경우 강제로 해제
        if (!uploadCompleted && photoId !== null) {
          // catch 블록에서 이미 처리했지만, 혹시 모를 경우를 대비해 즉시 해제
          console.warn('업로드가 완료되지 않았습니다. isUploading 플래그를 해제합니다.');
          updateState('UPDATE_PHOTO_ID', {
            oldId: photoId,
            newId: photoId,
            cloudinaryUrl: null,
            s3Url: null,
            uploadFailed: true
          });
        }
      }
    } catch (error: any) {
      console.error('Image processing error:', error);
      // 이미지 처리 에러에서도 isUploading 플래그 해제 (photoId가 정의된 경우에만)
      if (photoId !== null) {
        updateState('UPDATE_PHOTO_ID', {
          oldId: photoId,
          newId: photoId,
          cloudinaryUrl: null,
          s3Url: null,
          uploadFailed: true
        });
      }
      alert('이미지 처리 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
    
    // Reset file input
    e.target.value = "";
  };

  // Upload 버튼 클릭 핸들러
  const handleUploadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Upload button clicked');
    console.log('fileInputRef.current:', fileInputRef.current);
    
    // fileInputRef가 준비될 때까지 대기
    const triggerFileInput = () => {
      if (fileInputRef.current) {
        console.log('Triggering file input click');
        fileInputRef.current.click();
      } else {
        console.warn('fileInputRef is null, retrying...');
        // ref가 아직 준비되지 않았으면 잠시 후 재시도
        setTimeout(() => {
          if (fileInputRef.current) {
            console.log('Retry: Triggering file input click');
            fileInputRef.current.click();
          } else {
            console.error('fileInputRef is still null after retry');
            alert('파일 입력을 초기화할 수 없습니다. 페이지를 새로고침해주세요.');
          }
        }, 100);
      }
    };
    
    triggerFileInput();
  };

  // --- [RENDER] ---
  
  if (!isMounted) return null; // Hydration mismatch 방지

  // Supabase 세션이 없으면 로그인 페이지로 리다이렉트 (렌더링 전 처리)
  if (!isAuthenticated && isMounted) {
    return null; // useEffect에서 리다이렉트 처리 중
  }

  const piggyLabel = (() => {
    const rawName = piggySummary?.name?.trim() || 'Ellena Piggy Bank';
    const base = rawName.replace(/piggy\s*bank/gi, '').trim();
    return base || rawName;
  })();
  const isGroupAdmin = (groupUserRole === 'ADMIN' || groupIsOwner) && currentGroupId !== null;
  const showAdminButton = isSystemAdmin || isGroupAdmin;
  const adminPagePath = isSystemAdmin ? '/admin' : '/group-admin';

  return (
    <div className="app-container">
      {showGroupSelectModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
              그룹 선택
            </h3>
            <p style={{ margin: '8px 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              여러 그룹에 가입되어 있습니다. 접속할 그룹을 선택하세요.
              {(isSystemAdmin || isGroupAdmin)
                ? ' 관리자 계정은 관리자 페이지에서 관리 가능한 그룹으로 바로 이동할 수 있습니다.'
                : ' 다른 그룹으로 이동하려면 로그아웃 후 다시 로그인해야 합니다.'}
            </p>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              {groupList.map((group: any) => {
                const membership = groupMemberships.find((m: any) => m.group_id === group.id);
                const isAdminRole = membership?.role === 'ADMIN' || group.owner_id === userId;
                return (
                  <label
                    key={group.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: selectedGroupId === group.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      backgroundColor: selectedGroupId === group.id ? '#eef2ff' : '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="group-select"
                      checked={selectedGroupId === group.id}
                      onChange={() => setSelectedGroupId(group.id)}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {group.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {isAdminRole ? '관리자' : '멤버'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                로그아웃
              </button>
              <button
                onClick={() => {
                  if (!selectedGroupId || !setCurrentGroupId) return;
                  // 시스템 관리자가 멤버인 그룹도 선택 가능하도록 즉시 전환
                  setCurrentGroupId(selectedGroupId);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('currentGroupId', selectedGroupId);
                  }
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('groupSelectionCompleted', 'true');
                  }
                  if (refreshGroups) {
                    refreshGroups().catch(() => undefined);
                  }
                  if (refreshMemberships) {
                    refreshMemberships().catch(() => undefined);
                  }
                  setShowGroupSelectModal(false);
                }}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                접속하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Todo Modal - Chalkboard Style */}
      {isTodoModalOpen && (
        <div className="chalkboard-modal-overlay" onClick={() => setIsTodoModalOpen(false)}>
          <div className="chalkboard-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="chalkboard-modal-title">
              <span className="chalkboard-modal-icon">📝</span>
              새 할 일 등록
          </h3>
            <div className="chalkboard-modal-form">
              <div className="chalkboard-form-field">
                <label className="chalkboard-form-label">무엇을 할까요?</label>
              <input 
                ref={todoTextRef}
                type="text" 
                  className="chalkboard-form-input" 
                placeholder="할 일 내용 입력"
              />
            </div>
              <div className="chalkboard-form-field">
                <label className="chalkboard-form-label">누가 할까요?</label>
              <input 
                ref={todoWhoRef}
                type="text" 
                  className="chalkboard-form-input" 
                placeholder="이름 입력 (비워두면 누구나)"
              />
            </div>
          </div>
            <div className="chalkboard-modal-actions">
              <button 
                onClick={() => setIsTodoModalOpen(false)} 
                className="chalkboard-btn-secondary"
              >
                취소
              </button>
            <button 
              onClick={submitNewTodo} 
                className="chalkboard-btn-primary"
            >
              등록하기
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Nickname Modal */}
      {isNicknameModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNicknameModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <span className="modal-icon">✏️</span>
              닉네임 설정
            </h3>
            <div className="modal-form">
              <div className="form-field">
                <label className="form-label">닉네임 (2-20자)</label>
                <input 
                  ref={nicknameInputRef}
                  type="text" 
                  className="form-input" 
                  placeholder="닉네임을 입력하세요"
                  maxLength={20}
                  defaultValue={userName}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setIsNicknameModalOpen(false)} 
                className="btn-secondary"
              >
                취소
              </button>
              <button 
                onClick={handleUpdateNickname} 
                className="btn-primary"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 가족 이름 수정 모달 */}
      {showRenameModal && (
        <div className="modal-overlay" onClick={handleRenameCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <span className="modal-icon">✏️</span>
              가족 이름 수정
            </h3>
            <div className="modal-form">
              <div className="form-field">
                <label className="form-label">가족 이름</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="가족 이름을 입력하세요"
                  maxLength={50}
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameSubmit();
                    } else if (e.key === 'Escape') {
                      handleRenameCancel();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={handleRenameCancel} 
                className="btn-secondary"
              >
                취소
              </button>
              <button 
                onClick={handleRenameSubmit} 
                className="btn-primary"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="app-header">
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '0 16px' }}>
            {showAdminButton && (
              <button
                onClick={() => router.push(adminPagePath)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: isSystemAdmin ? '#7e22ce' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                aria-label={isSystemAdmin ? "시스템 관리자 페이지" : "그룹 관리자 페이지"}
              >
                <span style={{ fontSize: '14px' }}>⚙️</span>
                관리자
              </button>
            )}
          </div>
          <TitlePage 
            title={state.familyName || 'Ellena Family Hub'}
            photos={state.album || []}
            titleStyle={titleStyle}
            onTitleStyleChange={(style) => {
              setTitleStyle(style);
              // 가족 이름도 함께 업데이트
              if (style.content) {
                updateState('RENAME', style.content);
              }
              // titleStyle을 state에 저장
              updateState('UPDATE_TITLE_STYLE', style);
            }}
          />
          <div className="status-indicator">
            <span className="status-dot">
              <span className="status-dot-ping"></span>
              <span className="status-dot-core"></span>
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {onlineUsers.map((user) => (
                <div 
                  key={user.id}
                  className="user-info" 
                  onClick={user.isCurrentUser ? () => setIsNicknameModalOpen(true) : undefined}
            style={{
                    cursor: user.isCurrentUser ? 'pointer' : 'default',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                  }}
                >
                  <span className="user-icon" style={{ fontSize: '12px' }}>👤</span>
                  <p className="user-name" style={{ margin: 0, fontSize: '12px', fontWeight: user.isCurrentUser ? '600' : '500' }}>
                    {user.name}
                    {user.isCurrentUser && ' (나)'}
                  </p>
                </div>
              ))}
              {onlineUsers.length === 0 && (
                <div className="user-info" onClick={() => setIsNicknameModalOpen(true)} style={{ cursor: 'pointer' }}>
                  <span className="user-icon">👤</span>
                  <p className="user-name">{userName || '로딩 중...'}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              style={{
                marginLeft: '12px',
                padding: '8px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              }}
            >
              로그아웃
            </button>
          </div>
        </header>


        {/* Content Sections Container */}
        <div className="sections-container">
          {/* Family Memories Section */}
          <section className="content-section memory-vault">
            <div className="section-header">
              <h2 className="section-title-large">Family Memories</h2>
              <label htmlFor="file-upload-input" className="btn-upload" style={{ cursor: 'pointer', display: 'inline-block' }}>
                Upload
              </label>
              <input 
                id="file-upload-input"
                type="file" 
                ref={fileInputRef} 
                accept="image/*,.heic,.heif,.raw,.cr2,.nef,.arw,.orf,.rw2,.dng,.raf,.srw" 
                style={{ display: 'none' }}
                onChange={handleFileSelect} 
              />
            </div>
            <div className="photo-horizontal-scroll">
              {state.album && state.album.length > 0 ? (
                <>
                  {state.album.map((p, index) => (
                    <div 
                      key={p.id} 
                      className="photo-card" 
                      style={{ position: 'relative' }}
                      onMouseEnter={() => setHoveredPhotoId(p.id)}
                      onMouseLeave={() => setHoveredPhotoId(null)}
                    >
                      <div 
                        className="photo-card-image"
                        onClick={() => setSelectedPhotoIndex(index)}
                        style={{ cursor: 'pointer' }}
                      >
                        <img src={p.data} alt="memory" />
                        {/* 업로드 상태 표시 */}
                        {p.isUploading && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '12px 12px 0 0',
                            zIndex: 1
                          }}>
                            <div style={{
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: '600',
                              textAlign: 'center'
                            }}>
                              <div style={{
                                width: '24px',
                                height: '24px',
                                border: '3px solid rgba(255, 255, 255, 0.3)',
                                borderTop: '3px solid white',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 8px'
                              }}></div>
                              업로드 중...
                            </div>
                          </div>
                        )}
                        {p.isUploaded && !p.isUploading && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            backgroundColor: 'rgba(34, 197, 94, 0.9)',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5"></path>
                            </svg>
                          </div>
                        )}
                        {/* 사진 삭제 버튼 (hover시 나타남) */}
                        {p.created_by === userId && hoveredPhotoId === p.id && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("사진을 삭제하시겠습니까?")) {
                                updateState('DELETE_PHOTO', p.id);
                              }
                            }} 
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              width: '24px',
                              height: '24px',
                              backgroundColor: 'rgba(239, 68, 68, 0.9)',
                              border: 'none',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              zIndex: 3,
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.95)';
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                      {/* 설명 영역 */}
                      <div 
                        className="photo-card-description"
                        onClick={() => {
                          if (editingPhotoId !== p.id) {
                            setEditingPhotoId(p.id);
                            setPhotoDescription(p.description || '');
                          }
                        }}
                        style={{ cursor: editingPhotoId === p.id ? 'default' : 'pointer' }}
                      >
                        {editingPhotoId === p.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                              type="text"
                              value={photoDescription}
                              onChange={(e) => setPhotoDescription(e.target.value)}
                              placeholder="사진 설명을 입력하세요"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #6366f1',
                                borderRadius: '6px',
                                fontSize: '14px',
                                outline: 'none'
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateState('UPDATE_PHOTO_DESCRIPTION', { photoId: p.id, description: photoDescription });
                                  setEditingPhotoId(null);
                                  setPhotoDescription('');
                                } else if (e.key === 'Escape') {
                                  setEditingPhotoId(null);
                                  setPhotoDescription('');
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateState('UPDATE_PHOTO_DESCRIPTION', { photoId: p.id, description: photoDescription });
                                  setEditingPhotoId(null);
                                  setPhotoDescription('');
                                }}
                                style={{
                                  flex: 1,
                                  padding: '6px 12px',
                                  backgroundColor: '#6366f1',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                저장
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("사진을 삭제하시겠습니까?")) {
                                    updateState('DELETE_PHOTO', p.id);
                                    setEditingPhotoId(null);
                                    setPhotoDescription('');
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  padding: '6px 12px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                삭제
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPhotoId(null);
                                  setPhotoDescription('');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#e2e8f0',
                                  color: '#64748b',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span 
                            style={{ 
                              fontSize: '14px', 
                              color: p.description ? '#1e293b' : '#94a3b8',
                              minHeight: '20px',
                              display: 'block',
                              lineHeight: '1.5'
                            }}
                          >
                            {p.description || '설명 추가하기 (클릭)'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* 빈 카드 추가 (사진이 3개 미만일 때) */}
                  {state.album.length < 3 && (
                    <div className="photo-card photo-card-empty">
                      <div className="photo-card-image" style={{ 
                        border: '2px dashed #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer'
                      }} onClick={() => document.getElementById('file-upload-input')?.click()}>
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>+</div>
                          <div>사진 추가</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="photo-card photo-card-empty" style={{ width: '100%' }}>
                  <div className="photo-card-image" style={{ 
                    border: '2px dashed #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    minHeight: '200px'
                  }} onClick={() => document.getElementById('file-upload-input')?.click()}>
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
                      <div>사진을 업로드해보세요</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Photo Swipe Modal */}
            {selectedPhotoIndex !== null && state.album && state.album.length > 0 && (
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  zIndex: 10000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'pan-y'
                }}
                onClick={() => setSelectedPhotoIndex(null)}
                onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
                onTouchMove={(e) => setTouchEnd(e.touches[0].clientX)}
                onTouchEnd={() => {
                  if (!touchStart || !touchEnd) return;
                  const distance = touchStart - touchEnd;
                  const isLeftSwipe = distance > 50;
                  const isRightSwipe = distance < -50;
                  
                  if (isLeftSwipe && selectedPhotoIndex < state.album.length - 1) {
                    setSelectedPhotoIndex(selectedPhotoIndex + 1);
                  }
                  if (isRightSwipe && selectedPhotoIndex > 0) {
                    setSelectedPhotoIndex(selectedPhotoIndex - 1);
                  }
                  
                  setTouchStart(null);
                  setTouchEnd(null);
                }}
              >
                <div 
                  style={{
                    position: 'relative',
                    width: '90%',
                    maxWidth: '800px',
                    maxHeight: '90vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img 
                    src={state.album[selectedPhotoIndex].data} 
                    alt="memory" 
                    style={{
                      maxWidth: '100%',
                      maxHeight: '90vh',
                      objectFit: 'contain',
                      borderRadius: '8px'
                    }}
                  />
                  
                  {/* Navigation Arrows */}
                  {selectedPhotoIndex > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPhotoIndex(selectedPhotoIndex - 1);
                      }}
                      style={{
                        position: 'absolute',
                        left: '20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255, 255, 255, 0.3)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '24px',
                        color: 'white',
                        zIndex: 10001
                      }}
                    >
                      ←
                    </button>
                  )}
                  
                  {selectedPhotoIndex < state.album.length - 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPhotoIndex(selectedPhotoIndex + 1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255, 255, 255, 0.3)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '24px',
                        color: 'white',
                        zIndex: 10001
                      }}
                    >
                      →
                    </button>
                  )}
                  
                  {/* Close Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex(null);
                    }}
                    style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      background: 'rgba(255, 255, 255, 0.3)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '20px',
                      color: 'white',
                      zIndex: 10001
                    }}
                  >
                    ✕
                  </button>
                  
                  {/* Photo Counter */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '20px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '14px'
                    }}
                  >
                    {selectedPhotoIndex + 1} / {state.album.length}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Family Tasks Section - Chalkboard Style */}
          <section className="chalkboard-container">
            {/* Chalkboard Decorations - Top Right */}
            <div className="chalkboard-decorations">
              {/* House Icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              {/* Sun Icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
              {/* Heart Icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </div>

            <div className="chalkboard-header">
              <h3 className="chalkboard-title">Family Tasks</h3>
            <button 
              onClick={() => setIsTodoModalOpen(true)} 
                className="chalkboard-btn-add"
            >
              + ADD
            </button>
          </div>
            <div className="section-body">
              {state.todos.length > 0 ? (
                <div className="todo-list">
                  {state.todos.map(t => (
                    <div key={t.id} className="todo-item">
                      <div 
                        onClick={() => updateState('TOGGLE_TODO', t.id)} 
                        className="todo-content"
                      >
                        <div className={`todo-checkbox ${t.done ? 'todo-checkbox-checked' : ''}`}>
                          {t.done && (
                            <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7"></path>
                            </svg>
                          )}
                  </div>
                        <div className="todo-text-wrapper">
                          <span className={`todo-text ${t.done ? 'todo-text-done' : ''}`}>
                            {t.text}
                          </span>
                          {t.assignee && (
                            <span className="todo-assignee">{t.assignee}</span>
                          )}
                  </div>
                </div>
                      {(t.created_by === userId || !t.created_by) && (
                        <button 
                          onClick={() => confirm("삭제하시겠습니까?") && updateState('DELETE_TODO', t.id)} 
                          className="chalkboard-btn-delete"
                        >
                          <svg className="chalkboard-icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                </button>
            )}
          </div>
                  ))}
        </div>
              ) : (
                <p className="chalkboard-empty-state">할 일을 모두 완료했습니다! 🎉</p>
              )}
            </div>
          </section>

          {/* Family Calendar Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 className="section-title">Family Calendar</h3>
          </div>
            <div className="section-body">
              <div className="calendar-events">
                {state.events.length > 0 ? (
                  <div className="event-list">
                    {state.events.map(e => (
                      <div key={e.id} className="event-item">
                        <div className="event-date">
                          <span className="event-month">{e.month}</span>
                          <span className="event-day">{e.day}</span>
                  </div>
                        <div className="event-details">
                          <h4 className="event-title">{e.title}</h4>
                          <p className="event-desc">{e.desc}</p>
                  </div>
                        {(e.created_by === userId || !e.created_by) && (
                          <button 
                            onClick={() => confirm("삭제하시겠습니까?") && updateState('DELETE_EVENT', e.id)} 
                            className="btn-delete-event"
                          >
                            <svg className="icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                  </button>
                        )}
                </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">등록된 일정이 없습니다.</p>
              )}
            </div>
            <button 
              onClick={openEventModal} 
                className="btn-calendar-add"
            >
              + 일정 추가하기
            </button>
          </div>
          </section>

          {/* 일정 추가 모달 */}
          {showEventModal && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}
              onClick={closeEventModal}
            >
              <div 
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  width: '90%',
                  maxWidth: '500px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>
                  일정 추가
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    제목 *
                  </label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    placeholder="일정 제목을 입력하세요"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                  />
        </div>

                <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                      월 *
                    </label>
                    <select
                      value={eventForm.month}
                      onChange={(e) => setEventForm({ ...eventForm, month: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '15px',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">선택</option>
                      <option value="JAN">JAN</option>
                      <option value="FEB">FEB</option>
                      <option value="MAR">MAR</option>
                      <option value="APR">APR</option>
                      <option value="MAY">MAY</option>
                      <option value="JUN">JUN</option>
                      <option value="JUL">JUL</option>
                      <option value="AUG">AUG</option>
                      <option value="SEP">SEP</option>
                      <option value="OCT">OCT</option>
                      <option value="NOV">NOV</option>
                      <option value="DEC">DEC</option>
                    </select>
          </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                      일 *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={eventForm.day}
                      onChange={(e) => setEventForm({ ...eventForm, day: e.target.value })}
                      placeholder="일"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '15px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    설명 (선택)
                  </label>
                  <textarea
                    value={eventForm.desc}
                    onChange={(e) => setEventForm({ ...eventForm, desc: e.target.value })}
                    placeholder="일정 설명을 입력하세요"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={closeEventModal}
                    style={{
                      padding: '10px 20px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      color: '#64748b',
                      fontSize: '15px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleEventSubmit}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      fontSize: '15px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Family Chat Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 className="section-title">Family Chat</h3>
          </div>
            <div className="section-body">
              <div ref={chatBoxRef} className="chat-messages">
              {(state.messages || []).map((m, idx) => (
                  <div key={idx} className="message-item">
                    <div className="message-header">
                      <span className="message-user">{m.user}</span>
                      <span className="message-time">{m.time}</span>
                  </div>
                    <div className="message-bubble">
                      <p className="message-text">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
              <div className="chat-input-wrapper">
              <input 
                ref={chatInputRef}
                type="text" 
                onKeyPress={(e) => e.key === 'Enter' && sendChat()}
                  className="chat-input" 
                placeholder="메시지 입력..."
              />
              <button 
                onClick={sendChat}
                  className="btn-send"
              >
                전송
              </button>
            </div>
          </div>
          </section>

          {/* Piggy Bank Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 className="section-title">Ellena Piggy Bank</h3>
              {currentGroupId && (
                <button
                  onClick={() => router.push('/piggy-bank')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <span>🐷</span>
                  이동
                </button>
              )}
            </div>
            <div className="section-body">
              {!currentGroupId ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Piggy Bank을 보려면 그룹을 선택해 주세요.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {piggySummaryError && (
                    <div style={{ fontSize: '12px', color: '#b91c1c', backgroundColor: '#fee2e2', padding: '8px 10px', borderRadius: '8px' }}>
                      {piggySummaryError}
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '12px', color: '#b91c1c' }}>{piggyLabel} 용돈 잔액</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c' }}>
                        {piggySummary ? `${piggySummary.walletBalance.toLocaleString('ko-KR')}원` : '불러오는 중...'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#fff7ed', borderRadius: '12px', padding: '12px', border: '1px solid #fed7aa' }}>
                      <div style={{ fontSize: '12px', color: '#9a3412' }}>{piggyLabel} 저금통 잔액</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#9a3412' }}>
                        {piggySummary ? `${piggySummary.bankBalance.toLocaleString('ko-KR')}원` : '불러오는 중...'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Location Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 className="section-title">Family Location</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setShowLocationRequestModal(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📍</span>
                  <span>어디야</span>
                </button>
        </div>
            </div>
            <div className="section-body">
              {state.location.latitude && state.location.longitude && state.location.address && (
                <div style={{ marginBottom: '16px' }}>
                  <p className="location-text" style={{ marginBottom: '12px' }}>
                    내 위치: {extractLocationAddress(state.location.address)}
                  </p>
                </div>
              )}
              
              {/* 구글맵 항상 표시 */}
              {process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY ? (
                mapError ? (
                  <div style={{
                    width: '100%',
                    height: '400px',
                    borderRadius: '12px',
                    border: '1px solid #fecaca',
                    marginTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fef2f2',
                    color: '#991b1b',
                    padding: '20px'
                  }}>
                    <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                      <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#dc2626' }}>
                        ⚠️ Google Maps 오류
                      </p>
                      <p style={{ fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>
                        {mapError}
                      </p>
                      <div style={{ 
                        backgroundColor: '#fee2e2', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        marginBottom: '16px',
                        fontSize: '13px',
                        lineHeight: '1.6'
                      }}>
                        <p style={{ fontWeight: '600', marginBottom: '8px' }}>해결 방법 (무료 할당량 사용):</p>
                        <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                          <li><a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626', textDecoration: 'underline' }}>Google Cloud Console</a>에 접속</li>
                          <li>프로젝트 선택 → <strong>결제 계정 연결</strong> (신용카드 등록 필요)</li>
                          <li>Maps JavaScript API 활성화 확인</li>
                          <li><strong>월 $200 무료 크레딧</strong>이 자동으로 제공됩니다 (개발/테스트 용도로 충분)</li>
                        </ol>
                        <p style={{ marginTop: '8px', fontSize: '12px', color: '#991b1b' }}>
                          💡 참고: 무료 크레딧은 매월 자동으로 충전되며, 사용하지 않으면 소멸됩니다.
                        </p>
          </div>
                      {state.location.latitude && state.location.longitude && (
                        <a 
                          href={`https://www.google.com/maps?q=${state.location.latitude},${state.location.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ 
                            color: '#dc2626', 
                            textDecoration: 'underline',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          Google 지도에서 위치 보기
                        </a>
                      )}
        </div>
                  </div>
                ) : (
                  <div 
                    id="map" 
                    style={{ 
                      width: '100%', 
                      height: '400px', 
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      marginTop: '12px'
                    }}
                  />
                )
              ) : (
                <div style={{
                  width: '100%',
                  height: '400px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  padding: '20px'
                }}>
                  <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                    <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
                      📍 Google Maps API 키가 필요합니다
                    </p>
                    <div style={{ fontSize: '13px', textAlign: 'left', backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                      <p style={{ marginBottom: '8px', fontWeight: '600' }}>설정 방법:</p>
                      <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                        <li>프로젝트 루트에 <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>.env.local</code> 파일 생성</li>
                        <li>다음 내용 추가:<br />
                          <code style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', display: 'inline-block', marginTop: '4px' }}>
                            NEXT_PUBLIC_GOOGLE_MAP_API_KEY=여기에_API_키_입력
                          </code>
                        </li>
                        <li>개발 서버 재시작 (<code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>npm run dev</code>)</li>
                      </ol>
                      <p style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
                        💡 API 키 발급: <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Google Cloud Console</a> → Maps JavaScript API 활성화
                      </p>
                    </div>
                    {state.location.latitude && state.location.longitude && (
                      <p style={{ fontSize: '12px', marginTop: '8px' }}>
                        또는 <a href={`https://www.google.com/maps?q=${state.location.latitude},${state.location.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Google 지도에서 보기</a>
                      </p>
                    )}
                  </div>
                </div>
              )}
              

              {/* 위치 요청 목록 */}
              {locationRequests.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                    위치 요청
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Pending 요청 */}
                    {locationRequests
                      .filter(req => req.status === 'pending')
                      .map((req) => {
                        const isRequester = req.requester_id === userId;
                        const otherUser = isRequester ? req.target : req.requester;
                        const otherUserName = otherUser?.nickname || otherUser?.email || otherUser?.id?.substring(0, 8) || '알 수 없음';
                        const expiresAt = req.expires_at ? new Date(req.expires_at) : null;
                        const now = new Date();
                        const timeLeft = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)) : 0;
                        const isExpired = expiresAt ? expiresAt < now : false;

                        return (
                          <div
                            key={req.id}
                            style={{
                              padding: '12px',
                              backgroundColor: isExpired ? '#fee2e2' : '#f8fafc',
                              borderRadius: '8px',
                              border: `1px solid ${isExpired ? '#fca5a5' : '#e2e8f0'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                {isRequester ? `→ ${otherUserName}` : `← ${otherUserName}`}
          </div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {isRequester ? '요청 보냄' : '요청 받음'}
                                {!isExpired && timeLeft > 0 && (
                                  <span style={{ marginLeft: '8px'}}>
                                    · {Math.floor(timeLeft / 60)}시간 {timeLeft % 60}분 남음
                                  </span>
                                )}
                                {isExpired && <span style={{ marginLeft: '8px', color: '#ef4444' }}>· 만료됨</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {isRequester ? (
                <button 
                                  onClick={() => handleLocationRequestAction(req.id, 'cancel')}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  취소
                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleLocationRequestAction(req.id, 'accept')}
                                    disabled={isExpired}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: isExpired ? '#cbd5e1' : '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      cursor: isExpired ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      opacity: isExpired ? 0.6 : 1
                                    }}
                                  >
                                    <span>📍</span>
                                    <span>여기야</span>
                                  </button>
                                  <button
                                    onClick={() => handleLocationRequestAction(req.id, 'reject')}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#ef4444',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    거부
                                  </button>
                                </>
                              )}
              </div>
                          </div>
                        );
                      })}
                    
                    {/* Accepted 요청 (활성 위치 공유) */}
                    {locationRequests
                      .filter(req => req.status === 'accepted')
                      .map((req) => {
                        const isRequester = req.requester_id === userId;
                        const otherUser = isRequester ? req.target : req.requester;
                        const otherUserName = otherUser?.nickname || otherUser?.email || otherUser?.id?.substring(0, 8) || '알 수 없음';
                        const expiresAt = req.expires_at ? new Date(req.expires_at) : null;
                        const now = new Date();
                        const timeLeft = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)) : 0;
                        const isExpired = expiresAt ? expiresAt < now : false;

                        return (
                          <div
                            key={req.id}
                            style={{
                              padding: '12px',
                              backgroundColor: isExpired ? '#fee2e2' : '#d1fae5',
                              borderRadius: '8px',
                              border: `1px solid ${isExpired ? '#fca5a5' : '#10b981'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '500', marginBottom: '4px', color: '#059669' }}>
                                ✓ {otherUserName}와(과) 위치 공유 중
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {!isExpired && timeLeft > 0 ? (
                                  <span>📍 {Math.floor(timeLeft / 60)}시간 {timeLeft % 60}분 남음</span>
                                ) : (
                                  <span style={{ color: '#ef4444' }}>📍 만료됨</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => endLocationSharing(req.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              종료
                            </button>
                          </div>
                        );
                      })}
                  </div>
              </div>
            )}
          </div>
        </section>
        
        {/* 위치 요청 모달 */}
        {showLocationRequestModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => {
              setShowLocationRequestModal(false);
              setSelectedUserForRequest(null);
              // 모달 닫을 때 상태 초기화 (useEffect에서도 처리되지만 명시적으로)
              setLoadingUsers(false);
              setAllUsers([]);
              loadingUsersRef.current = false;
              modalOpenedRef.current = false;
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                위치 공유 요청 보내기
              </h3>
              {loadingUsers ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  사용자 목록을 불러오는 중...
      </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                  {/* 모든 사용자 목록 (온라인/오프라인 모두) */}
                  {allUsers.length > 0 ? (
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '16px'
                      }}
                    >
                      <div 
                        style={{ 
                          fontSize: '14px', 
                          color: '#1e293b', 
                          marginBottom: '12px', 
                          fontWeight: '600',
                          paddingBottom: '8px',
                          borderBottom: '1px solid #e2e8f0'
                        }}
                      >
                        모든 사용자 ({allUsers.length}명)
    </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {allUsers.map((user) => {
                        const isOnline = onlineUsers.some(onlineUser => onlineUser.id === user.id);
                        const hasAcceptedRequest = locationRequests.some(
                          req =>
                            ((req.requester_id === userId && req.target_id === user.id) ||
                             (req.requester_id === user.id && req.target_id === userId)) &&
                            req.status === 'accepted'
                        );
                        const hasPendingRequest = locationRequests.some(
                          req =>
                            ((req.requester_id === userId && req.target_id === user.id) ||
                             (req.requester_id === user.id && req.target_id === userId)) &&
                            req.status === 'pending'
                        );

                        return (
                          <div
                            key={user.id}
                            style={{
                              padding: '12px',
                              backgroundColor: hasAcceptedRequest ? '#d1fae5' : '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '8px'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '500' }}>
                                {user.nickname || user.email || `사용자 ${user.id.substring(0, 8)}`}
                                {isOnline && (
                                  <span style={{ fontSize: '10px', color: '#10b981', marginLeft: '6px' }}>● 온라인</span>
                                )}
                              </div>
                              {user.nickname && user.email && (
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {user.email}
                                </div>
                              )}
                              {!user.nickname && user.email && (
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  ID: {user.id.substring(0, 8)}...
                                </div>
                              )}
                              {hasAcceptedRequest && (
                                <div style={{ fontSize: '12px', color: '#059669' }}>
                                  ✓ 이미 승인됨
                                </div>
                              )}
                              {hasPendingRequest && (
                                <div style={{ fontSize: '12px', color: '#f59e0b' }}>
                                  ⏳ 요청 대기 중
                                </div>
                              )}
                            </div>
                            {!hasAcceptedRequest && !hasPendingRequest && (
                              <button
                                onClick={() => sendLocationRequest(user.id)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                요청 보내기
                              </button>
                            )}
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '20px',
                        textAlign: 'center'
                      }}
                    >
                      <p style={{ color: '#64748b', margin: 0, marginBottom: '8px' }}>
                        요청할 수 있는 사용자가 없습니다.
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                        다른 사용자가 가입하면 여기에 표시됩니다.
                      </p>
                      <button
                        onClick={() => {
                          console.log('사용자 목록 새로고침');
                          loadAllUsers(0);
                        }}
                        style={{
                          marginTop: '12px',
                          padding: '6px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        새로고침
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setShowLocationRequestModal(false);
                  setSelectedUserForRequest(null);
                  // 모달 닫을 때 상태 초기화
                  setLoadingUsers(false);
                  setAllUsers([]);
                  loadingUsersRef.current = false;
                  modalOpenedRef.current = false;
                }}
                style={{
                  marginTop: '16px',
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#e2e8f0',
                  color: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
              </div>
      
      {/* 업로드 상태 애니메이션 스타일 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* 하단 고정 회원탈퇴 버튼 */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 1000,
        }}
      >
        <button
          onClick={handleDeleteAccount}
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(139, 69, 19, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(139, 69, 19, 0.4)',
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(139, 69, 19, 1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 69, 19, 0.5)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(139, 69, 19, 0.9)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 69, 19, 0.4)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          aria-label="회원탈퇴"
        >
          <span style={{ fontSize: '14px' }}>🗑️</span>
          회원탈퇴
        </button>
      </div>
    </div>
  );
}