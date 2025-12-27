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
type Photo = { id: number; data: string };

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

  const persist = (newState: AppState, key: string) => {
    try {
      localStorage.setItem(CONFIG.STORAGE, CryptoService.encrypt(newState, key));
    } catch (e) {
      alert("브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 삭제해 주세요.");
    }
  };

  const updateState = (action: string, payload?: any) => {
    if (!masterKey) return;

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

      persist(newState, masterKey);
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
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 보안: 파일 타입 검증
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 가능)');
      e.target.value = "";
      return;
    }
    
    // 보안: 파일 크기 제한 (1.5MB)
    const MAX_SIZE = 1.5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("용량이 너무 큽니다. (1.5MB 이하만 가능)");
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

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateState('ADD_PHOTO', { id: Date.now(), data: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = "";
  };

  // --- [RENDER] ---
  
  if (!isMounted) return null; // Hydration mismatch 방지

  // Supabase 세션이 없으면 로그인 페이지로 리다이렉트 (렌더링 전 처리)
  if (!isAuthenticated && isMounted) {
    return null; // useEffect에서 리다이렉트 처리 중
  }

  return (
    <div className="app-container">
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileSelect} 
      />

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
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="btn-upload"
              >
                Upload
              </button>
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