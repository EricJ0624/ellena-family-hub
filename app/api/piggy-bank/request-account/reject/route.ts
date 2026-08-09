import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { notifyFamily } from '@/lib/notifications/notify';

/** 관리자 전용: 저금통 생성 요청 거절 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const requestId = body.requestId ?? body.request_id;

    if (!requestId) {
      return NextResponse.json({ error: 'requestId가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: reqRow, error: fetchError } = await supabase
      .from('piggy_account_requests')
      .select('id, group_id, user_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !reqRow) {
      return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, reqRow.group_id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('piggy_account_requests')
      .update({ status: 'rejected', updated_at: now })
      .eq('id', requestId);

    if (updateError) throw updateError;

    try {
      await notifyFamily({
        groupId: reqRow.group_id,
        actorUserId: user.id,
        recipientUserIds: [reqRow.user_id],
        widgetKey: 'piggy',
        eventType: 'PIGGY_ACCOUNT_RESOLVED',
        title: '🐷 저금통 거절',
        body: '저금통 생성 요청이 거절되었습니다.',
        url: '/piggy-bank',
        entityId: String(requestId),
      });
    } catch (notifyError) {
      console.warn('piggy account reject notify:', notifyError);
    }

    return NextResponse.json({
      success: true,
      data: { requestId, status: 'rejected' },
      message: '요청이 거절되었습니다.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '거절 처리에 실패했습니다.';
    console.error('Piggy account request reject 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
