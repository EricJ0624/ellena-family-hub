import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientForAccessToken, getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import { extractBearerToken, mapShortInviteRpcError } from '@/lib/group-short-invite';
import { normalizeGroupIdFromRpc } from '@/lib/validation';
import { notifyFamily } from '@/lib/notifications/notify';

type RouteContext = { params: Promise<{ id: string }> };

/** POST: 가입 요청 승인 → MEMBER */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await context.params;
    const requestId = id?.trim();
    if (!requestId) {
      return NextResponse.json({ error: 'request id가 필요합니다.' }, { status: 400 });
    }

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }

    const service = getSupabaseServerClient();
    const { data: before } = await service
      .from('group_join_requests')
      .select('id, group_id, requester_user_id, status, app_id')
      .eq('id', requestId)
      .maybeSingle();

    if (!before || before.app_id !== CURRENT_APP_ID) {
      return NextResponse.json({ error: '요청을 찾을 수 없습니다.', code: 'NOT_FOUND' }, { status: 404 });
    }

    const supabase = getSupabaseClientForAccessToken(token);
    const { data: groupIdRaw, error } = await supabase.rpc('approve_group_join_request', {
      p_request_id: requestId,
      p_app_id: CURRENT_APP_ID,
    });

    if (error) {
      const mapped = mapShortInviteRpcError(error.message || '');
      return NextResponse.json({ code: mapped.code }, { status: mapped.status });
    }

    const groupId = normalizeGroupIdFromRpc(groupIdRaw) || before.group_id;

    try {
      await notifyFamily({
        groupId,
        actorUserId: user.id,
        recipientUserIds: [String(before.requester_user_id)],
        widgetKey: 'group',
        eventType: 'GROUP_JOIN_RESOLVED',
        title: '그룹 가입 승인',
        body: '그룹 가입 요청이 승인되었습니다.',
        url: '/dashboard',
        entityId: requestId,
        payload: { requestId, status: 'approved' },
      });
    } catch (notifyErr) {
      console.warn('join approve notify:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      group_id: groupId,
      message: '가입 요청을 승인했습니다.',
    });
  } catch (err) {
    console.error('approve join-request:', err);
    return NextResponse.json({ error: '승인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
