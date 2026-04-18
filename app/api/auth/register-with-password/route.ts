import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';

/** 초대 코드 형식: 영숫자 1~20자 (DB는 12자 생성) */
const INVITE_CODE_REGEX = /^[0-9A-Za-z]{1,20}$/;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_PER_IP = 40;

const registerRateLimitByIp = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = registerRateLimitByIp.get(ip);
  if (!entry) {
    registerRateLimitByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    registerRateLimitByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_PER_IP;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function validateInviteIfPresent(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  inviteCode: string
): Promise<boolean> {
  if (!INVITE_CODE_REGEX.test(inviteCode)) return false;
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id')
    .eq('invite_code', inviteCode)
    .maybeSingle();
  if (groupError || !group) return false;
  const { data: inviteValid, error: validError } = await supabase.rpc('is_invite_code_valid', {
    invite_code_param: inviteCode,
  });
  return !validError && inviteValid === true;
}

/**
 * 클라이언트 signUp(확인 메일 발송) 대신 서비스 롤로 사용자 생성 → GoTrue 이메일 발송 한도(429) 회피.
 * 이메일은 즉시 확인된 것으로 생성(email_confirm: true). 클라이언트는 이후 signInWithPassword로 세션 획득.
 */
export async function POST(request: NextRequest) {
  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: 'server_signup_unavailable' }, { status: 503 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const nicknameRaw = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
  const inviteRaw =
    typeof body?.invite_code === 'string' && body.invite_code.trim()
      ? body.invite_code.trim()
      : '';

  if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 400 });
  }
  if (!nicknameRaw || nicknameRaw.length < 2 || nicknameRaw.length > 20) {
    return NextResponse.json({ error: 'invalid_nickname' }, { status: 400 });
  }

  if (inviteRaw) {
    const ok = await validateInviteIfPresent(supabase, inviteRaw);
    if (!ok) {
      return NextResponse.json({ error: 'invalid_invite' }, { status: 400 });
    }
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: emailRaw,
    password,
    email_confirm: true,
    user_metadata: {
      nickname: nicknameRaw,
      full_name: nicknameRaw,
    },
  });

  if (createError) {
    const msg = (createError.message || '').toLowerCase();
    const status = (createError as { status?: number }).status;
    if (
      status === 422 ||
      /already been registered|already registered|user already exists|duplicate/i.test(msg)
    ) {
      return NextResponse.json({ error: 'email_taken' }, { status: 409 });
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn('[register-with-password] createUser:', createError.message);
    }
    return NextResponse.json({ error: 'signup_failed' }, { status: 400 });
  }

  if (!created?.user?.id) {
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 });
  }

  try {
    await supabase.from('profiles').upsert(
      {
        id: created.user.id,
        email: emailRaw,
        nickname: nicknameRaw,
      },
      { onConflict: 'id' }
    );
  } catch {
    // 트리거(handle_new_user)가 이미 넣었을 수 있음 — 무시
  }

  return NextResponse.json({ ok: true });
}
