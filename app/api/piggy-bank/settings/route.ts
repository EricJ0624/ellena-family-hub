import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { ensurePiggyAccountForUser } from '@/lib/piggy-bank';

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, name, childId } = body;

    if (!groupId || !name) {
      return NextResponse.json({ error: 'groupId와 name이 필요합니다.' }, { status: 400 });
    }

    const trimmed = String(name).trim().slice(0, 40);
    if (trimmed.length < 2) {
      return NextResponse.json({ error: '이름은 2자 이상이어야 합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const { role, isOwner } = memberCheck;
    const isAdmin = role === 'ADMIN' || isOwner;
    const targetUserId = childId && isAdmin ? childId : user.id;

    const supabase = getSupabaseServerClient();
    const account = await ensurePiggyAccountForUser(groupId, targetUserId);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('piggy_bank_accounts')
      .update({ name: trimmed, updated_at: now })
      .eq('id', account.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data: { name: trimmed } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저금통 이름 변경에 실패했습니다.';
    console.error('Piggy settings 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
