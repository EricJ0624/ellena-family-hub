import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientForAccessToken } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin, assertGroupBelongsToCurrentApp } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import {
  extractBearerToken,
  isShortInviteCode,
  mapShortInviteRpcError,
  GROUP_SHORT_INVITE_ERROR,
} from '@/lib/group-short-invite';

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

/** POST: 관리자가 입력한 4자리 초대 코드 등록 (기존 active 폐기) */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    if (!checkRateLimit(`create:${user.id}`)) {
      return NextResponse.json({ code: GROUP_SHORT_INVITE_ERROR.RATE_LIMITED }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const groupId = typeof body?.group_id === 'string' ? body.group_id.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!groupId) {
      return NextResponse.json({ code: GROUP_SHORT_INVITE_ERROR.UNKNOWN }, { status: 400 });
    }
    if (!isShortInviteCode(code)) {
      return NextResponse.json(
        { code: GROUP_SHORT_INVITE_ERROR.INVALID_OR_EXPIRED },
        { status: 400 },
      );
    }

    const appCheck = await assertGroupBelongsToCurrentApp(groupId);
    if (appCheck) return appCheck;

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ code: GROUP_SHORT_INVITE_ERROR.UNAUTHENTICATED }, { status: 401 });
    }

    const supabase = getSupabaseClientForAccessToken(token);
    const { data, error } = await supabase.rpc('create_group_short_invite_code', {
      p_group_id: groupId,
      p_app_id: CURRENT_APP_ID,
      p_code: code,
    });

    if (error) {
      console.error('create_group_short_invite_code:', error.message);
      const mapped = mapShortInviteRpcError(error.message || '');
      return NextResponse.json({ code: mapped.code }, { status: mapped.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('POST short-invite-codes:', err);
    return NextResponse.json({ code: GROUP_SHORT_INVITE_ERROR.UNKNOWN }, { status: 500 });
  }
}
