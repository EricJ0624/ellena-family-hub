import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { notifyFamily } from '@/lib/notifications/notify';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, requestId } = body ?? {};

    if (!groupId || !requestId) {
      return NextResponse.json({ error: 'groupId와 requestId가 필요합니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    const { data: reqRow } = await supabase
      .from('piggy_savings_withdraw_requests')
      .select('id, child_id, status')
      .eq('id', requestId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (!reqRow) {
      return NextResponse.json({ error: '요청 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('piggy_savings_withdraw_requests')
      .update({
        status: 'rejected',
        updated_at: now,
        resolved_at: now,
        resolved_by: user.id,
      })
      .eq('id', requestId)
      .eq('group_id', groupId);
    if (error) throw error;

    if (reqRow.child_id) {
      try {
        await notifyFamily({
          groupId,
          actorUserId: user.id,
          recipientUserIds: [reqRow.child_id],
          widgetKey: 'piggy',
          eventType: 'PIGGY_OPEN_RESOLVED',
          title: '🏦 은행 인출 거절',
          body: '은행 → 용돈 요청이 거절되었습니다.',
          url: '/piggy-bank',
          entityId: String(requestId),
        });
      } catch (notifyError) {
        console.warn('piggy savings withdraw reject notify:', notifyError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '거절 처리에 실패했습니다.';
    console.error('Piggy savings withdraw-reject 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
