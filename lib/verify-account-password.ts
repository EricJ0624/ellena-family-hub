import { createClient } from '@supabase/supabase-js';

/**
 * 민감 작업용 본인 비밀번호 확인.
 * 로그인 페이지의 signIn 흐름은 바꾸지 않고, 일회성 anon 클라이언트로만 검증한다.
 * 검증에 생긴 세션은 현재 브라우저 로그인(다른 세션)을 유지한 채 이 세션만 종료한다.
 */
export async function verifyAccountPassword(params: {
  email: string;
  password: string;
  expectedUserId: string;
}): Promise<boolean> {
  const email = params.email.trim();
  const password = params.password;
  if (!email || !password) return false;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase 설정이 누락되었습니다.');
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  try {
    if (error || !data.user) return false;
    return data.user.id === params.expectedUserId;
  } finally {
    const accessToken = data.session?.access_token;
    if (accessToken) {
      try {
        await fetch(`${supabaseUrl}/auth/v1/logout?scope=local`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
        });
      } catch {
        // 세션 종료 실패해도 검증 결과는 유지한다.
      }
    }
    await client.auth.signOut({ scope: 'local' });
  }
}
