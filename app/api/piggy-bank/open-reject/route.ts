import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, requestId } = body;

    if (!groupId || !requestId) {
      return NextResponse.json({ error: 'groupId와 requestId가 필요합니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '거절 처리에 실패했습니다.';
    console.error('Piggy reject 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
