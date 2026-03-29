import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json({ error: 'group_id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { role, isOwner } = memberCheck;
    const isAdmin = role === 'ADMIN' || isOwner;

    let query = supabase
      .from('piggy_open_requests')
      .select('id, child_id, amount, reason, destination, status, created_at, updated_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!isAdmin) {
      query = query.eq('child_id', user.id);
    }

    const { data: requests, error } = await query;
    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data: requests || [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '요청 목록을 불러오지 못했습니다.';
    console.error('Piggy requests 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
