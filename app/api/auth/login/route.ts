import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeAuthBootstrap } from '@/lib/auth-bootstrap-server';
import type { AuthLoginSuccess } from '@/lib/auth-bootstrap';

export const dynamic = 'force-dynamic';

/**
 * 모바일에서 브라우저→Supabase Auth(cross-origin) POST가 끊기는 문제를 피한다.
 * 같은 출처(Vercel)로 로그인하면 서버가 GoTrue password grant + bootstrap을 한 번에 수행한다.
 */
export async function POST(request: NextRequest) {
  let email = '';
  let password = '';
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: 'invalid_credentials', message: 'Invalid login credentials' },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error('auth login: Supabase env 누락');
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  try {
    // anon 키로 password grant — GoTrue rate limit·정책을 그대로 따름 (service role 우회 없음)
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      const status =
        typeof error.status === 'number' && error.status >= 400 && error.status < 600
          ? error.status
          : 401;
      return NextResponse.json(
        {
          error: error.message || 'login_failed',
          code: error.code || undefined,
          message: error.message,
        },
        { status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!data.session?.access_token || !data.session.refresh_token || !data.user) {
      return NextResponse.json(
        { error: 'login_failed', message: 'No session' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!data.user.email_confirmed_at) {
      try {
        await authClient.auth.signOut();
      } catch {
        // ignore
      }
      return NextResponse.json(
        { error: 'email_not_confirmed', code: 'email_not_confirmed' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const bootstrap = await computeAuthBootstrap({
      id: data.user.id,
      email: data.user.email,
      email_confirmed_at: data.user.email_confirmed_at,
    });

    const payload: AuthLoginSuccess = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in ?? 3600,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        email_confirmed_at: data.user.email_confirmed_at,
      },
      bootstrap,
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('auth login 오류:', error);
    return NextResponse.json(
      { error: 'login_failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
