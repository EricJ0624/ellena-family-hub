import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

/** 멤버 전용: 저금통 생성 요청. 이미 pending이 있으면 무시. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = body.groupId ?? request.nextUrl.searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const { role, isOwner } = memberCheck;
    const isAdmin = role === 'ADMIN' || isOwner;
    if (isAdmin) {
      return NextResponse.json({ error: '관리자는 저금통 요청을 할 수 없습니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('piggy_account_requests')
      .upsert(
        {
          group_id: groupId,
          user_id: user.id,
          status: 'pending',
          updated_at: now,
        },
        { onConflict: 'group_id,user_id' }
      )
      .select('id, status')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, data: { alreadyRequested: true }, message: '이미 요청 중입니다.' });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || { id: null, status: 'pending' },
      message: '요청이 전달되었습니다.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저금통 요청에 실패했습니다.';
    console.error('Piggy account request 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
