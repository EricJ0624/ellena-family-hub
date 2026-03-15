import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';

/** 초대 코드 형식: 영숫자 1~20자 (DB는 12자 생성) */
const INVITE_CODE_REGEX = /^[0-9A-Za-z]{1,20}$/;

/** IP별 요청 횟수 (레이트 리미트용, 메모리) */
const previewRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const RATE_LIMIT_MAX = 30; // 1분당 최대 30회

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = previewRateLimit.get(ip);
  if (!entry) {
    previewRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    previewRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

/**
 * 초대 코드로 그룹 미리보기 조회 (비멤버용).
 * 서버에서 service role로 groups 조회하여 RLS 우회.
 * - 로그인 사용자만 호출 가능.
 * - 초대코드 유효(존재·만료 아님)할 때만 id, name, invite_code, member_count 반환.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body?.invite_code === 'string' ? body.invite_code.trim() : '';
    if (!rawCode || !INVITE_CODE_REGEX.test(rawCode)) {
      return NextResponse.json(
        { error: '올바른 초대 코드를 입력해 주세요.' },
        { status: 400 }
      );
    }
    const inviteCode = rawCode;

    const supabase = getSupabaseServerClient();

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, invite_code, invite_code_expires_at')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (groupError || !group) {
      return NextResponse.json(
        { error: '올바른 초대 코드를 입력해 주세요.' },
        { status: 400 }
      );
    }

    if (group.invite_code_expires_at) {
      const expiresAt = new Date(group.invite_code_expires_at);
      if (expiresAt <= new Date()) {
        return NextResponse.json(
          { error: '올바른 초대 코드를 입력해 주세요.' },
          { status: 400 }
        );
      }
    }

    const { count } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id);

    return NextResponse.json({
      id: group.id,
      name: group.name,
      invite_code: group.invite_code,
      member_count: count ?? 0,
    });
  } catch (err) {
    console.error('초대 코드 미리보기 오류:', err);
    return NextResponse.json(
      { error: '올바른 초대 코드를 입력해 주세요.' },
      { status: 400 }
    );
  }
}
