import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientForAccessToken, getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin, assertGroupBelongsToCurrentApp } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import {
  extractBearerToken,
  isShortInviteCode,
  mapShortInviteRpcError,
  GROUP_SHORT_INVITE_ERROR,
} from '@/lib/group-short-invite';
import { getGroupAdminUserIds, notifyFamily } from '@/lib/notifications/notify';

const joinRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = joinRateLimit.get(key);
  if (!entry || now >= entry.resetAt) {
    joinRateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_MAX;
}

/** GET: 그룹 pending 가입 요청 목록 (관리자) */
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

    const supabase = getSupabaseServerClient();
    const { data: requests, error } = await supabase
      .from('group_join_requests')
      .select('id, group_id, requester_user_id, status, created_at')
      .eq('group_id', groupId)
      .eq('app_id', CURRENT_APP_ID)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('list join-requests:', error);
      return NextResponse.json({ error: '가입 요청 조회에 실패했습니다.' }, { status: 500 });
    }

    const userIds = Array.from(
      new Set((requests || []).map((r) => String(r.requester_user_id)).filter(Boolean)),
    );

    let profileMap = new Map<string, { email: string | null; nickname: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds);
      profileMap = new Map(
        (profiles || []).map((p) => [
          String(p.id),
          {
            email: typeof p.email === 'string' ? p.email : null,
            nickname: typeof p.nickname === 'string' ? p.nickname : null,
          },
        ]),
      );
    }

    const data = (requests || []).map((r) => {
      const profile = profileMap.get(String(r.requester_user_id));
      return {
        id: r.id,
        group_id: r.group_id,
        requester_user_id: r.requester_user_id,
        status: r.status,
        created_at: r.created_at,
        email: profile?.email ?? null,
        nickname: profile?.nickname ?? null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('GET join-requests:', err);
    return NextResponse.json({ error: '가입 요청 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/** POST: 4자리 코드로 가입 요청 (즉시 멤버십 X) */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    if (!checkRateLimit(`join:${user.id}`)) {
      return NextResponse.json({ code: GROUP_SHORT_INVITE_ERROR.RATE_LIMITED }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!isShortInviteCode(code)) {
      return NextResponse.json(
        { code: GROUP_SHORT_INVITE_ERROR.INVALID_OR_EXPIRED },
        { status: 400 },
      );
    }

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ code: GROUP_SHORT_INVITE_ERROR.UNAUTHENTICATED }, { status: 401 });
    }

    const supabase = getSupabaseClientForAccessToken(token);
    const { data, error } = await supabase.rpc('request_join_by_short_invite_code', {
      p_code: code,
      p_app_id: CURRENT_APP_ID,
    });

    if (error) {
      const mapped = mapShortInviteRpcError(error.message || '');
      return NextResponse.json({ code: mapped.code }, { status: mapped.status });
    }

    const result = (data || {}) as {
      request_id?: string;
      group_id?: string;
      group_name?: string;
      status?: string;
    };

    if (result.group_id && result.request_id) {
      try {
        const adminIds = await getGroupAdminUserIds(result.group_id);
        const service = getSupabaseServerClient();
        const { data: profile } = await service
          .from('profiles')
          .select('nickname, email')
          .eq('id', user.id)
          .maybeSingle();
        const who =
          (typeof profile?.nickname === 'string' && profile.nickname.trim()) ||
          (typeof profile?.email === 'string' && profile.email.trim()) ||
          '사용자';

        await notifyFamily({
          groupId: result.group_id,
          actorUserId: user.id,
          recipientUserIds: adminIds,
          widgetKey: 'group',
          eventType: 'GROUP_JOIN_REQUEST',
          title: '그룹 가입 요청',
          body: `${who}님이 초대 코드로 가입을 요청했습니다.`,
          url: '/dashboard',
          entityId: String(result.request_id),
          payload: {
            requestId: result.request_id,
            action: 'approve_join',
            requesterUserId: user.id,
          },
          tag: `group-join-request:${result.request_id}`,
        });
      } catch (notifyErr) {
        console.warn('join request notify:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: '가입 요청이 전송되었습니다. 관리자 승인 후 가입됩니다.',
    });
  } catch (err) {
    console.error('POST join-requests:', err);
    return NextResponse.json({ error: '가입 요청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
