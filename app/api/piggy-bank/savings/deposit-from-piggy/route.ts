import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import {
  getPiggyAccountForUserIfExists,
  getPiggySavingsAccountById,
  parsePiggyAmount,
  resolvePiggyProxyTarget,
  withPiggyProxyMemo,
} from '@/lib/piggy-bank';

/** 저금통 → 은행 예금. 본인 즉시 또는 부모 대리(asProxy+childId). */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId, asProxy, savingsAccountId, amount, memo } = body ?? {};

    if (!groupId || !savingsAccountId) {
      return NextResponse.json({ error: 'groupId와 savingsAccountId가 필요합니다.' }, { status: 400 });
    }

    const parsedAmount = parsePiggyAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json({ error: '유효한 금액을 입력해주세요.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const isAdmin = memberCheck.role === 'ADMIN' || memberCheck.isOwner;
    const target = resolvePiggyProxyTarget({
      actorUserId: user.id,
      childId,
      asProxy,
      isAdmin,
    });
    if (!target.ok) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    const targetUserId = target.targetUserId;
    const isProxy = target.isProxy;
    if (isProxy) {
      const targetMember = await requireGroupMember(targetUserId, groupId);
      if (targetMember instanceof NextResponse) {
        return NextResponse.json({ error: '대상 사용자를 이 그룹에서 찾을 수 없습니다.' }, { status: 400 });
      }
    }

    const piggy = await getPiggyAccountForUserIfExists(groupId, targetUserId);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다.' }, { status: 400 });
    }
    if (piggy.balance < parsedAmount) {
      return NextResponse.json({ error: '저금통 잔액이 부족합니다.' }, { status: 400 });
    }

    const savings = await getPiggySavingsAccountById(groupId, String(savingsAccountId));
    if (!savings || savings.user_id !== targetUserId) {
      return NextResponse.json({ error: '은행계좌를 찾을 수 없습니다.' }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();
    const newPiggyBalance = piggy.balance - parsedAmount;
    const newSavingsBalance = savings.balance + parsedAmount;
    const memoText = withPiggyProxyMemo(memo || '저금통 → 은행', isProxy);

    const { error: piggyError } = await supabase
      .from('piggy_bank_accounts')
      .update({ balance: newPiggyBalance, updated_at: now })
      .eq('id', piggy.id);
    if (piggyError) throw piggyError;

    const { error: savingsError } = await supabase
      .from('piggy_savings_accounts')
      .update({ balance: newSavingsBalance, updated_at: now })
      .eq('id', savings.id);
    if (savingsError) throw savingsError;

    const { error: bankTxError } = await supabase.from('piggy_bank_transactions').insert({
      group_id: groupId,
      actor_id: user.id,
      related_user_id: targetUserId,
      amount: parsedAmount,
      type: 'deposit_to_savings',
      memo: memoText,
    });
    if (bankTxError) throw bankTxError;

    const { error: savingsTxError } = await supabase.from('piggy_savings_transactions').insert({
      group_id: groupId,
      user_id: targetUserId,
      actor_id: user.id,
      amount: parsedAmount,
      type: 'deposit_from_piggy',
      memo: memoText,
      savings_account_id: savings.id,
    });
    if (savingsTxError) throw savingsTxError;

    return NextResponse.json({
      success: true,
      data: {
        piggyBalance: newPiggyBalance,
        savingsBalance: newSavingsBalance,
        savingsAccountId: savings.id,
        isProxy,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저금통 → 은행 예금에 실패했습니다.';
    console.error('Piggy deposit-from-piggy 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
