import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import {
  getPiggyAccountForUserIfExists,
  getPiggySavingsAccountById,
  parsePiggyAmount,
} from '@/lib/piggy-bank';
import { getGroupAdminUserIds, notifyFamily } from '@/lib/notifications/notify';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, savingsAccountId, amount, reason } = body ?? {};

    if (!groupId || !savingsAccountId) {
      return NextResponse.json({ error: 'groupId와 savingsAccountId가 필요합니다.' }, { status: 400 });
    }

    const parsedAmount = parsePiggyAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json({ error: '유효한 금액을 입력해주세요.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const piggy = await getPiggyAccountForUserIfExists(groupId, user.id);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다. 먼저 저금통을 만들어 주세요.' }, { status: 400 });
    }

    const savings = await getPiggySavingsAccountById(groupId, String(savingsAccountId));
    if (!savings || savings.user_id !== user.id) {
      return NextResponse.json({ error: '은행계좌를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (savings.balance < parsedAmount) {
      return NextResponse.json({ error: '은행계좌 잔액이 부족합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();
    const { data: requestData, error: requestError } = await supabase
      .from('piggy_savings_withdraw_requests')
      .insert({
        group_id: groupId,
        child_id: user.id,
        amount: parsedAmount,
        reason: reason ? String(reason).trim().slice(0, 200) : null,
        status: 'pending',
        savings_account_id: savings.id,
        created_at: now,
        updated_at: now,
      })
      .select('id, status')
      .single();

    if (requestError || !requestData) {
      throw requestError || new Error('은행 인출 요청 생성에 실패했습니다.');
    }

    try {
      const admins = await getGroupAdminUserIds(groupId, supabase);
      await notifyFamily({
        groupId,
        actorUserId: user.id,
        recipientUserIds: admins,
        widgetKey: 'piggy',
        eventType: 'PIGGY_OPEN_REQUEST',
        title: '🏦 은행 → 용돈 요청',
        body: '멤버가 은행계좌에서 용돈으로 인출을 요청했습니다.',
        url: '/piggy-bank',
        entityId: String(requestData.id),
      });
    } catch (notifyError) {
      console.warn('piggy savings withdraw request notify:', notifyError);
    }

    return NextResponse.json({ success: true, data: requestData });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '은행 인출 요청에 실패했습니다.';
    console.error('Piggy savings withdraw-request 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
