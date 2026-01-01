'use client';

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
}

const INITIAL_STATE: AppState = {
  familyName: "Ellena Family Hub",
  location: { address: "서울특별시 서초구 반포대로 222" },
  familyLocations: [],
  todos: [],
  album: [],
  events: [],
  messages: [{ id: 0, user: "System", text: "가족 채팅방이 활성화되었습니다.", time: "방금" }]
};

// Realtime subscription 변수를 컴포넌트 외부로 이동하여 handleLogout에서 접근 가능하도록
let messagesSubscription: any = null;
let tasksSubscription: any = null;
let eventsSubscription: any = null;
let photosSubscription: any = null;
let presenceSubscription: any = null;

export default function FamilyHub() {
  const router = useRouter();
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
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationRequests, setLocationRequests] = useState<Array<{
    id: string;
    requester_id: string;
    target_id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    created_at: string;
    expires_at?: string;
    requester?: { id: string; email: string; full_name: string | null };
    target?: { id: string; email: string; full_name: string | null };
  }>>([]);
  const [showLocationRequestModal, setShowLocationRequestModal] = useState(false);
  const [selectedUserForRequest, setSelectedUserForRequest] = useState<string | null>(null);
  
  // Realtime subscription 참조 (로그아웃 시 정리용)
  const subscriptionsRef = useRef<{
    messages: any;
    tasks: any;
    events: any;
    photos: any;
  }>({ messages: null, tasks: null, events: null, photos: null });

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

  // --- [HANDLERS] App 객체 메서드 이식 ---
  
  // 온라인 사용자 목록은 Realtime presence로 관리 (별도 함수 불필요)
  
  const loadData = useCallback((key: string, userId: string) => {
    const storageKey = getStorageKey(userId);
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const decrypted = CryptoService.decrypt(saved, key);
      if (!decrypted) {
        alert("보안 키가 일치하지 않습니다.");
        return;
      }
      setState(decrypted);
    }
    const authKey = getAuthKey(userId);
    sessionStorage.setItem(authKey, key);
    setIsAuthenticated(true);
  }, []);

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
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
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
        
        // 사용자 이름 가져오기 (닉네임 우선)
        if (session.user) {
          const name = session.user.user_metadata?.nickname
            || session.user.user_metadata?.full_name 
            || session.user.user_metadata?.name 
            || session.user.email?.split('@')[0] 
            || '사용자';
          setUserName(name);
        }
        
        // 가족 공유 마스터 키 확인 및 데이터 로드
        // 모든 가족 구성원이 동일한 키를 사용하여 데이터 공유 가능
        // 재로그인 시에도 항상 가족 공유 키 사용 (기존 sessionStorage 키 무시)
        const authKey = getAuthKey(currentUserId);
        // 항상 가족 공유 키 사용 (기존 sessionStorage 키는 무시하여 모든 사용자가 동일한 키 사용)
        const key = process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
        setMasterKey(key);
        sessionStorage.setItem(authKey, key); // 가족 공유 키로 덮어쓰기
        // 데이터 로드 (기존 키 또는 새로 생성한 고정 키 사용)
        loadData(key, currentUserId);
      } catch (err) {
        router.push('/');
      }
    };
    
    checkAuth();
  }, [isMounted, router, loadData]);

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
      let currentAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      // 주소 변환 (쓰로틀링: 최소 30초 간격)
      const now = Date.now();
      const lastGeocodeUpdate = sessionStorage.getItem('lastGeocodeUpdate');
      if (!lastGeocodeUpdate || now - parseInt(lastGeocodeUpdate) > 30000) {
        try {
          const geocoder = new (window as any).google.maps.Geocoder();
          const { results } = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
          if (results && results[0]) {
            currentAddress = results[0].formatted_address;
            sessionStorage.setItem('lastGeocodeUpdate', now.toString());
          }
        } catch (geocodeError) {
          console.warn('주소 변환 오류:', geocodeError);
        }
      } else {
        currentAddress = state.location.address || currentAddress;
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

      // Supabase에 위치 저장
      try {
        const { error } = await supabase
          .from('user_locations')
          .upsert({
            user_id: userId,
            latitude: latitude,
            longitude: longitude,
            address: currentAddress,
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

  // 4. Google Maps 지도 초기화 및 실시간 마커 업데이트 (승인된 사용자만 표시)
  useEffect(() => {
    const googleMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!googleMapApiKey || !state.location.latitude || !state.location.longitude) return;

    const initializeMap = () => {
      if (typeof window === 'undefined' || !(window as any).google) return;

      try {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;

        // 지도가 이미 초기화되어 있으면 업데이트만 수행
        if (!mapRef.current) {
          mapRef.current = new (window as any).google.maps.Map(mapElement, {
            center: { lat: state.location.latitude, lng: state.location.longitude },
            zoom: 15,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true
          });
          setMapLoaded(true);
        } else {
          // 지도 중심 업데이트
          mapRef.current.setCenter({ lat: state.location.latitude, lng: state.location.longitude });
        }

        // 기존 마커 모두 제거
        markersRef.current.forEach((marker) => {
          marker.setMap(null);
        });
        markersRef.current.clear();

        // 현재 위치 마커 (항상 표시)
        const myMarker = new (window as any).google.maps.Marker({
          position: { lat: state.location.latitude, lng: state.location.longitude },
          map: mapRef.current,
          title: '내 위치',
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          }
        });
        markersRef.current.set('my-location', myMarker);

        // 승인된 위치 요청이 있는 사용자들의 위치만 마커로 표시
        const acceptedRequests = locationRequests.filter(
          req => req.status === 'accepted' &&
          ((req.requester_id === userId && req.target_id !== userId) ||
           (req.target_id === userId && req.requester_id !== userId))
        );

        // 승인된 사용자들의 위치 마커 추가 (실시간 업데이트)
        state.familyLocations.forEach((loc) => {
          if (loc.latitude && loc.longitude && loc.userId !== userId) {
            // 해당 사용자와의 승인된 요청이 있는지 확인
            const hasAcceptedRequest = acceptedRequests.some(
              req => (req.requester_id === userId && req.target_id === loc.userId) ||
                     (req.requester_id === loc.userId && req.target_id === userId)
            );

            if (hasAcceptedRequest) {
              // 기존 마커가 있으면 위치만 업데이트, 없으면 새로 생성
              const existingMarker = markersRef.current.get(loc.userId);
              if (existingMarker) {
                existingMarker.setPosition({ lat: loc.latitude, lng: loc.longitude });
              } else {
                const marker = new (window as any).google.maps.Marker({
                  position: { lat: loc.latitude, lng: loc.longitude },
                  map: mapRef.current,
                  title: `${loc.userName}의 위치`,
                  icon: {
                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                  }
                });
                markersRef.current.set(loc.userId, marker);
              }
            }
          }
        });
      } catch (error) {
        console.error('지도 초기화 오류:', error);
      }
    };

    // Google Maps API 스크립트 로드
    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        console.warn('Google Maps API 로드 실패 - 지도 없이 좌표만 표시됩니다.');
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }
  }, [state.location.latitude, state.location.longitude, state.familyLocations, locationRequests, userId, mapLoaded]);

  // 5. Supabase 데이터 로드 및 Realtime 구독
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      console.log('Realtime 구독 스킵 - 인증되지 않음:', { isAuthenticated, userId });
      return;
    }
    
    console.log('✅ Realtime 구독 시작 - userId:', userId);

    let messagesSubscription: any = null;
    let tasksSubscription: any = null;
    let eventsSubscription: any = null;
    let photosSubscription: any = null;
    let presenceSubscription: any = null;

    // Supabase Realtime Presence로 현재 로그인 중인 사용자 추적
    presenceSubscription = supabase
      .channel('online_users')
      .on('presence', { event: 'sync' }, () => {
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
        
        // 다른 사용자들의 정보 추가
        Object.keys(state).forEach((presenceId) => {
          const presence = state[presenceId];
          if (Array.isArray(presence) && presence.length > 0) {
            const userPresence = presence[0];
            const uid = userPresence.userId;
            if (uid && uid !== userId) {
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
            const userPresence = presence[0];
            const uid = userPresence.userId;
            if (uid && uid !== userId) {
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
            const userPresence = presence[0];
            const uid = userPresence.userId;
            if (uid && uid !== userId) {
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
          // 현재 사용자의 presence 전송
          await presenceSubscription.track({
            userId: userId,
            userName: userName || '나',
            onlineAt: new Date().toISOString()
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('❌ Presence subscription 연결 실패:', status);
        }
      });

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
    } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('localStorage 사진 로드 실패:', e);
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

        // 할일 로드 (모든 가족 구성원이 같은 데이터를 공유)
        const { data: tasksData, error: tasksError } = await supabase
          .from('family_tasks')
          .select('*')
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

        // 일정 로드 (모든 가족 구성원이 같은 데이터를 공유)
        const { data: eventsData, error: eventsError } = await supabase
          .from('family_events')
          .select('*')
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

        // 사진 로드 (memory_vault에서 가족 전체의 최근 50개 - 가족 공유)
        // user_id 필터 없이 모든 가족 구성원의 사진 로드
        const { data: photosData, error: photosError } = await supabase
          .from('memory_vault')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('사진 로드 시도:', {
            userId: userId,
            photosDataCount: photosData?.length || 0,
            photosError: photosError ? photosError.message : null
          });
        }

        // Supabase 로드 에러 로깅
        if (photosError) {
          console.error('Supabase 사진 로드 오류:', photosError);
          if (process.env.NODE_ENV === 'development') {
            console.error('에러 상세:', {
              message: photosError.message,
              details: photosError.details,
              hint: photosError.hint,
              code: photosError.code
            });
          }
        }

        // Supabase 사진 로드 (성공/실패 관계없이 처리)
        const formattedPhotos: Photo[] = (!photosError && photosData) 
          ? photosData
              .filter((photo: any) => photo.cloudinary_url || photo.image_url || photo.s3_original_url)
              .map((photo: any) => ({
                id: photo.id,
                data: photo.cloudinary_url || photo.image_url || photo.s3_original_url || '', // Cloudinary URL 우선, 없으면 image_url, 마지막으로 S3 URL 사용
                originalSize: photo.original_file_size,
                originalFilename: photo.original_filename,
                mimeType: photo.mime_type,
                supabaseId: photo.id, // Supabase ID 설정 (재로그인 시 매칭용)
                isUploaded: true, // Supabase에서 로드한 사진은 업로드 완료된 사진
                created_by: photo.user_id || photo.created_by || undefined // 생성자 ID 저장
              }))
          : []; // Supabase 로드 실패 시 빈 배열
        
        // 디버깅 정보 추가
        if (process.env.NODE_ENV === 'development') {
          console.log('사진 로드 결과:', {
            photosError: photosError ? photosError.message : null,
            photosDataCount: photosData?.length || 0,
            formattedPhotosCount: formattedPhotos.length,
            localStoragePhotosCount: localStoragePhotos.length
          });
        }
        
        // Supabase 사진과 localStorage 사진 병합
        
        // 재로그인 시 Supabase 데이터를 우선하고, localStorage는 업로드 중인 사진만 유지
        setState(prev => {
          // Supabase에 있는 사진 ID 목록 (숫자 ID 또는 UUID)
          const supabasePhotoIds = new Set(formattedPhotos.map(p => String(p.id)));
          
          // localStorage에만 있는 사진 (Base64 데이터, 업로드 중인 사진만)
          const localStorageOnlyPhotos = localStoragePhotos.filter(p => {
            const photoId = String(p.id);
            const supabaseId = p.supabaseId ? String(p.supabaseId) : null;
            
            // Supabase ID가 있고 Supabase에 이미 있는 사진이면 제외
            if (supabaseId && supabasePhotoIds.has(supabaseId)) {
              return false;
            }
            
            // 업로드 완료된 사진(URL)은 제외 (Supabase에서 로드해야 함)
            if (p.isUploaded && p.data && (p.data.startsWith('http://') || p.data.startsWith('https://'))) {
              return false;
            }
            
            // 업로드 중이거나 Base64/Blob 데이터만 유지
            return p.isUploading || (p.data && (p.data.startsWith('data:') || p.data.startsWith('blob:')));
          });
          
          // Supabase 사진과 localStorage 전용 사진 병합 (Supabase 우선)
          const mergedAlbum = [...formattedPhotos, ...localStorageOnlyPhotos];
          
          // 디버깅: 병합 결과 확인
          if (process.env.NODE_ENV === 'development') {
            console.log('사진 병합 결과:', {
              formattedPhotosCount: formattedPhotos.length,
              localStorageOnlyPhotosCount: localStorageOnlyPhotos.length,
              mergedAlbumCount: mergedAlbum.length,
              supabasePhotoIds: Array.from(supabasePhotoIds)
            });
          }
          
          // 중복 제거: 같은 ID를 가진 사진 제거
          const uniqueAlbum = mergedAlbum.reduce((acc, photo) => {
            const photoId = String(photo.id);
            const supabaseId = photo.supabaseId ? String(photo.supabaseId) : null;
            
            // 이미 같은 ID의 사진이 있는지 확인
            const exists = acc.some(p => {
              const pId = String(p.id);
              const pSupabaseId = p.supabaseId ? String(p.supabaseId) : null;
              return pId === photoId || pSupabaseId === photoId || 
                     (supabaseId && pSupabaseId === supabaseId) ||
                     (photoId === pSupabaseId) || (pId === supabaseId);
            });
            
            if (!exists) {
              acc.push(photo);
            }
            
            return acc;
          }, [] as Photo[]);
          
          // Supabase 사진이 있으면 우선 사용
          if (formattedPhotos.length > 0) {
            return {
              ...prev,
              album: uniqueAlbum
            };
          }
          
          // Supabase 로드 실패 시 localStorage 사진도 포함 (오프라인 지원)
          if (localStoragePhotos.length > 0) {
            if (process.env.NODE_ENV === 'development') {
              console.log('Supabase 로드 실패, localStorage 사진 표시:', localStoragePhotos.length);
            }
            return {
              ...prev,
              album: localStoragePhotos
            };
          }
          
          // 사진이 없으면 빈 배열 반환
          return {
            ...prev,
            album: []
          };
        });
      } catch (error) {
        console.error('Supabase 데이터 로드 오류:', error);
        // 에러 발생 시에도 localStorage 사진 유지
        try {
          const authKey = getAuthKey(userId);
          const errorCurrentKey = masterKey || sessionStorage.getItem(authKey) || 
            process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
          const storageKey = getStorageKey(userId);
          const saved = localStorage.getItem(storageKey);
          let errorLocalStoragePhotos: Photo[] = [];
          if (saved && errorCurrentKey) {
            try {
              const decrypted = CryptoService.decrypt(saved, errorCurrentKey);
              if (decrypted && decrypted.album && Array.isArray(decrypted.album)) {
                errorLocalStoragePhotos = decrypted.album;
              }
            } catch (e) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('에러 처리 중 localStorage 사진 로드 실패:', e);
              }
            }
          }
          
          if (errorLocalStoragePhotos.length > 0) {
            setState(prev => ({
              ...prev,
              album: errorLocalStoragePhotos
            }));
          }
        } catch (fallbackError) {
          console.error('에러 처리 중 오류:', fallbackError);
        }
      }
    };

    // Realtime 구독 설정 (암호화된 데이터 복호화)
    // 가족 공유 키를 사용하여 모든 사용자의 데이터 복호화 가능
    const setupRealtimeSubscriptions = () => {
      // 최신 키를 항상 가져오는 헬퍼 함수 (클로저 문제 해결)
      const getCurrentKey = () => {
        const authKey = getAuthKey(userId);
        return masterKey || sessionStorage.getItem(authKey) || 
          process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
      };
      
      const authKey = getAuthKey(userId);
      const currentKey = getCurrentKey();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('setupRealtimeSubscriptions - userId:', userId);
        console.log('setupRealtimeSubscriptions - masterKey from state:', masterKey);
        console.log('setupRealtimeSubscriptions - currentKey from sessionStorage:', sessionStorage.getItem(authKey));
        console.log('setupRealtimeSubscriptions - final currentKey:', currentKey ? '있음' : '없음');
      }
      
      // 메시지 구독
      messagesSubscription = supabase
        .channel('family_messages_changes')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'family_messages' },
          (payload: any) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('Realtime 메시지 INSERT 이벤트 수신:', payload);
            }
            const newMessage = payload.new;
            const createdAt = new Date(newMessage.created_at);
            const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            
            // 암호화된 메시지 복호화
            let decryptedText = newMessage.message_text || '';
            const messageKey = getCurrentKey();
            if (messageKey && newMessage.message_text) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = newMessage.message_text.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(newMessage.message_text, messageKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    decryptedText = newMessage.message_text;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = newMessage.message_text;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = newMessage.message_text;
              }
            } else {
              decryptedText = newMessage.message_text;
            }
            
            setState(prev => {
              // 중복 체크 1: 같은 ID를 가진 메시지가 이미 있는지 확인
              const existingMessageById = prev.messages?.find(m => String(m.id) === String(newMessage.id));
              if (existingMessageById) {
                if (process.env.NODE_ENV === 'development') {
                  console.log('중복 메시지 감지 (ID 기반), 추가하지 않음:', { id: newMessage.id, text: decryptedText.substring(0, 20) });
                }
                return prev; // 중복이면 상태 변경하지 않음
              }
              
              // 중복 체크 2: 자신이 입력한 데이터가 Realtime으로 다시 들어오는 경우 방지
              // sender_id가 현재 사용자이면, 임시 ID 항목을 찾아서 교체
              if (newMessage.sender_id === userId) {
                // 먼저 임시 ID 항목을 찾아서 교체 시도
                const recentDuplicate = prev.messages?.find(m => {
                  // 임시 ID (숫자)를 가진 항목만 체크
                  const isTempId = typeof m.id === 'number';
                  return isTempId && 
                         m.text === decryptedText && 
                         m.time === timeStr;
                });
                
                if (recentDuplicate) {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('중복 메시지 감지 (자신이 입력한 항목), 임시 항목을 Supabase ID로 교체:', { 
                      tempId: recentDuplicate.id, 
                      newId: newMessage.id, 
                      text: decryptedText.substring(0, 20) 
                    });
                  }
                  
                  // 임시 항목을 Supabase ID로 교체
                  return {
                    ...prev,
                    messages: prev.messages.map(m => 
                      m.id === recentDuplicate.id 
                        ? {
                            id: newMessage.id,
                            user: m.user, // 기존 user 유지
                            text: decryptedText,
                            time: timeStr
                          }
                        : m
                    )
                  };
                }
              }
              
              // 다른 사용자가 입력한 항목이거나, 자신이 입력한 항목이지만 임시 항목이 없는 경우 추가
              return {
                ...prev,
                messages: [...(prev.messages || []), {
                  id: newMessage.id, // 메시지 ID 저장 (DELETE를 위해 필요)
                  user: '사용자', // sender_name 컬럼이 없으므로 기본값 사용 (실제로는 sender_id로 조인 필요)
                  text: decryptedText,
                  time: timeStr
                }].slice(-50)
              };
            });
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'family_messages' },
          (payload: any) => {
            const updatedMessage = payload.new;
            const createdAt = new Date(updatedMessage.created_at);
            const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            
            // 암호화된 메시지 복호화 (암호화된 형식인 경우에만)
            let decryptedText = updatedMessage.message_text || '';
            if (currentKey && updatedMessage.message_text) {
              // 암호화된 형식인지 확인 (U2FsdGVkX1로 시작하는지)
              const isEncrypted = updatedMessage.message_text.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decrypted = CryptoService.decrypt(updatedMessage.message_text, currentKey);
                  if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                    decryptedText = decrypted;
                  } else {
                    decryptedText = updatedMessage.message_text;
                  }
                } catch (e: any) {
                  // 복호화 오류 - 원본 텍스트 사용 (조용히 처리)
                  decryptedText = updatedMessage.message_text;
                }
              } else {
                // 이미 평문이면 그대로 사용
                decryptedText = updatedMessage.message_text;
              }
            }
            
            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m => 
                // 메시지 ID로 매칭 (created_at 기반으로도 시도)
                m.time === timeStr && m.text === decryptedText ? {
                  ...m,
                  text: decryptedText
                } : m
              )
            }));
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'family_messages' },
          (payload: any) => {
            const deletedId = payload.old?.id;
            if (!deletedId) {
              return;
            }
            setState(prev => ({
              ...prev,
              messages: prev.messages.filter(m => String(m.id) !== String(deletedId))
            }));
          }
        )
        .subscribe((status, err) => {
          console.log('📨 Realtime 메시지 subscription 상태:', status);
          if (err) console.error('❌ Realtime 메시지 subscription 오류:', err);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 메시지 subscription 연결 성공');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error('❌ Realtime 메시지 subscription 연결 실패:', status);
          }
        });
      
      console.log('📋 할일 subscription 설정 중...');
      // 할일 구독
      tasksSubscription = supabase
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
            
            // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
            // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
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
          if (err) console.error('❌ Realtime 할일 subscription 오류:', err);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 할일 subscription 연결 성공');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error('❌ Realtime 할일 subscription 연결 실패:', status);
          }
        });
      
      console.log('📅 일정 subscription 설정 중...');
      // 일정 구독
      eventsSubscription = supabase
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
            
            // family_id 검증 제거 (기존 데이터와의 호환성을 위해)
            // 모든 가족 구성원이 같은 데이터를 공유하므로 family_id 검증 불필요
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
          if (err) console.error('❌ Realtime 일정 subscription 오류:', err);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 일정 subscription 연결 성공');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error('❌ Realtime 일정 subscription 연결 실패:', status);
          }
        });
      
      console.log('📸 사진 subscription 설정 중...');
      // 사진 구독 (memory_vault)
      photosSubscription = supabase
        .channel('memory_vault_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'memory_vault' },
          (payload: any) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('Realtime 사진 INSERT 이벤트 수신:', payload);
            }
            const newPhoto = payload.new;
            if (newPhoto.cloudinary_url || newPhoto.image_url || newPhoto.s3_original_url) {
              setState(prev => {
                // 이미 같은 ID의 사진이 있는지 확인 (중복 방지)
                const existingPhoto = prev.album.find(p => {
                  const photoId = String(p.id);
                  const supabaseId = p.supabaseId ? String(p.supabaseId) : null;
                  const newPhotoId = String(newPhoto.id);
                  return photoId === newPhotoId || supabaseId === newPhotoId;
                });
                
                if (existingPhoto) {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('중복 사진 감지, 추가하지 않음:', { id: newPhoto.id, supabaseId: newPhoto.id });
                  }
                  return prev; // 이미 있으면 업데이트하지 않음
                }
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('새 사진 추가:', { id: newPhoto.id, url: (newPhoto.cloudinary_url || newPhoto.image_url || newPhoto.s3_original_url || '').substring(0, 50) });
                }
                
                return {
                  ...prev,
                  album: [{
                    id: newPhoto.id,
                    data: newPhoto.cloudinary_url || newPhoto.image_url || newPhoto.s3_original_url || '',
                    originalSize: newPhoto.original_file_size,
                    originalFilename: newPhoto.original_filename,
                    mimeType: newPhoto.mime_type,
                    supabaseId: newPhoto.id,
                    isUploaded: true,
                    created_by: newPhoto.user_id || newPhoto.created_by || undefined
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
            if (updatedPhoto.cloudinary_url || updatedPhoto.image_url || updatedPhoto.s3_original_url) {
              setState(prev => ({
                ...prev,
                album: prev.album.map(p => 
                  (p.id === updatedPhoto.id || p.supabaseId === updatedPhoto.id)
                    ? {
                        ...p,
                        id: updatedPhoto.id,
                        data: updatedPhoto.cloudinary_url || updatedPhoto.image_url || updatedPhoto.s3_original_url || '',
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
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 사진 subscription 연결 성공');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error('❌ Realtime 사진 subscription 연결 실패:', status);
          }
        });
      
      console.log('📍 위치 subscription 설정 중...');
      // 위치 구독 (user_locations)
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
          (payload: any) => {
            console.log('Realtime 위치 UPDATE 이벤트 수신:', payload);
            loadFamilyLocations(); // 위치 목록 다시 로드
          }
        )
        .subscribe((status, err) => {
          console.log('📍 Realtime 위치 subscription 상태:', status);
          if (err) console.error('❌ Realtime 위치 subscription 오류:', err);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 위치 subscription 연결 성공');
          }
        });

      console.log('📍 위치 요청 subscription 설정 중...');
      // 위치 요청 구독 (location_requests)
      const locationRequestsSubscription = supabase
        .channel('location_requests_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'location_requests' },
          (payload: any) => {
            console.log('Realtime 위치 요청 INSERT 이벤트 수신:', payload);
            loadLocationRequests(); // 위치 요청 목록 다시 로드
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'location_requests' },
          (payload: any) => {
            console.log('Realtime 위치 요청 UPDATE 이벤트 수신:', payload);
            loadLocationRequests(); // 위치 요청 목록 다시 로드
            loadFamilyLocations(); // 승인 시 위치 목록도 다시 로드
            // 지도 마커 업데이트를 위해 상태 변경 트리거
            setState(prev => ({ ...prev }));
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'location_requests' },
          (payload: any) => {
            console.log('Realtime 위치 요청 DELETE 이벤트 수신:', payload);
            loadLocationRequests(); // 위치 요청 목록 다시 로드
            loadFamilyLocations(); // 위치 목록도 다시 로드
          }
        )
        .subscribe((status, err) => {
          console.log('📍 Realtime 위치 요청 subscription 상태:', status);
          if (err) console.error('❌ Realtime 위치 요청 subscription 오류:', err);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 위치 요청 subscription 연결 성공');
          }
        });
      
      console.log('✅ 모든 Realtime subscription 설정 완료');
    };

    // Supabase 데이터 로드 및 Realtime 구독 설정
    console.log('🔄 Supabase 데이터 로드 시작...');
    // 재로그인 시에도 항상 Supabase에서 데이터 로드
    const timer = setTimeout(() => {
      loadSupabaseData().then(() => {
        console.log('✅ Supabase 데이터 로드 완료, Realtime 구독 시작');
        setupRealtimeSubscriptions();
        // 위치 데이터 로드
        loadFamilyLocations();
        loadLocationRequests(); // 위치 요청 목록 로드
      }).catch((error) => {
        console.error('❌ Supabase 데이터 로드 실패:', error);
        // 데이터 로드 실패해도 Realtime 구독은 설정
        setupRealtimeSubscriptions();
        // 위치 데이터 로드 시도
        loadFamilyLocations();
      });
    }, 100); // 짧은 지연으로 빠른 로드
    
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
          
          if (!hasSubscriptions && isAuthenticated && userId) {
            console.log('🔄 Realtime 연결 끊김 감지, 재연결 시도...');
            setupRealtimeSubscriptions();
          } else if (hasSubscriptions) {
            console.log('✅ Realtime 연결 상태 정상');
          }
        };
        
        // 짧은 지연 후 확인 (연결 상태 업데이트 시간 고려)
        setTimeout(checkAndReconnect, 1000);
      }
    };
    
    // 네트워크 재연결 시 Realtime 재연결
    const handleOnline = () => {
      console.log('🌐 네트워크 연결 복구, Realtime 재연결 확인...');
      if (isAuthenticated && userId) {
        setTimeout(() => {
          setupRealtimeSubscriptions();
        }, 1000);
      }
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
      if (messagesSubscription) {
        supabase.removeChannel(messagesSubscription);
        subscriptionsRef.current.messages = null;
      }
      if (tasksSubscription) {
        supabase.removeChannel(tasksSubscription);
        subscriptionsRef.current.tasks = null;
      }
      if (eventsSubscription) {
        supabase.removeChannel(eventsSubscription);
        subscriptionsRef.current.events = null;
      }
      if (photosSubscription) {
        supabase.removeChannel(photosSubscription);
        subscriptionsRef.current.photos = null;
      }
      if (presenceSubscription) {
        supabase.removeChannel(presenceSubscription);
      }
    };
  }, [isAuthenticated, userId, masterKey, userName, familyId]); // familyId 변경 시 데이터 재로드

  // 6. 위치 요청 만료 체크 (1분마다 실행)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const checkExpiredRequests = () => {
      const now = new Date();
      locationRequests.forEach((req: any) => {
        // expires_at이 있는 경우에만 만료 체크
        if (req.expires_at) {
          const expiresAt = new Date(req.expires_at);
          // 만료된 accepted 요청은 자동으로 종료
          if (expiresAt < now && req.status === 'accepted') {
            endLocationSharing(req.id).catch(() => {});
          }
        }
      });
      // 위치 요청 목록 다시 로드하여 만료된 항목 제거
      loadLocationRequests();
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
      const { data: { session } } = await supabase.auth.getSession();
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
          
          // 실제 테이블 구조에 맞게 title 컬럼 사용 (task_text가 없음)
          // assigned_to는 UUID 타입이므로 NULL로 저장 (담당자 정보는 title에 포함하거나 별도 처리)
          const taskData: any = {
            // family_id는 선택적 (데이터베이스에 컬럼이 있는 경우에만 추가)
            // family_id: currentFamilyId, // 주석 처리: 기존 데이터와의 호환성을 위해
            created_by: userId,
            title: encryptedText, // 암호화된 텍스트 저장 (task_text 대신 title 사용)
            assigned_to: null, // UUID 타입이므로 NULL로 저장 (담당자 정보는 암호화된 텍스트에 포함)
            is_completed: payload.done || false // is_completed 컬럼 사용
          };
          
          console.log('ADD_TODO: family_tasks 테이블에 저장:', { text: payload.text.substring(0, 20), assignee: payload.assignee });
          
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
          
          // is_completed 컬럼 사용 (실제 테이블 구조에 맞게)
          const updateData: any = {};
          updateData.is_completed = payload.done; // is_completed 컬럼 사용
          
          const { error } = await supabase
            .from('family_tasks')
            .update(updateData)
            .eq('id', payload.id);
          
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
          
          // 삭제 전에 해당 할일이 존재하는지 확인
          const { data: existingTask } = await supabase
            .from('family_tasks')
            .select('id, created_by, title')
            .eq('id', taskId)
            .single();
          
          if (existingTask) {
            console.log('삭제할 할일 확인:', {
              id: existingTask.id,
              created_by: existingTask.created_by,
              title: existingTask.title?.substring(0, 30)
            });
          }
          
          const { error, data } = await supabase
            .from('family_tasks')
            .delete()
            .eq('id', taskId)
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
          
          // event_date 컬럼이 없을 수 있으므로 선택적으로 처리
          const eventData: any = {
            // family_id는 선택적 (데이터베이스에 컬럼이 있는 경우에만 추가)
            // family_id: currentFamilyId, // 주석 처리: 기존 데이터와의 호환성을 위해
            created_by: userId,
            title: encryptedTitle, // 암호화된 제목 저장 (event_title 대신 title 사용)
            description: encryptedDesc, // 암호화된 설명 저장
            // event_date, date, event_date_time 등 여러 가능한 컬럼명 지원
            event_date: eventDate.toISOString()
            // created_at은 자동 생성되므로 제거
          };
          
          console.log('ADD_EVENT: family_events 테이블에 저장:', { title: payload.title.substring(0, 20), month: payload.month, day: payload.day });
          
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
          
          // 삭제 전에 해당 이벤트가 존재하는지 확인 (디버깅용)
          const { data: existingEvent } = await supabase
            .from('family_events')
            .select('id, created_by, title')
            .eq('id', eventId)
            .single();
          
          if (existingEvent) {
            console.log('삭제할 이벤트 확인:', {
              id: existingEvent.id,
              created_by: existingEvent.created_by,
              title: existingEvent.title?.substring(0, 30)
            });
          } else {
            console.warn('⚠️ 삭제할 이벤트를 찾을 수 없음:', eventId);
          }
          
          const { error, data } = await supabase
            .from('family_events')
            .delete()
            .eq('id', eventId)
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
          // Supabase에서도 삭제
          (async () => {
            try {
              const { error } = await supabase
                .from('memory_vault')
                .delete()
                .eq('id', payload);
              if (error) {
                console.error('사진 삭제 오류:', error);
              }
            } catch (error) {
              console.error('사진 삭제 오류:', error);
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
      }

      persist(newState, currentKey, userId);
      return newState;
    });
  };


  const handleRename = () => {
    const n = prompt("가족 이름:", state.familyName);
    if (n?.trim()) {
      const sanitized = sanitizeInput(n, 50);
      if (sanitized) updateState('RENAME', sanitized);
    }
  };

  // 좌표를 주소로 변환 (Reverse Geocoding)
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
          return data.results[0].formatted_address;
        }
      }
    } catch (error) {
      console.warn('주소 변환 실패:', error);
    }
    
    // 주소 변환 실패 시 좌표 반환
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  };

  // 위치를 Supabase에 저장 (쓰로틀링 적용: 최소 5초 간격)
  const saveLocationToSupabase = async (latitude: number, longitude: number, address: string) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastLocationUpdateRef.current;
    
    // 최소 5초 간격으로만 저장 (성능 최적화)
    if (timeSinceLastUpdate < 5000) {
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
      const address = await reverseGeocode(latitude, longitude);

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

            // 주소 변환 (쓰로틀링: 30초마다 한 번만)
            const now = Date.now();
            let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            
            if (now - lastLocationUpdateRef.current > 30000) {
              try {
                address = await reverseGeocode(latitude, longitude);
              } catch (geocodeError) {
                console.warn('주소 변환 실패, 좌표 사용:', geocodeError);
              }
            } else {
              // 주소 변환을 건너뛰면 기존 주소 유지
              address = state.location.address || address;
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

            // 가족 구성원 위치 목록 업데이트 (30초마다)
            if (now - lastLocationUpdateRef.current > 30000) {
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

  // 가족 구성원 위치 로드 (승인된 관계만 표시)
  const loadFamilyLocations = async () => {
    if (!userId || !isAuthenticated) return;

    try {
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
        // 본인 위치와 승인된 사용자 위치만 표시
        const locations = data
          .filter((loc: any) => {
            // 본인 위치는 항상 표시
            if (loc.user_id === userId) return true;
            // 다른 사용자 위치는 승인된 요청이 있는 경우만 표시
            return locationRequests.some(
              req => 
                (req.requester_id === userId && req.target_id === loc.user_id && req.status === 'accepted') ||
                (req.requester_id === loc.user_id && req.target_id === userId && req.status === 'accepted')
            );
          })
          .map((loc: any) => {
            const onlineUser = onlineUsers.find(u => u.id === loc.user_id);
            const userName = onlineUser?.name || `사용자 ${loc.user_id.substring(0, 8)}`;
            
            return {
              userId: loc.user_id,
              userName: userName,
              address: loc.address || `${loc.latitude}, ${loc.longitude}`,
              latitude: loc.latitude,
              longitude: loc.longitude,
              updatedAt: loc.last_updated
            };
          });

        setState(prev => ({
          ...prev,
          familyLocations: locations
        }));
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('위치 로드 시도 중 오류:', error);
      }
    }
  };

  // 위치 요청 목록 로드 (만료된 요청 자동 정리)
  const loadLocationRequests = async () => {
    if (!userId || !isAuthenticated) return;

    try {
      const response = await fetch(`/api/location-request?userId=${userId}&type=all`);
      const result = await response.json();

      if (result.success && result.data) {
        const now = new Date();
        // 만료된 요청 필터링 및 자동 종료
        const validRequests = result.data.filter((req: any) => {
          if (!req.expires_at) return true;
          const expiresAt = new Date(req.expires_at);
          if (expiresAt < now && req.status === 'accepted') {
            // 만료된 accepted 요청은 자동으로 cancelled로 변경
            handleLocationRequestAction(req.id, 'cancel').catch(() => {});
            return false;
          }
          return true;
        });
        setLocationRequests(validRequests);
      }
    } catch (error) {
      console.error('위치 요청 목록 로드 오류:', error);
    }
  };

  // 위치 공유 종료 (accepted 요청 취소)
  const endLocationSharing = async (requestId: string) => {
    if (!userId || !isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!confirm('위치 공유를 종료하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch('/api/location-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          userId,
          action: 'cancel',
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('위치 공유가 종료되었습니다.');
        await loadLocationRequests();
        await loadFamilyLocations();
      } else {
        alert(result.error || '위치 공유 종료에 실패했습니다.');
      }
    } catch (error) {
      console.error('위치 공유 종료 오류:', error);
      alert('위치 공유 종료 중 오류가 발생했습니다.');
    }
  };

  // 위치 요청 보내기
  const sendLocationRequest = async (targetUserId: string) => {
    if (!userId || !isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await fetch('/api/location-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requesterId: userId,
          targetId: targetUserId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('위치 요청을 보냈습니다.');
        await loadLocationRequests();
        setShowLocationRequestModal(false);
        setSelectedUserForRequest(null);
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

    try {
      const response = await fetch('/api/location-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          userId,
          action,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (action === 'accept') {
          alert('위치 공유가 승인되었습니다.');
        } else if (action === 'reject') {
          alert('위치 요청을 거부했습니다.');
        } else {
          alert('위치 요청을 취소했습니다.');
        }
        await loadLocationRequests();
        await loadFamilyLocations(); // 승인된 위치 다시 로드
      } else {
        alert(result.error || '요청 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('위치 요청 처리 오류:', error);
      alert('요청 처리 중 오류가 발생했습니다.');
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
            await fetch(`/api/push/register-token?userId=${userId}&token=${encodeURIComponent(token)}`, {
              method: 'DELETE'
            }).catch(err => console.warn('Push 토큰 삭제 실패:', err));
          }
        } catch (error) {
          console.warn('Push 토큰 삭제 중 오류:', error);
        }
      }
      
      // 백그라운드 위치 추적 중지
      stopBackgroundLocationTracking();
      try {
        // Realtime subscription 정리 (컴포넌트 외부 변수 사용)
        if (messagesSubscription) {
          await supabase.removeChannel(messagesSubscription);
          messagesSubscription = null;
        }
        if (tasksSubscription) {
          await supabase.removeChannel(tasksSubscription);
          tasksSubscription = null;
        }
        if (eventsSubscription) {
          await supabase.removeChannel(eventsSubscription);
          eventsSubscription = null;
        }
        if (photosSubscription) {
          await supabase.removeChannel(photosSubscription);
          photosSubscription = null;
        }
        if (presenceSubscription) {
          await supabase.removeChannel(presenceSubscription);
          presenceSubscription = null;
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }

      // Supabase user_metadata 업데이트
      const { error } = await supabase.auth.updateUser({
        data: { nickname: sanitizedNickname }
      });

      if (error) throw error;

      // 로컬 상태 업데이트
      setUserName(sanitizedNickname);
      setIsNicknameModalOpen(false);
      if (nicknameInputRef.current) {
        nicknameInputRef.current.value = "";
      }
    } catch (error: any) {
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
        const img = new Image();
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

    // 용량 제한 제거: 모든 파일 크기 허용 (RAW 파일 포함)
    // localStorage에는 표시용 리사이징된 이미지만 저장하고, 원본은 S3에 직접 업로드하므로 용량 제한 불필요

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

      // RAW 파일은 브라우저에서 리사이징 불가능하므로 원본 그대로 사용
      if (isRawFile) {
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
      const originalDataForUpload = originalData; // 업로드용 원본 데이터 보관
      
      updateState('ADD_PHOTO', { 
        id: photoId, 
        data: imageData, // 표시용 리사이징된 이미지 (localStorage에 저장)
        // originalData는 localStorage에 저장하지 않음 (공간 절약)
        originalSize: file.size, // 원본 파일 크기
        originalFilename: file.name, // 원본 파일명
        mimeType: file.type, // MIME 타입
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
        const { data: { session } } = await supabase.auth.getSession();
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

        // 파일 크기 기준으로 업로드 방식 결정 (5MB)
        // RAW 파일은 리사이징 불가능하므로 무조건 Presigned URL 방식 사용
        const PRESIGNED_URL_THRESHOLD = 5 * 1024 * 1024; // 5MB
        const usePresignedUrl = isRawFile || file.size >= PRESIGNED_URL_THRESHOLD;

        if (process.env.NODE_ENV === 'development') {
          console.log('Cloudinary & S3 업로드 시작...', {
            method: usePresignedUrl ? 'Presigned URL (직접 업로드)' : '서버 경유',
            fileSize: Math.round(file.size / 1024) + 'KB',
          });
        }

        if (usePresignedUrl) {
          // Presigned URL 방식 (큰 파일)
          try {
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
                  fileName: file.name,
                  mimeType: file.type,
                  fileSize: file.size,
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

            const urlResult = await urlResponse.json();

            if (!urlResponse.ok) {
              console.error('Presigned URL 생성 실패:', {
                status: urlResponse.status,
                error: urlResult.error
              });
              throw new Error(urlResult.error || 'Presigned URL 생성 실패');
            }

            if (!urlResult.presignedUrl) {
              console.error('Presigned URL이 응답에 없음:', urlResult);
              throw new Error('Presigned URL이 응답에 포함되지 않았습니다.');
            }

            const { presignedUrl, s3Key, s3Url } = urlResult;

            // 2. 클라이언트에서 직접 S3에 원본 파일 업로드
            // 타임아웃 설정 (30초)
            const uploadController = new AbortController();
            const uploadTimeout = setTimeout(() => uploadController.abort(), 30000);
            
            try {
              const s3UploadResponse = await fetch(presignedUrl, {
                method: 'PUT',
                body: file, // 원본 파일 그대로 (Base64 변환 불필요)
                headers: {
                  'Content-Type': file.type,
                },
                signal: uploadController.signal,
              });

              clearTimeout(uploadTimeout);

              if (!s3UploadResponse.ok) {
                const errorText = await s3UploadResponse.text();
                console.error('S3 업로드 실패:', {
                  status: s3UploadResponse.status,
                  statusText: s3UploadResponse.statusText,
                  error: errorText.substring(0, 200)
                });
                
                // CORS 오류 확인
                if (s3UploadResponse.status === 0 || errorText.includes('CORS')) {
                  console.error('CORS 오류로 의심됨');
                  throw new Error('CORS 오류: S3 버킷 CORS 설정이 필요합니다.');
                }
                
                throw new Error(`S3 업로드 실패: ${s3UploadResponse.status} ${s3UploadResponse.statusText}`);
              }
            } catch (uploadError: any) {
              clearTimeout(uploadTimeout);
              
              // CORS 오류 감지
              const isCorsError = 
                uploadError.message?.includes('CORS') ||
                uploadError.message?.includes('Failed to fetch') ||
                uploadError.name === 'TypeError' ||
                uploadError.message?.includes('NetworkError') ||
                uploadError.message?.includes('blocked by CORS policy');
              
              if (uploadError.name === 'AbortError') {
                throw new Error('S3 업로드 타임아웃 (30초 초과)');
              }
              
              // CORS 오류 발생 시 서버 경유 방식으로 자동 폴백
              if (isCorsError) {
                console.warn('CORS 오류 감지, 서버 경유 방식으로 자동 재시도:', uploadError.message);
                
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
                      fileName: file.name,
                      mimeType: file.type,
                      originalSize: file.size,
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
          // 타임아웃 설정 (60초)
          const completeController = new AbortController();
          const completeTimeout = setTimeout(() => completeController.abort(), 60000);
          
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
                fileName: file.name,
                mimeType: file.type,
                originalSize: file.size,
                resizedData: imageData !== originalData ? imageData : null, // 리사이징된 이미지 (Cloudinary용)
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
                  fileName: file.name,
                  mimeType: file.type,
                  originalSize: file.size,
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
                alert('업로드 완료: Presigned URL 생성 실패로 서버 경유 방식으로 업로드되었습니다.');
              }
              
              return; // 성공적으로 폴백 완료
            } catch (fallbackError: any) {
              // 폴백도 실패한 경우 원래 에러를 throw하여 최종 catch 블록에서 처리
              throw new Error(`Presigned URL 생성 실패 후 서버 경유 재시도도 실패: ${fallbackError.message || '알 수 없는 오류'}`);
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
                fileName: file.name,
                mimeType: file.type,
                originalSize: file.size,
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
        
        // 사용자에게 에러 알림
        const errorMessage = uploadError.message || '업로드 중 오류가 발생했습니다.';
        if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
          alert('업로드 실패: S3 버킷 CORS 설정이 필요합니다. 관리자에게 문의하세요.\n\n로컬 저장은 완료되었습니다.');
        } else if (errorMessage.includes('타임아웃')) {
          alert('업로드 타임아웃: 파일이 너무 크거나 네트워크 연결이 불안정합니다.\n\n로컬 저장은 완료되었습니다.');
        } else {
          alert(`업로드 실패: ${errorMessage}\n\n로컬 저장은 완료되었습니다.`);
        }
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

  return (
    <div className="app-container">

      {/* Todo Modal */}
      {isTodoModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTodoModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <span className="modal-icon">📝</span>
              새 할 일 등록
          </h3>
            <div className="modal-form">
              <div className="form-field">
                <label className="form-label">무엇을 할까요?</label>
              <input 
                ref={todoTextRef}
                type="text" 
                  className="form-input" 
                placeholder="할 일 내용 입력"
              />
            </div>
              <div className="form-field">
                <label className="form-label">누가 할까요?</label>
              <input 
                ref={todoWhoRef}
                type="text" 
                  className="form-input" 
                placeholder="이름 입력 (비워두면 누구나)"
              />
            </div>
          </div>
            <div className="modal-actions">
              <button 
                onClick={() => setIsTodoModalOpen(false)} 
                className="btn-secondary"
              >
                취소
              </button>
            <button 
              onClick={submitNewTodo} 
                className="btn-primary"
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

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="title-container">
            <h1 
              onClick={handleRename}
              className="app-title"
            >
              {state.familyName || 'Ellena Family Hub'}
            </h1>
          </div>
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
            <div className="photo-grid">
              {state.album && state.album.length > 0 ? (
                state.album.map((p, index) => (
                  <div 
                    key={p.id} 
                    className="photo-item" 
                    style={{ position: 'relative' }}
                    onClick={() => setSelectedPhotoIndex(index)}
                  >
                    <img src={p.data} className="photo-image" alt="memory" />
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
                        borderRadius: '8px',
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
                    {p.created_by === userId && (
                      <button 
                        onClick={() => confirm("사진을 삭제하시겠습니까?") && updateState('DELETE_PHOTO', p.id)} 
                        className="btn-delete-photo"
                      >
                        <svg className="icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="photo-empty">
                  사진을 업로드해보세요.
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

          {/* Family Tasks Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 className="section-title">Family Tasks</h3>
            <button 
              onClick={() => setIsTodoModalOpen(true)} 
                className="btn-add"
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
                            <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
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
                          className="btn-delete"
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
                <p className="empty-state">할 일을 모두 완료했습니다!</p>
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

          {/* Location Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 className="section-title">실시간 위치 공유</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowLocationRequestModal(true)}
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
                <button
                  onClick={updateLocation}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isLocationSharing ? '#ef4444' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isLocationSharing ? (
                    <>
                      <span>⏹️</span>
                      <span>위치 추적 중지</span>
                    </>
                  ) : (
                    <>
                      <span>📍</span>
                      <span>위치 공유 시작</span>
                    </>
                  )}
                </button>
        </div>
            </div>
            <div className="section-body">
              {state.location.latitude && state.location.longitude ? (
                <div>
                  <p className="location-text" style={{ marginBottom: '12px' }}>
                    내 위치: {state.location.address}
                  </p>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                    좌표: {state.location.latitude.toFixed(6)}, {state.location.longitude.toFixed(6)}
                  </p>
                  {process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY ? (
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
                        <p style={{ fontSize: '12px', marginTop: '8px' }}>
                          또는 <a href={`https://www.google.com/maps?q=${state.location.latitude},${state.location.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Google 지도에서 보기</a>
                        </p>
          </div>
          </div>
                  )}
                </div>
              ) : (
                <p className="location-text" style={{ color: '#64748b' }}>
                  위치를 공유하려면 위 버튼을 클릭하세요.
                </p>
              )}
              
              {state.familyLocations.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                    가족 구성원 위치
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {state.familyLocations.map((loc) => (
                      <div 
                        key={loc.userId}
                        style={{
                          padding: '12px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                          {loc.userName}
          </div>
                        <div style={{ fontSize: '14px', color: '#64748b' }}>
                          {loc.address}
        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                          {new Date(loc.updatedAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    ))}
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
                        const otherUserName = otherUser?.full_name || otherUser?.email || '알 수 없음';
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
                                    <span>나 여기</span>
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
                        const otherUserName = otherUser?.full_name || otherUser?.email || '알 수 없음';
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {onlineUsers
                  .filter(user => user.id !== userId)
                  .map((user) => {
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
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '500' }}>{user.name}</div>
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
              {onlineUsers.filter(user => user.id !== userId).length === 0 && (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                  요청할 수 있는 사용자가 없습니다.
                </p>
              )}
              <button
                onClick={() => {
                  setShowLocationRequestModal(false);
                  setSelectedUserForRequest(null);
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
    </div>
  );
}