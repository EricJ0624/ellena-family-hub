import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccountForUser } from '@/lib/piggy-bank';

/** 관리자 전용: 아이별 저금통 삭제 (해당 user의 piggy_wallets, piggy_bank_accounts 삭제) */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId') || searchParams.get('group_id');
    const childId = searchParams.get('childId') || searchParams.get('child_id');

    if (!groupId || !childId) {
      return NextResponse.json({ error: 'groupId와 childId가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const { data: account } = await supabase
      .from('piggy_bank_accounts')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', childId)
      .maybeSingle();

    if (account) {
      await supabase.from('piggy_wallets').delete().eq('group_id', groupId).eq('user_id', childId);
      const { error: delAcc } = await supabase.from('piggy_bank_accounts').delete().eq('id', account.id);
      if (delAcc) throw delAcc;
    }

    return NextResponse.json({ success: true, message: '저금통이 삭제되었습니다.' });
  } catch (error: any) {
    console.error('Piggy accounts delete 오류:', error);
    return NextResponse.json(
      { error: error.message || '저금통 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/** 관리자 전용: 아이별 저금통 추가(생성). 이미 있으면 기존 반환. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId } = body;

    if (!groupId || !childId) {
      return NextResponse.json({ error: 'groupId와 childId가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const account = await ensurePiggyAccountForUser(groupId, childId);

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    console.error('Piggy accounts create 오류:', error);
    return NextResponse.json(
      { error: error.message || '저금통 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
