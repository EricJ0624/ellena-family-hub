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
        if (!parsed?.refresh_token || typeof parsed.refresh_token !== 'string' || parsed.refresh_token.trim() === '') {
          localStorage.removeItem('sb-auth-token');
          if (process.env.NODE_ENV === 'development') {
            console.log('손상된 refresh_token 감지 - localStorage 정리됨');
          }
        }
        
        // access_token이 없거나 유효하지 않으면 정리
        if (!parsed?.access_token || typeof parsed.access_token !== 'string' || parsed.access_token.trim() === '') {
          localStorage.removeItem('sb-auth-token');
          if (process.env.NODE_ENV === 'development') {
            console.log('손상된 access_token 감지 - localStorage 정리됨');
          }
        }
      } catch (parseError) {
        // JSON 파싱 실패 = 손상된 데이터 → 정리
        localStorage.removeItem('sb-auth-token');
        if (process.env.NODE_ENV === 'development') {
          console.log('JSON 파싱 실패 - localStorage 정리됨');
        }
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
// 근본 원인 해결: refresh token 에러를 조용히 처리
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(async (event, session) => {
    // Refresh Token 에러가 발생한 경우 조용히 처리
    if (event === 'SIGNED_OUT' && !session) {
      // refresh token이 유효하지 않아서 자동 로그아웃된 경우
      // localStorage를 정리하고 조용히 처리 (에러 메시지 출력 안 함)
      try {
        localStorage.removeItem('sb-auth-token');
      } catch (error) {
        // localStorage 접근 실패는 무시
      }
      return; // 에러 메시지 출력하지 않고 조용히 처리
    }
    
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      if (process.env.NODE_ENV === 'development') {
        console.log('인증 상태 변경:', event);
      }
    }
  });
}