'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
type Todo = { id: number; text: string; assignee: string; done: boolean; created_by?: string };
type EventItem = { id: number; month: string; day: string; title: string; desc: string; created_by?: string };
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

interface AppState {
  familyName: string;
  location: { address: string };
  todos: Todo[];
  album: Photo[];
  events: EventItem[];
  messages: Message[];
}

const INITIAL_STATE: AppState = {
  familyName: "Ellena Family Hub",
  location: { address: "서울특별시 서초구 반포대로 222" },
  todos: [{ id: 1, text: "시스템 보안 체크", assignee: "관리자", done: false }],
  album: [],
  events: [{ id: 1, month: "DEC", day: "24", title: "크리스마스 파티 🎄", desc: "오후 7시 거실에서 선물 교환" }],
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
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string; isCurrentUser: boolean }>>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
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

  // 3. Scroll Chat to Bottom
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [state.messages, isAuthenticated]);

  // 4. Supabase 데이터 로드 및 Realtime 구독
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
            // 암호화된 메시지 복호화
            let decryptedText = msg.message_text || '';
            if (currentKey && msg.message_text) {
              try {
                const decrypted = CryptoService.decrypt(msg.message_text, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedText = decrypted;
                } else {
                  // 복호화 실패 또는 잘못된 형식 - 원본 텍스트 사용 (암호화된 상태일 수 있음)
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('메시지 복호화 실패 또는 빈 결과:', msg.message_text.substring(0, 30));
                  }
                  decryptedText = msg.message_text;
                }
              } catch (e: any) {
                // 복호화 오류 (Malformed UTF-8 data 등) - 원본 텍스트 사용
                if (process.env.NODE_ENV === 'development') {
                  console.error('메시지 복호화 오류:', e.message || e, {
                    original: msg.message_text.substring(0, 30),
                    keyLength: currentKey.length,
                    errorType: e.name || 'Unknown'
                  });
                }
                decryptedText = msg.message_text;
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
              if (process.env.NODE_ENV === 'development' && !currentKey) {
                console.warn('masterKey가 없어 메시지 복호화 불가');
              }
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

        // 할일 로드
        const { data: tasksData, error: tasksError } = await supabase
          .from('family_tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (!tasksError && tasksData) {
          const formattedTodos: Todo[] = tasksData.map((task: any) => {
            // 암호화된 텍스트 복호화 (task_text 대신 title 사용)
            const taskText = task.title || task.task_text || '';
            let decryptedText = taskText;
            if (currentKey && currentKey.length > 0 && taskText && taskText.length > 0) {
              try {
                const decrypted = CryptoService.decrypt(taskText, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedText = decrypted;
                  if (process.env.NODE_ENV === 'development') {
                    console.log('할일 복호화 성공:', decrypted.substring(0, 20));
                  }
                } else {
                  // 복호화 실패 또는 잘못된 형식
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('할일 복호화 실패:', {
                      original: taskText.substring(0, 30),
                      decrypted: decrypted,
                      keyLength: currentKey.length
                    });
                  }
                  decryptedText = taskText;
                }
              } catch (e: any) {
                // 복호화 오류
                if (process.env.NODE_ENV === 'development') {
                  console.error('할일 복호화 오류:', e.message || e, {
                    original: taskText.substring(0, 30),
                    keyLength: currentKey.length
                  });
                }
                decryptedText = taskText;
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
              if (process.env.NODE_ENV === 'development' && !currentKey) {
                console.warn('masterKey가 없어 할일 복호화 불가');
              }
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

        // 일정 로드
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
              // 제목 복호화
              if (eventTitleField && eventTitleField.length > 0) {
                try {
                  const decryptedTitleData = CryptoService.decrypt(eventTitleField, currentKey);
                  if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                    decryptedTitle = decryptedTitleData;
                    if (process.env.NODE_ENV === 'development') {
                      console.log('일정 제목 복호화 성공:', decryptedTitle.substring(0, 20));
                    }
                  } else {
                    // 복호화 실패 - 원본 텍스트 사용
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('일정 제목 복호화 실패:', {
                        original: eventTitleField.substring(0, 30),
                        decrypted: decryptedTitleData,
                        keyLength: currentKey.length
                      });
                    }
                    decryptedTitle = eventTitleField;
                  }
                } catch (e: any) {
                  // 복호화 오류 (Malformed UTF-8 data 등) - 원본 텍스트 사용
                  if (process.env.NODE_ENV === 'development') {
                    console.error('일정 제목 복호화 오류:', e.message || e, {
                      original: eventTitleField.substring(0, 30),
                      keyLength: currentKey.length,
                      errorType: e.name || 'Unknown'
                    });
                  }
                  decryptedTitle = eventTitleField;
                }
              }
              // 설명 복호화
              if (eventDescField && eventDescField.length > 0) {
                try {
                  const decryptedDescData = CryptoService.decrypt(eventDescField, currentKey);
                  if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                    decryptedDesc = decryptedDescData;
                    if (process.env.NODE_ENV === 'development') {
                      console.log('일정 설명 복호화 성공:', decryptedDesc.substring(0, 20));
                    }
                  } else {
                    // 복호화 실패 - 원본 텍스트 사용
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('일정 설명 복호화 실패:', {
                        original: eventDescField.substring(0, 30),
                        decrypted: decryptedDescData,
                        keyLength: currentKey.length
                      });
                    }
                    decryptedDesc = eventDescField;
                  }
                } catch (e: any) {
                  // 복호화 오류 (Malformed UTF-8 data 등) - 원본 텍스트 사용
                  if (process.env.NODE_ENV === 'development') {
                    console.error('일정 설명 복호화 오류:', e.message || e, {
                      original: eventDescField.substring(0, 30),
                      keyLength: currentKey.length,
                      errorType: e.name || 'Unknown'
                    });
                  }
                  decryptedDesc = eventDescField;
                }
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
              if (process.env.NODE_ENV === 'development') {
                console.warn('일정 복호화 불가 - 키 없음:', {
                  hasKey: !!currentKey,
                  keyLength: currentKey?.length || 0
                });
              }
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
      const authKey = getAuthKey(userId);
      const currentKey = masterKey || sessionStorage.getItem(authKey) || 
        process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY || 'ellena_family_shared_key_2024';
      
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
            if (currentKey && newMessage.message_text) {
              try {
                const decrypted = CryptoService.decrypt(newMessage.message_text, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedText = decrypted;
                } else {
                  // 복호화 실패 또는 잘못된 형식
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('Realtime 메시지 복호화 실패:', newMessage.message_text.substring(0, 30));
                  }
                  decryptedText = newMessage.message_text;
                }
              } catch (e: any) {
                // 복호화 오류 (Malformed UTF-8 data 등)
                if (process.env.NODE_ENV === 'development') {
                  console.error('Realtime 메시지 복호화 오류:', e.message || e, {
                    original: newMessage.message_text.substring(0, 30),
                    keyLength: currentKey.length,
                    errorType: e.name || 'Unknown'
                  });
                }
                decryptedText = newMessage.message_text;
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
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
            
            // 암호화된 메시지 복호화
            let decryptedText = updatedMessage.message_text || '';
            if (currentKey && updatedMessage.message_text) {
              try {
                const decrypted = CryptoService.decrypt(updatedMessage.message_text, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedText = decrypted;
                } else {
                  decryptedText = updatedMessage.message_text;
                }
              } catch (e: any) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Realtime 메시지 업데이트 복호화 오류:', e.message || e);
                }
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
            // 암호화된 텍스트 복호화 (task_text 대신 title 사용)
            const taskText = newTask.title || newTask.task_text || '';
            let decryptedText = taskText;
            if (currentKey && currentKey.length > 0 && taskText && taskText.length > 0) {
              try {
                const decrypted = CryptoService.decrypt(taskText, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedText = decrypted;
                  if (process.env.NODE_ENV === 'development') {
                    console.log('Realtime 할일 복호화 성공:', decrypted.substring(0, 20));
                  }
                } else {
                  // 복호화 실패 또는 잘못된 형식
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('Realtime 할일 복호화 실패:', {
                      original: taskText.substring(0, 30),
                      decrypted: decrypted,
                      keyLength: currentKey.length
                    });
                  }
                  decryptedText = taskText;
                }
              } catch (e: any) {
                // 복호화 오류
                if (process.env.NODE_ENV === 'development') {
                  console.error('Realtime 할일 복호화 오류:', e.message || e, {
                    original: taskText.substring(0, 30),
                    keyLength: currentKey.length
                  });
                }
                decryptedText = taskText;
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
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
            
            // assigned_to가 NULL이 아니고 문자열인 경우에만 복호화 시도 (UUID 타입이므로 일반적으로 NULL)
            // 하지만 텍스트에서 추출한 assignee가 우선
            if (decryptedAssignee === '누구나' && newTask.assigned_to && typeof newTask.assigned_to === 'string' && newTask.assigned_to !== '누구나' && !newTask.assigned_to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              try {
                const decrypted = CryptoService.decrypt(newTask.assigned_to, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedAssignee = decrypted;
                }
              } catch (e) {
                // 복호화 실패 시 기본값 사용
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Realtime 담당자 복호화 실패:', e);
                }
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
            // 암호화된 텍스트 복호화 (task_text 대신 title 사용)
            const taskText = updatedTask.title || updatedTask.task_text || '';
            let decryptedText = taskText;
            if (currentKey && currentKey.length > 0 && taskText && taskText.length > 0) {
              try {
                const decrypted = CryptoService.decrypt(taskText, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedText = decrypted;
                  if (process.env.NODE_ENV === 'development') {
                    console.log('Realtime 할일 업데이트 복호화 성공:', decrypted.substring(0, 20));
                  }
                } else {
                  // 복호화 실패 또는 잘못된 형식
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('Realtime 할일 업데이트 복호화 실패:', {
                      original: taskText.substring(0, 30),
                      decrypted: decrypted,
                      keyLength: currentKey.length
                    });
                  }
                  decryptedText = taskText;
                }
              } catch (e: any) {
                // 복호화 오류
                if (process.env.NODE_ENV === 'development') {
                  console.error('Realtime 할일 업데이트 복호화 오류:', e.message || e, {
                    original: taskText.substring(0, 30),
                    keyLength: currentKey.length
                  });
                }
                decryptedText = taskText;
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
              decryptedText = taskText;
            }
            
            // 담당자(assignee) 처리: assigned_to가 UUID 타입이므로 NULL일 수 있음
            // 담당자 정보는 title에 포함되거나 기본값 '누구나' 사용
            let decryptedAssignee = '누구나';
            // assigned_to가 NULL이 아니고 문자열인 경우에만 복호화 시도 (UUID 타입이므로 일반적으로 NULL)
            if (updatedTask.assigned_to && typeof updatedTask.assigned_to === 'string' && updatedTask.assigned_to !== '누구나' && !updatedTask.assigned_to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              try {
                const decrypted = CryptoService.decrypt(updatedTask.assigned_to, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedAssignee = decrypted;
                }
              } catch (e) {
                // 복호화 실패 시 기본값 사용
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Realtime 담당자 업데이트 복호화 실패:', e);
                }
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
            // 기준: 모든 사용자에게 동일하게 삭제 반영 (사용자 구분 없음)
            const deletedId = payload.old?.id;
            if (!deletedId) {
              console.warn('Realtime 할일 DELETE: deletedId가 없음:', payload);
              return;
            }
            const deletedIdStr = String(deletedId).trim();
            console.log('Realtime 할일 DELETE 처리:', { deletedId, deletedIdStr });
            setState(prev => {
              const beforeCount = prev.todos.length;
              const filtered = prev.todos.filter(t => {
                const tIdStr = String(t.id).trim();
                return tIdStr !== deletedIdStr;
              });
              const afterCount = filtered.length;
              console.log('Realtime 할일 DELETE 결과:', { beforeCount, afterCount, deleted: beforeCount - afterCount });
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
            if (currentKey && currentKey.length > 0) {
              // 제목 복호화
              if (newEventTitleField && newEventTitleField.length > 0) {
                try {
                  const decryptedTitleData = CryptoService.decrypt(newEventTitleField, currentKey);
                  if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                    decryptedTitle = decryptedTitleData;
                    if (process.env.NODE_ENV === 'development') {
                      console.log('Realtime 일정 제목 복호화 성공:', decryptedTitle.substring(0, 20));
                    }
                  } else {
                    // 복호화 실패
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('Realtime 일정 제목 복호화 실패:', {
                        original: newEventTitleField.substring(0, 30),
                        decrypted: decryptedTitleData,
                        keyLength: currentKey.length
                      });
                    }
                    decryptedTitle = newEventTitleField;
                  }
                } catch (e: any) {
                  // 복호화 오류 (Malformed UTF-8 data 등)
                  if (process.env.NODE_ENV === 'development') {
                    console.error('Realtime 일정 제목 복호화 오류:', e.message || e, {
                      original: newEventTitleField.substring(0, 30),
                      keyLength: currentKey.length,
                      errorType: e.name || 'Unknown'
                    });
                  }
                  decryptedTitle = newEventTitleField;
                }
              }
              // 설명 복호화
              if (newEventDescField && newEventDescField.length > 0) {
                try {
                  const decryptedDescData = CryptoService.decrypt(newEventDescField, currentKey);
                  if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                    decryptedDesc = decryptedDescData;
                    if (process.env.NODE_ENV === 'development') {
                      console.log('Realtime 일정 설명 복호화 성공:', decryptedDesc.substring(0, 20));
                    }
                  } else {
                    // 복호화 실패
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('Realtime 일정 설명 복호화 실패:', {
                        original: newEventDescField.substring(0, 30),
                        decrypted: decryptedDescData,
                        keyLength: currentKey.length
                      });
                    }
                    decryptedDesc = newEventDescField;
                  }
    } catch (e) {
                  // 복호화 오류
                  if (process.env.NODE_ENV === 'development') {
                    console.error('Realtime 일정 설명 복호화 오류:', e, {
                      original: newEventDescField.substring(0, 30),
                      keyLength: currentKey.length
                    });
                  }
                  decryptedDesc = newEventDescField;
                }
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
              if (process.env.NODE_ENV === 'development') {
                console.warn('Realtime 일정 복호화 불가 - 키 없음:', {
                  hasKey: !!currentKey,
                  keyLength: currentKey?.length || 0
                });
              }
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
            if (currentKey) {
              // 제목 복호화
              if (updatedEventTitleField) {
                try {
                  const decryptedTitleData = CryptoService.decrypt(updatedEventTitleField, currentKey);
                  if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                    decryptedTitle = decryptedTitleData;
                  } else {
                    // 복호화 실패
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('Realtime 일정 업데이트 제목 복호화 실패:', updatedEventTitleField.substring(0, 30));
                    }
                    decryptedTitle = updatedEventTitleField;
                  }
                } catch (e: any) {
                  // 복호화 오류 (Malformed UTF-8 data 등)
                  if (process.env.NODE_ENV === 'development') {
                    console.error('Realtime 일정 업데이트 제목 복호화 오류:', e.message || e, {
                      original: updatedEventTitleField.substring(0, 30),
                      keyLength: currentKey.length,
                      errorType: e.name || 'Unknown'
                    });
                  }
                  decryptedTitle = updatedEventTitleField;
                }
              }
              // 설명 복호화
              if (updatedEventDescField) {
                try {
                  const decryptedDescData = CryptoService.decrypt(updatedEventDescField, currentKey);
                  if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                    decryptedDesc = decryptedDescData;
                  } else {
                    // 복호화 실패
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('Realtime 일정 업데이트 설명 복호화 실패:', updatedEventDescField.substring(0, 30));
                    }
                    decryptedDesc = updatedEventDescField;
                  }
                } catch (e) {
                  // 복호화 오류
                  if (process.env.NODE_ENV === 'development') {
                    console.error('Realtime 일정 업데이트 설명 복호화 오류:', e);
                  }
                  decryptedDesc = updatedEventDescField;
                }
              }
            } else {
              // masterKey가 없으면 원본 텍스트 사용
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
            // 기준: 모든 사용자에게 동일하게 삭제 반영 (사용자 구분 없음)
            const deletedId = payload.old?.id;
            if (!deletedId) {
              console.warn('Realtime 일정 DELETE: deletedId가 없음:', payload);
              return;
            }
            const deletedIdStr = String(deletedId).trim();
            console.log('Realtime 일정 DELETE 처리:', { deletedId, deletedIdStr });
            setState(prev => {
              const beforeCount = prev.events.length;
              const filtered = prev.events.filter(e => {
                const eIdStr = String(e.id).trim();
                return eIdStr !== deletedIdStr;
              });
              const afterCount = filtered.length;
              console.log('Realtime 일정 DELETE 결과:', { beforeCount, afterCount, deleted: beforeCount - afterCount });
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
      
      console.log('✅ 모든 Realtime subscription 설정 완료');
    };

    // Supabase 데이터 로드 및 Realtime 구독 설정
    console.log('🔄 Supabase 데이터 로드 시작...');
    // 재로그인 시에도 항상 Supabase에서 데이터 로드
    const timer = setTimeout(() => {
      loadSupabaseData().then(() => {
        console.log('✅ Supabase 데이터 로드 완료, Realtime 구독 시작');
        setupRealtimeSubscriptions();
      }).catch((error) => {
        console.error('❌ Supabase 데이터 로드 실패:', error);
        // 데이터 로드 실패해도 Realtime 구독은 설정
        setupRealtimeSubscriptions();
      });
    }, 100); // 짧은 지연으로 빠른 로드
    
    // 정리 함수
    return () => {
      console.log('🧹 Realtime subscription 정리 중...');
      clearTimeout(timer);
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
  }, [isAuthenticated, userId, masterKey, userName]);

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
          
          console.log('saveToSupabase DELETE_TODO:', { taskId, isNumericId, payloadType: typeof payload });
          
          if (isNumericId) {
            console.log('로컬 데이터 삭제 (Supabase 삭제 건너뜀):', taskId);
            break; // 로컬 데이터는 Supabase 삭제 시도하지 않음
          }
          
          console.log('Supabase 삭제 시도:', taskId);
          const { error } = await supabase
            .from('family_tasks')
            .delete()
            .eq('id', taskId);
          
          if (error) {
            console.error('할일 삭제 오류:', error);
            console.error('삭제 시도한 ID:', taskId, '타입:', typeof taskId);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
          } else {
            console.log('할일 삭제 성공:', taskId);
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
          
          console.log('saveToSupabase DELETE_EVENT:', { eventId, isNumericId, payloadType: typeof payload });
          
          if (isNumericId) {
            console.log('로컬 데이터 삭제 (Supabase 삭제 건너뜀):', eventId);
            break; // 로컬 데이터는 Supabase 삭제 시도하지 않음
          }
          
          console.log('Supabase 삭제 시도:', eventId);
          const { error } = await supabase
            .from('family_events')
            .delete()
            .eq('id', eventId);
          
          if (error) {
            console.error('일정 삭제 오류:', error);
            console.error('삭제 시도한 ID:', eventId, '타입:', typeof eventId);
            if (process.env.NODE_ENV === 'development') {
              console.error('에러 상세:', JSON.stringify(error, null, 2));
            }
          } else {
            console.log('일정 삭제 성공:', eventId);
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
        case 'DELETE_TODO':
          // ID 비교를 안전하게 처리 (number와 string 모두 지원)
          const deleteTodoId = String(payload).trim();
          console.log('updateState DELETE_TODO 호출:', { payload, deleteTodoId, payloadType: typeof payload });
          newState.todos = prev.todos.filter(t => String(t.id).trim() !== deleteTodoId);
          // Supabase에 저장
          saveToSupabase('DELETE_TODO', payload, userId, currentKey);
          break;
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
        case 'DELETE_EVENT':
          // ID 비교를 안전하게 처리 (number와 string 모두 지원)
          const deleteEventId = String(payload).trim();
          console.log('updateState DELETE_EVENT 호출:', { payload, deleteEventId, payloadType: typeof payload });
          newState.events = prev.events.filter(e => String(e.id).trim() !== deleteEventId);
          // Supabase에 저장
          saveToSupabase('DELETE_EVENT', payload, userId, currentKey);
          break;
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

  // Logout Handler
  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
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
          <h1 
            onClick={handleRename}
            className="app-title"
          >
            {state.familyName.split(' ').map((word, idx, arr) => (
              <React.Fragment key={idx}>
                {word}
                {idx < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
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
              <h3 className="section-title">Real-time Location</h3>
          </div>
            <div className="section-body">
              <p className="location-text">{state.location.address}</p>
        </div>
        </section>
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