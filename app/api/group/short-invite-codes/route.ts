import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientForAccessToken } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin, assertGroupBelongsToCurrentApp } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import { extractBearerToken, mapShortInviteRpcError } from '@/lib/group-short-invite';

const createRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = createRateLimit.get(key);
  if (!entry || now >= entry.resetAt) {
    createRateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_MAX;
}

/** GET: 그룹의 활성 4자리 초대 코드 (관리자) */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() || '';
    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const appCheck = await assertGroupBelongsToCurrentApp(groupId);
    if (appCheck) return appCheck;

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }

    const supabase = getSupabaseClientForAccessToken(token);
    const { data, error } = await supabase.rpc('get_active_group_short_invite_code', {
      p_group_id: groupId,
      p_app_id: CURRENT_APP_ID,
    });

    if (error) {
      const mapped = mapShortInviteRpcError(error.message || '');
      return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
    }

    return NextResponse.json({ success: true, data: data ?? null });
  } catch (err) {
    console.error('GET short-invite-codes:', err);
    return NextResponse.json({ error: '초대 코드 조회에 실패했습니다.' }, { status: 500 });
  }
}

/** POST: 4자리 초대 코드 생성 (기존 active 폐기) */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    if (!checkRateLimit(`create:${user.id}`)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const groupId = typeof body?.group_id === 'string' ? body.group_id.trim() : '';
    if (!groupId) {
      return NextResponse.json({ error: 'group_id가 필요합니다.' }, { status: 400 });
    }

    const appCheck = await assertGroupBelongsToCurrentApp(groupId);
    if (appCheck) return appCheck;

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }

    const supabase = getSupabaseClientForAccessToken(token);
    const { data, error } = await supabase.rpc('create_group_short_invite_code', {
      p_group_id: groupId,
      p_app_id: CURRENT_APP_ID,
    });

    if (error) {
      const mapped = mapShortInviteRpcError(error.message || '');
      return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
    }

    return NextResponse.json({
      success: true,
      data,
      message: '초대 코드가 생성되었습니다. 24시간 동안 유효합니다.',
    });
  } catch (err) {
    console.error('POST short-invite-codes:', err);
    return NextResponse.json({ error: '초대 코드 생성에 실패했습니다.' }, { status: 500 });
  }
}
