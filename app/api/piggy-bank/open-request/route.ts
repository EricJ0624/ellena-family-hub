import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccountForUser } from '@/lib/piggy-bank';

function parseAmount(raw: any): number | null {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(value)) return null;
  const amount = Math.floor(value);
  return amount > 0 ? amount : null;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { groupId, amount, reason, destination } = body;

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const parsedAmount = parseAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json({ error: '유효한 금액을 입력해주세요.' }, { status: 400 });
    }

    if (destination !== 'wallet' && destination !== 'cash') {
      return NextResponse.json({ error: 'destination은 wallet 또는 cash여야 합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, null, user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '그룹 멤버 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const account = await ensurePiggyAccountForUser(groupId, user.id);
    if (account.balance < parsedAmount) {
      return NextResponse.json({ error: '저금통 잔액이 부족합니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: requestData, error: requestError } = await supabase
      .from('piggy_open_requests')
      .insert({
        group_id: groupId,
        child_id: user.id,
        amount: parsedAmount,
        reason: reason ? String(reason).trim().slice(0, 200) : null,
        destination,
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select('id, status')
      .single();

    if (requestError || !requestData) {
      throw requestError || new Error('개봉 요청 생성에 실패했습니다.');
    }

    return NextResponse.json({
      success: true,
      data: requestData,
    });
  } catch (error: any) {
    console.error('Piggy open request 오류:', error);
    return NextResponse.json(
      { error: error.message || '개봉 요청에 실패했습니다.' },
      { status: 500 }
    );
  }
}
