import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import {
  getPiggyAccountForUserIfExists,
  getPiggySavingsAccountById,
  parsePiggyAmount,
} from '@/lib/piggy-bank';
import { notifyFamily } from '@/lib/notifications/notify';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId, savingsAccountId, amount, memo } = body ?? {};

    if (!groupId || !childId || !savingsAccountId) {
      return NextResponse.json(
        { error: 'groupId, childId, savingsAccountId가 필요합니다.' },
        { status: 400 },
      );
    }

    const parsedAmount = parsePiggyAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json({ error: '유효한 금액을 입력해주세요.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const piggy = await getPiggyAccountForUserIfExists(groupId, childId);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다. 먼저 저금통을 만들어 주세요.' }, { status: 400 });
    }

    const savings = await getPiggySavingsAccountById(groupId, String(savingsAccountId));
    if (!savings || savings.user_id !== childId) {
      return NextResponse.json({ error: '은행계좌를 찾을 수 없습니다.' }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const newBalance = savings.balance + parsedAmount;
    const now = new Date().toISOString();
    const memoText = memo ? String(memo).trim().slice(0, 200) : null;

    const { error: updateError } = await supabase
      .from('piggy_savings_accounts')
      .update({ balance: newBalance, updated_at: now })
      .eq('id', savings.id);
    if (updateError) throw updateError;

    const { error: txError } = await supabase.from('piggy_savings_transactions').insert({
      group_id: groupId,
      user_id: childId,
      actor_id: user.id,
      amount: parsedAmount,
      type: 'parent_deposit',
      memo: memoText,
      savings_account_id: savings.id,
    });
    if (txError) throw txError;

    try {
      await notifyFamily({
        groupId,
        actorUserId: user.id,
        recipientUserIds: [childId],
        widgetKey: 'piggy',
        eventType: 'PIGGY_DEPOSIT',
        title: '🏦 은행계좌 입금',
        body: '은행계좌에 입금되었습니다.',
        url: '/piggy-bank',
      });
    } catch (notifyError) {
      console.warn('piggy savings deposit notify:', notifyError);
    }

    return NextResponse.json({
      success: true,
      data: { balance: newBalance, savingsAccountId: savings.id },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '은행계좌 입금에 실패했습니다.';
    console.error('Piggy savings parent-deposit 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
