import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { getSupabaseServerClient } from '@/lib/api-helpers';

/** GET: 내 알림 목록 / PATCH: 읽음 처리 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || '30');
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30;
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === '1';

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', user.id)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', user.id)
      .eq('group_id', groupId)
      .is('read_at', null);

    return NextResponse.json({
      success: true,
      data: data || [],
      unreadCount: count ?? 0,
    });
  } catch (error) {
    console.error('GET /api/notifications:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '조회 실패' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    const markAll = body.markAll === true;
    const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => String(id)) : [];

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    let query = supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('recipient_user_id', user.id)
      .eq('group_id', groupId)
      .is('read_at', null);

    if (!markAll) {
      if (ids.length === 0) {
        return NextResponse.json({ error: 'ids 또는 markAll이 필요합니다.' }, { status: 400 });
      }
      query = query.in('id', ids);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/notifications:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '읽음 처리 실패' },
      { status: 500 },
    );
  }
}
