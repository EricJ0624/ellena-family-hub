import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/** 관리자 전용: 저금통 생성 요청 거절 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const requestId = body.requestId ?? body.request_id;

    if (!requestId) {
      return NextResponse.json({ error: 'requestId가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: reqRow, error: fetchError } = await supabase
      .from('piggy_account_requests')
      .select('id, group_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !reqRow) {
      return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, reqRow.group_id, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('piggy_account_requests')
      .update({ status: 'rejected', updated_at: now })
      .eq('id', requestId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: { requestId, status: 'rejected' },
      message: '요청이 거절되었습니다.',
    });
  } catch (error: any) {
    console.error('Piggy account request reject 오류:', error);
    return NextResponse.json(
      { error: error.message || '거절 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
