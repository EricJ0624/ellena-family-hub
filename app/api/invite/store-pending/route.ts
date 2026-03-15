import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';

/** 초대 코드 형식: 영숫자 1~20자 */
const INVITE_CODE_REGEX = /^[0-9A-Za-z]{1,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const storeRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = storeRateLimit.get(ip);
  if (!entry) {
    storeRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    storeRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

/**
 * 가입 전 초대 코드를 이메일과 함께 임시 저장.
 * 초대 링크로 가입 시 signUp 직전에 호출하며, 이메일 인증 후 auth callback에서 조회·삭제.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const inviteCode = typeof body?.invite_code === 'string' ? body.invite_code.trim() : '';

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: '유효한 이메일을 입력해 주세요.' }, { status: 400 });
    }
    if (!inviteCode || !INVITE_CODE_REGEX.test(inviteCode)) {
      return NextResponse.json({ error: '유효한 초대 코드가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('pending_invite_signups')
      .upsert({ email, invite_code: inviteCode }, { onConflict: 'email' });

    if (error) {
      console.error('pending_invite_signups insert error:', error);
      return NextResponse.json(
        { error: '저장에 실패했습니다. 다시 시도해 주세요.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('store-pending invite error:', err);
    return NextResponse.json(
      { error: '저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
