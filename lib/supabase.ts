import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 설정값을 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 설정이 누락되었을 경우를 대비한 안전 장치입니다.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 설정이 .env.local 파일에 누락되었습니다.');
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
});