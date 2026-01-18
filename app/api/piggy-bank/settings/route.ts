import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccount } from '@/lib/piggy-bank';

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { groupId, name } = body;

    if (!groupId || !name) {
      return NextResponse.json({ error: 'groupId와 name이 필요합니다.' }, { status: 400 });
    }

    const trimmed = String(name).trim().slice(0, 40);
    if (trimmed.length < 2) {
      return NextResponse.json({ error: '이름은 2자 이상이어야 합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const account = await ensurePiggyAccount(groupId);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('piggy_bank_accounts')
      .update({ name: trimmed, updated_at: now })
      .eq('id', account.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data: { name: trimmed } });
  } catch (error: any) {
    console.error('Piggy settings 오류:', error);
    return NextResponse.json(
      { error: error.message || '저금통 이름 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
