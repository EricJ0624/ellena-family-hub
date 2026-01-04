import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 설정값을 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 설정이 누락되었을 경우를 대비한 안전 장치입니다.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 설정이 .env.local 파일에 누락되었습니다.');
}

// Supabase 초기화 전에 localStorage의 손상된 세션 데이터 정리
// 근본 원인 해결: Supabase가 초기화될 때 유효하지 않은 세션 데이터로 인한 에러 방지
if (typeof window !== 'undefined') {
  try {
    const storedSession = localStorage.getItem('sb-auth-token');
    if (storedSession) {
      try {
        // 저장된 세션 데이터가 유효한 JSON인지 확인
        const parsed = JSON.parse(storedSession);
        
        // refresh_token이 없거나 유효하지 않으면 정리
        if (!parsed?.refresh_token || typeof parsed.refresh_token !== 'string') {
          localStorage.removeItem('sb-auth-token');
        }
        
        // access_token이 없거나 유효하지 않으면 정리
        if (!parsed?.access_token || typeof parsed.access_token !== 'string') {
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

// 이 supabase 객체를 통해 DB에 접근합니다.
// 브라우저에서 세션을 유지하기 위해 auth 옵션 명시
// 세션 지속 시간: Supabase 대시보드에서 JWT 만료 시간을 24시간(86400초)으로 설정해야 합니다.
// Settings > Authentication > JWT expiry time을 86400으로 설정하세요.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // 세션을 localStorage에 저장하여 하루 동안 유지
    autoRefreshToken: true, // 토큰 자동 갱신 (세션 지속)
    detectSessionInUrl: true, // URL에서 세션 감지 (비밀번호 재설정 등)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined, // localStorage 사용
    storageKey: 'sb-auth-token', // 세션 저장 키
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
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      if (process.env.NODE_ENV === 'development') {
        console.log('인증 상태 변경:', event);
      }
    }
    
    if (event === 'SIGNED_OUT') {
      if (process.env.NODE_ENV === 'development') {
        console.log('사용자 로그아웃됨');
      }
    }
  });
}