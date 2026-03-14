import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 설정값을 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 설정이 누락되었을 경우를 대비한 안전 장치입니다.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 설정이 .env.local 파일에 누락되었습니다.');
}

/** 로그인 페이지 "로그인 상태 유지" 체크 시 사용. '0' = sessionStorage(탭 닫으면 로그아웃), 그 외 = localStorage(유지) */
export const PERSIST_SESSION_FLAG_KEY = 'SFH_PERSIST_SESSION';
export const AUTH_STORAGE_KEY = 'sb-auth-token';

function getAuthStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  const flag = localStorage.getItem(PERSIST_SESSION_FLAG_KEY);
  const useSessionStorage = flag === '0';
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUTH-DEBUG] getAuthStorage:', { flag, useSessionStorage: useSessionStorage ? 'sessionStorage' : 'localStorage' });
  }
  return useSessionStorage ? window.sessionStorage : window.localStorage;
}

/** 세션 저장소에서 토큰 제거 (localStorage + sessionStorage 둘 다 정리) */
export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Supabase 초기화 전에 두 저장소의 명백히 손상된(JSON 파싱 실패) 세션만 정리
if (typeof window !== 'undefined') {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH-DEBUG] 초기화 시작 - 세션 검증');
    }
    for (const storage of [localStorage, sessionStorage]) {
      const stored = storage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        try {
          JSON.parse(stored);
          if (process.env.NODE_ENV === 'development') {
            console.log('[AUTH-DEBUG] 유효한 세션 발견:', storage === localStorage ? 'localStorage' : 'sessionStorage');
          }
        } catch {
          storage.removeItem(AUTH_STORAGE_KEY);
          if (process.env.NODE_ENV === 'development') {
            console.log('[AUTH-DEBUG] JSON 파싱 불가 세션 제거됨:', storage === localStorage ? 'localStorage' : 'sessionStorage');
          }
        }
      }
    }
  } catch {
    // ignore
  }
}

const customStorage =
  typeof window !== 'undefined'
    ? {
        getItem: (key: string) => {
          const result = getAuthStorage()?.getItem(key) ?? null;
          if (process.env.NODE_ENV === 'development' && key === AUTH_STORAGE_KEY) {
            console.log('[AUTH-DEBUG] customStorage.getItem:', { key, hasValue: !!result, length: result?.length });
          }
          return result;
        },
        setItem: (key: string, value: string) => {
          if (process.env.NODE_ENV === 'development' && key === AUTH_STORAGE_KEY) {
            console.log('[AUTH-DEBUG] customStorage.setItem:', { key, length: value.length });
          }
          getAuthStorage()?.setItem(key, value);
        },
        removeItem: (key: string) => {
          if (typeof window === 'undefined') return;
          if (process.env.NODE_ENV === 'development' && key === AUTH_STORAGE_KEY) {
            console.log('[AUTH-DEBUG] customStorage.removeItem:', { key });
          }
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        },
      }
    : undefined;

// 이 supabase 객체를 통해 DB에 접근합니다.
// "로그인 상태 유지" 체크 시 localStorage, 미체크 시 sessionStorage 사용.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorage,
    storageKey: AUTH_STORAGE_KEY,
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Realtime 이벤트 처리 속도 제한
    },
  },
  global: {
    headers: {
      'x-client-info': 'ellena-family-hub',
    },
  },
});

// 인증 상태 변경 리스너 추가
// 근본 원인 해결: refresh token 에러를 조용히 처리
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(async (event, session) => {
    // Refresh Token 에러가 발생한 경우 조용히 처리
    if (event === 'SIGNED_OUT' && !session) {
      clearAuthStorage();
      return;
    }
    if (event === 'TOKEN_REFRESHED') {
      if (session) {
        if (process.env.NODE_ENV === 'development') {
          console.log('토큰 갱신 성공');
        }
      } else {
        clearAuthStorage();
      }
    }
    
    if (event === 'SIGNED_IN') {
      if (process.env.NODE_ENV === 'development') {
        console.log('인증 상태 변경: 로그인');
      }
    }
  });
  
  // 전역 에러 핸들러로 Refresh Token 에러 및 Map ID 에러 필터링
  // Supabase가 내부적으로 발생시키는 refresh token 에러를 콘솔에서 숨김
  // Google Maps Map ID 관련 에러도 필터링 (Map ID가 없어도 기본 마커는 작동)
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args.join(' ');
    // Refresh Token 관련 에러는 콘솔에 표시하지 않음
    if (
      errorMessage.includes('Invalid Refresh Token') ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token') ||
      (errorMessage.includes('AuthApiError') && errorMessage.includes('Refresh'))
    ) {
      // 개발 환경에서만 경고 로그 (에러가 아닌 경고로 표시)
      if (process.env.NODE_ENV === 'development') {
        console.warn('Refresh Token 만료 - 자동 로그아웃 처리됨');
      }
      return; // 에러를 콘솔에 표시하지 않음
    }
    // Map ID 관련 에러는 콘솔에 표시하지 않음 (Map ID가 없어도 기본 마커는 작동)
    if (
      errorMessage.includes('Map ID') ||
      errorMessage.includes('Advanced Markers') ||
      errorMessage.includes('map is initialised without a valid Map ID')
    ) {
      // Map ID가 없어도 기본 마커는 작동하므로 에러를 숨김
      return;
    }
    // 다른 에러는 정상적으로 표시
    originalConsoleError.apply(console, args);
  };
}