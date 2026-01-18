import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccount, ensurePiggyWallet } from '@/lib/piggy-bank';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json({ error: 'group_id가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, null, user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '그룹 멤버 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const account = await ensurePiggyAccount(groupId);
    const wallet = await ensurePiggyWallet(groupId, user.id);

    const { data: pendingRequests } = await supabase
      .from('piggy_open_requests')
      .select('id, child_id, amount, reason, destination, status, created_at')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      data: {
        role: permissionResult.role,
        isOwner: permissionResult.isOwner,
        account,
        wallet,
        pendingRequests: pendingRequests || [],
      },
    });
  } catch (error: any) {
    console.error('Piggy summary 오류:', error);
    return NextResponse.json(
      { error: error.message || '요약 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
