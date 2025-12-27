'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// --- [CONFIG & SERVICE] 원본 로직 유지 ---
const CONFIG = { STORAGE: 'SFH_DATA_V5', AUTH: 'SFH_AUTH' };

const CryptoService = {
  encrypt: (data: any, key: string) => CryptoJS.AES.encrypt(JSON.stringify(data), key).toString(),
  decrypt: (cipher: string, key: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(cipher, key);
      const raw = bytes.toString(CryptoJS.enc.Utf8);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
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
type Todo = { id: number; text: string; assignee: string; done: boolean };
type EventItem = { id: number; month: string; day: string; title: string; desc: string };
type Message = { user: string; text: string; time: string };
type Photo = { 
  id: number; 
  data: string; // 리사이징된 이미지 (표시용)
  originalData?: string; // 원본 이미지 (S3 업로드용, 선택적)
  originalSize?: number; // 원본 파일 크기 (bytes)
  originalFilename?: string; // 원본 파일명
  mimeType?: string; // MIME 타입
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
  messages: [{ user: "System", text: "가족 채팅방이 활성화되었습니다.", time: "방금" }]
};

export default function FamilyHub() {
  const router = useRouter();
  // --- [STATE] ---
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterKey, setMasterKey] = useState('');
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  // Inputs Ref (Uncontrolled inputs for cleaner handlers similar to original)
  const todoTextRef = useRef<HTMLInputElement>(null);
  const todoWhoRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  // --- [HANDLERS] App 객체 메서드 이식 ---
  
  const loadData = useCallback((key: string) => {
    const saved = localStorage.getItem(CONFIG.STORAGE);
    if (saved) {
      const decrypted = CryptoService.decrypt(saved, key);
      if (!decrypted) {
        alert("보안 키가 일치하지 않습니다.");
        return;
      }
      setState(decrypted);
    }
    sessionStorage.setItem(CONFIG.AUTH, key);
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
        
        // 사용자 이름 가져오기 (닉네임 우선)
        if (session.user) {
          const name = session.user.user_metadata?.nickname
            || session.user.user_metadata?.full_name 
            || session.user.user_metadata?.name 
            || session.user.email?.split('@')[0] 
            || '사용자';
          setUserName(name);
        }
        
        // 기존 마스터 키가 있으면 데이터 로드
        const key = sessionStorage.getItem(CONFIG.AUTH);
        if (key) {
          setMasterKey(key);
          loadData(key);
        }
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

  const persist = (newState: AppState, key: string) => {
    try {
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
      
      localStorage.setItem(CONFIG.STORAGE, CryptoService.encrypt(cleanedState, key));
    } catch (e: any) {
      // QuotaExceededError 처리
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // 오래된 사진 자동 삭제 시도
        const cleanedState = checkAndCleanStorage(newState);
        try {
          const stateForStorage: AppState = {
            ...cleanedState,
            album: cleanedState.album.map(photo => {
              const { originalData, ...photoWithoutOriginal } = photo;
              return photoWithoutOriginal;
            })
          };
          localStorage.setItem(CONFIG.STORAGE, CryptoService.encrypt(stateForStorage, key));
          alert("저장 공간이 부족하여 오래된 사진이 자동으로 삭제되었습니다.");
        } catch (retryError) {
          alert("브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 수동으로 삭제해 주세요.");
        }
      } else {
        alert("브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 삭제해 주세요.");
      }
    }
  };

  const updateState = (action: string, payload?: any) => {
    // masterKey가 없으면 자동 생성 또는 불러오기
    let currentKey = masterKey;
    
    if (!currentKey) {
      // sessionStorage에서 기존 키 확인
      const savedKey = sessionStorage.getItem(CONFIG.AUTH);
      if (savedKey) {
        currentKey = savedKey;
        setMasterKey(savedKey);
      } else {
        // 새로운 마스터 키 생성
        const newKey = `key_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        currentKey = newKey;
        setMasterKey(newKey);
        sessionStorage.setItem(CONFIG.AUTH, newKey);
      }
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
        case 'TOGGLE_TODO':
          newState.todos = prev.todos.map(t => t.id === payload ? { ...t, done: !t.done } : t);
          break;
        case 'ADD_TODO':
          newState.todos = [payload, ...prev.todos];
          break;
        case 'DELETE_TODO':
          newState.todos = prev.todos.filter(t => t.id !== payload);
          break;
        case 'ADD_PHOTO':
          newState.album = [payload, ...prev.album];
          break;
        case 'DELETE_PHOTO':
          newState.album = prev.album.filter(p => p.id !== payload);
          break;
        case 'ADD_EVENT':
          newState.events = [payload, ...prev.events];
          break;
        case 'DELETE_EVENT':
          newState.events = prev.events.filter(e => e.id !== payload);
          break;
        case 'ADD_MESSAGE':
          newState.messages = [...(prev.messages || []), payload].slice(-50);
          break;
      }

      persist(newState, currentKey);
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
    
    updateState('ADD_TODO', { 
      id: Date.now(), 
      text: sanitizedText, 
      assignee: sanitizedWho || "누구나", 
      done: false 
    });
    
    // Clear & Close
    if (todoTextRef.current) todoTextRef.current.value = "";
    if (todoWhoRef.current) todoWhoRef.current.value = "";
    setIsTodoModalOpen(false);
  };

  // Event Handlers
  const addNewEvent = () => {
    const title = prompt("일정 제목:");
    if (!title) return;
    const dateStr = prompt("날짜 (예: DEC 25):");
    if (!dateStr) return;
    const [m, d] = dateStr.split(' ');
    const desc = prompt("설명:");
    
    // 보안: 입력 검증
    const sanitizedTitle = sanitizeInput(title, 100);
    const sanitizedMonth = sanitizeInput(m, 10);
    const sanitizedDay = sanitizeInput(d, 10);
    const sanitizedDesc = sanitizeInput(desc, 200);
    
    if (!sanitizedTitle) return alert("유효하지 않은 제목입니다.");
    
    updateState('ADD_EVENT', { 
      id: Date.now(), 
      month: (sanitizedMonth || "EVENT").toUpperCase(), 
      day: sanitizedDay || "!", 
      title: sanitizedTitle, 
      desc: sanitizedDesc 
    });
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
    
    updateState('ADD_MESSAGE', { 
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

    // 보안: 원본 파일 크기 제한
    // RAW 파일은 리사이징 불가능하므로 크기 제한을 더 크게 설정
    // Presigned URL 방식으로 큰 파일도 처리 가능하므로 제한 완화
    const MAX_ORIGINAL_SIZE = isRawFile 
      ? 100 * 1024 * 1024  // RAW 파일: 100MB (리사이징 불가능하므로 여유있게)
      : 50 * 1024 * 1024;  // 일반 파일: 50MB
    if (file.size > MAX_ORIGINAL_SIZE) {
      alert(`파일이 너무 큽니다. (${isRawFile ? 'RAW 파일' : '일반 파일'} 최대 ${MAX_ORIGINAL_SIZE / 1024 / 1024}MB)`);
      e.target.value = "";
      return;
    }

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
      const photoId = Date.now();
      const originalDataForUpload = originalData; // 업로드용 원본 데이터 보관
      
      updateState('ADD_PHOTO', { 
        id: photoId, 
        data: imageData, // 표시용 리사이징된 이미지 (localStorage에 저장)
        // originalData는 localStorage에 저장하지 않음 (공간 절약)
        originalSize: file.size, // 원본 파일 크기
        originalFilename: file.name, // 원본 파일명
        mimeType: file.type // MIME 타입
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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('세션이 없어 Cloudinary/S3 업로드를 건너뜁니다.');
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
          // 1. Presigned URL 요청
          const urlResponse = await fetch('/api/get-upload-url', {
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
          });

          const urlResult = await urlResponse.json();

          if (!urlResponse.ok) {
            throw new Error(urlResult.error || 'Presigned URL 생성 실패');
          }

          const { presignedUrl, s3Key, s3Url } = urlResult;

          // 2. 클라이언트에서 직접 S3에 원본 파일 업로드
          const s3UploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            body: file, // 원본 파일 그대로 (Base64 변환 불필요)
            headers: {
              'Content-Type': file.type,
            },
          });

          if (!s3UploadResponse.ok) {
            throw new Error('S3 업로드 실패');
          }

          if (process.env.NODE_ENV === 'development') {
            console.log('S3 직접 업로드 완료:', { s3Key, s3Url });
          }

          // 3. 업로드 완료 처리 (Cloudinary 업로드 + Supabase 저장)
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
          });

          const completeResult = await completeResponse.json();

          if (!completeResponse.ok) {
            throw new Error(completeResult.error || '업로드 완료 처리 실패');
          }

          if (process.env.NODE_ENV === 'development') {
            console.log('Presigned URL 업로드 완료:', {
              cloudinaryUrl: completeResult.cloudinaryUrl,
              s3Url: completeResult.s3Url,
              memoryId: completeResult.id,
            });
          }
        } else {
          // 기존 방식 (작은 파일, 서버 경유)
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
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResponse.ok) {
            throw new Error(uploadResult.error || '업로드 실패');
          }

          if (process.env.NODE_ENV === 'development') {
            console.log('서버 경유 업로드 완료:', {
              cloudinaryUrl: uploadResult.cloudinaryUrl,
              s3Url: uploadResult.s3Url,
              memoryId: uploadResult.id,
            });
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
      }
    } catch (error: any) {
      console.error('Image processing error:', error);
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
            <div className="user-info" onClick={() => setIsNicknameModalOpen(true)} style={{ cursor: 'pointer' }}>
              <span className="user-icon">👤</span>
              <p className="user-name">{userName || '로딩 중...'}</p>
            </div>
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
                state.album.map(p => (
                  <div key={p.id} className="photo-item">
                    <img src={p.data} className="photo-image" alt="memory" />
                    <button 
                      onClick={() => confirm("사진을 삭제하시겠습니까?") && updateState('DELETE_PHOTO', p.id)} 
                      className="btn-delete-photo"
                    >
                      <svg className="icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                ))
              ) : (
                <div className="photo-empty">
                  사진을 업로드해보세요.
                </div>
              )}
            </div>
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
                      <button 
                        onClick={() => confirm("삭제하시겠습니까?") && updateState('DELETE_TODO', t.id)} 
                        className="btn-delete"
                      >
                        <svg className="icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
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
                        <button 
                          onClick={() => confirm("삭제하시겠습니까?") && updateState('DELETE_EVENT', e.id)} 
                          className="btn-delete-event"
                        >
                          <svg className="icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">등록된 일정이 없습니다.</p>
                )}
              </div>
              <button 
                onClick={addNewEvent} 
                className="btn-calendar-add"
              >
                + 일정 추가하기
              </button>
            </div>
          </section>

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
    </div>
  );
}