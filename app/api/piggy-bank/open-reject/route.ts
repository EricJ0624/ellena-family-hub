import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { groupId, requestId } = body;

    if (!groupId || !requestId) {
      return NextResponse.json({ error: 'groupId와 requestId가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('piggy_open_requests')
      .update({
        status: 'rejected',
        updated_at: now,
        resolved_at: now,
      })
      .eq('id', requestId)
      .eq('group_id', groupId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Piggy reject 오류:', error);
    return NextResponse.json(
      { error: error.message || '거절 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
