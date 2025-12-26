'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

// --- [TYPES] 타입 안정성 추가 ---
type Todo = { id: number; text: string; assignee: string; done: boolean };
type EventItem = { id: number; month: string; day: string; title: string; desc: string };
type Message = { user: string; text: string; time: string };
type Photo = { id: number; data: string }; // Base64 string

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
    if (n?.trim()) updateState('RENAME', n.trim());
  };

  // Todo Handlers
  const submitNewTodo = () => {
    const text = todoTextRef.current?.value;
    const who = todoWhoRef.current?.value;
    if (!text?.trim()) return alert("할 일을 입력해주세요.");
    
    updateState('ADD_TODO', { 
      id: Date.now(), 
      text: text.trim(), 
      assignee: who?.trim() || "누구나", 
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
    
    updateState('ADD_EVENT', { 
      id: Date.now(), 
      month: (m || "EVENT").toUpperCase(), 
      day: d || "!", 
      title, 
      desc: desc || "" 
    });
  };

  // Chat Handlers
  const sendChat = () => {
    const input = chatInputRef.current;
    if (!input || !input.value.trim()) return;
    
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    updateState('ADD_MESSAGE', { 
      user: "나", 
      text: input.value.trim(), 
      time: timeStr 
    });
    input.value = "";
  };

  // Photo Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) return alert("용량이 너무 큽니다. (1.5MB 이하만 가능)");

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
    <div id="app" className={`
      w-full h-[100vh] bg-slate-50 relative flex flex-col overflow-y-auto overflow-x-hidden
      md:w-[430px] md:h-[850px] md:rounded-[3.5rem] md:border-[12px] md:border-slate-800 md:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)]
    `}>
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileSelect} 
      />


      {/* Todo Modal */}
      <div className={`
        absolute inset-0 z-60 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-5
        ${isTodoModalOpen ? 'flex' : 'hidden'}
      `}>
        <div className="glass w-full max-w-[350px] p-8 shadow-2xl border-white bg-white/90">
          <h3 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2">
            <span className="text-2xl">📝</span> 새 할 일 등록
          </h3>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">무엇을 할까요?</label>
              <input 
                ref={todoTextRef}
                type="text" 
                className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-indigo-500 outline-none font-bold text-slate-700 bg-slate-50/50" 
                placeholder="할 일 내용 입력"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">누가 할까요?</label>
              <input 
                ref={todoWhoRef}
                type="text" 
                className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-indigo-500 outline-none font-bold text-slate-700 bg-slate-50/50" 
                placeholder="이름 입력 (비워두면 누구나)"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setIsTodoModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">취소</button>
            <button onClick={submitNewTodo} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 btn-touch">등록하기</button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="transition-opacity duration-1000 opacity-100">
        
        {/* Header */}
        <header className="p-[8%] pt-[14%]">
          <h1 
            onClick={handleRename}
            className="text-4xl font-black tracking-tight leading-[1.1] cursor-pointer hover:opacity-70 transition-opacity"
            dangerouslySetInnerHTML={{ __html: state.familyName.replace(' ', '<br>') }}
          />
          <div className="flex items-center gap-2 mt-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Family Sync Active</p>
          </div>
        </header>

        {/* Family Tasks */}
        <div className="glass mx-5 my-3 p-6 shadow-xl shadow-slate-200/50 border-white/60 fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Family Tasks</h3>
            <button onClick={() => setIsTodoModalOpen(true)} className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg tracking-tighter">+ ADD</button>
          </div>
          <div className="text-slate-800">
            {state.todos.length > 0 ? state.todos.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 group">
                <div onClick={() => updateState('TOGGLE_TODO', t.id)} className="btn-touch flex items-center gap-4 cursor-pointer">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${t.done ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                    {t.done && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7"></path></svg>}
                  </div>
                  <span className={`text-base font-bold ${t.done ? 'text-slate-300 line-through' : 'text-slate-700'}`}>{t.text}</span>
                  {t.assignee && <span className="text-xs font-black text-indigo-400">👤 {t.assignee}</span>}
                </div>
                <button onClick={() => confirm("삭제하시겠습니까?") && updateState('DELETE_TODO', t.id)} className="text-slate-300 hover:text-red-400 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            )) : (
              <p className="py-2 text-slate-400 font-bold text-sm">할 일을 모두 완료했습니다!</p>
            )}
          </div>
        </div>

        {/* Family Calendar */}
        <div className="glass mx-5 my-3 p-6 shadow-xl shadow-slate-200/50 border-white/60 fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Family Calendar</h3>
          </div>
          <div className="text-slate-800">
            <div className="mb-6 max-h-[250px] overflow-y-auto pr-2 chat-scroll">
              {state.events.length > 0 ? state.events.map(e => (
                <div key={e.id} className="flex gap-4 mb-4 items-start relative group">
                  <div className="flex flex-col items-center bg-white rounded-xl px-3 py-2 shadow-sm min-w-[55px] border border-slate-100">
                    <span className="text-[10px] font-black text-indigo-500 uppercase">{e.month}</span>
                    <span className="text-xl font-black text-slate-800">{e.day}</span>
                  </div>
                  <div className="flex-1 pt-1 pr-8">
                    <h4 className="text-base font-black text-slate-800 leading-tight">{e.title}</h4>
                    <p className="text-xs font-bold text-slate-400 mt-1">{e.desc}</p>
                  </div>
                  <button onClick={() => confirm("삭제하시겠습니까?") && updateState('DELETE_EVENT', e.id)} className="absolute right-0 top-1 text-slate-300 hover:text-red-500 transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              )) : (
                <p className="text-center py-4 text-slate-400 font-bold text-sm">등록된 일정이 없습니다.</p>
              )}
            </div>
            <button onClick={addNewEvent} className="btn-touch w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm">
              + 일정 추가하기
            </button>
          </div>
        </div>

        {/* Family Chat */}
        <div className="glass mx-5 my-3 p-6 shadow-xl shadow-slate-200/50 border-white/60 fade-in">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Family Chat</h3>
          </div>
          <div className="text-slate-800">
            <div ref={chatBoxRef} className="chat-scroll max-h-[180px] overflow-y-auto mb-4 pr-2">
              {(state.messages || []).map((m, idx) => (
                <div key={idx} className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-indigo-500">{m.user}</span>
                    <span className="text-[10px] text-slate-300">{m.time}</span>
                  </div>
                  <div className="bg-white/50 inline-block px-4 py-2 rounded-2xl rounded-tl-none border border-white/40 shadow-sm max-w-[90%]">
                    <p className="text-sm font-bold text-slate-700 break-all">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 w-full flex-nowrap">
              <input 
                ref={chatInputRef}
                type="text" 
                onKeyPress={(e) => e.key === 'Enter' && sendChat()}
                className="flex-1 min-w-0 bg-white/50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500" 
                placeholder="메시지 입력..."
              />
              <button 
                onClick={sendChat}
                className="btn-touch bg-slate-900 text-white px-4 py-3 rounded-xl font-black text-xs whitespace-nowrap flex-shrink-0"
              >
                전송
              </button>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="glass mx-5 my-3 p-6 shadow-xl shadow-slate-200/50 border-white/60 fade-in">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Real-time Location</h3>
          </div>
          <p className="text-lg font-black text-indigo-900">{state.location.address}</p>
        </div>

        {/* Memory Vault */}
        <section className="glass m-5 p-8 mb-16 shadow-2xl shadow-slate-200/60 text-center">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-slate-800 text-left">Memory Vault</h2>
            <button onClick={() => fileInputRef.current?.click()} className="btn-touch px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg">Upload</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {state.album && state.album.length > 0 ? state.album.map(p => (
              <div key={p.id} className="relative group aspect-square bg-white/40 rounded-2xl border border-white shadow-sm overflow-hidden">
                <img src={p.data} className="w-full h-full object-cover" alt="memory" />
                <button onClick={() => confirm("사진을 삭제하시겠습니까?") && updateState('DELETE_PHOTO', p.id)} className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            )) : (
              <div className="col-span-3 py-10 text-slate-300 font-bold border-2 border-dashed border-slate-100 rounded-3xl">
                사진을 업로드해보세요.
              </div>
            )}
          </div>
        </section>
        
      </div>
    </div>
  );
}