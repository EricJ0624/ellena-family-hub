import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import {
  ensurePiggyAccountForUser,
  ensurePiggyWallet,
  parsePiggyAmount,
  resolvePiggyProxyTarget,
  withPiggyProxyMemo,
} from '@/lib/piggy-bank';

/** 부모 대리: 저금통 개봉을 요청 없이 즉시 반영 (actor=부모, 잔고=아이). */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId, asProxy, amount, reason, destination } = body ?? {};

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const parsedAmount = parsePiggyAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json({ error: '유효한 금액을 입력해주세요.' }, { status: 400 });
    }
    if (destination !== 'wallet' && destination !== 'cash') {
      return NextResponse.json({ error: 'destination은 wallet 또는 cash여야 합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const isAdmin = memberCheck.role === 'ADMIN' || memberCheck.isOwner;
    if (!(asProxy === true || asProxy === 'true' || asProxy === 1)) {
      return NextResponse.json(
        { error: '개봉 즉시 실행은 부모 대리 입력(asProxy)에서만 가능합니다. 아이는 개봉 요청을 사용하세요.' },
        { status: 400 },
      );
    }
    const target = resolvePiggyProxyTarget({
      actorUserId: user.id,
      childId,
      asProxy: true,
      isAdmin,
    });
    if (!target.ok) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }
    const targetMember = await requireGroupMember(target.targetUserId, groupId);
    if (targetMember instanceof NextResponse) {
      return NextResponse.json({ error: '대상 사용자를 이 그룹에서 찾을 수 없습니다.' }, { status: 400 });
    }

    const account = await ensurePiggyAccountForUser(groupId, target.targetUserId);
    if (account.balance < parsedAmount) {
      return NextResponse.json({ error: '저금통 잔액이 부족합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();
    const newBankBalance = account.balance - parsedAmount;
    const memoText = withPiggyProxyMemo(
      reason || (destination === 'wallet' ? '저금통 개봉(용돈 적립)' : '저금통 개봉(현금 인출)'),
      true,
    );

    const { error: bankError } = await supabase
      .from('piggy_bank_accounts')
      .update({ balance: newBankBalance, updated_at: now })
      .eq('id', account.id);
    if (bankError) throw bankError;

    const bankType = destination === 'wallet' ? 'withdraw_to_wallet' : 'withdraw_cash';
    const { error: bankTxError } = await supabase.from('piggy_bank_transactions').insert({
      group_id: groupId,
      actor_id: target.actorUserId,
      related_user_id: target.targetUserId,
      amount: parsedAmount,
      type: bankType,
      memo: memoText,
    });
    if (bankTxError) throw bankTxError;

    let newWalletBalance: number | undefined;
    if (destination === 'wallet') {
      const wallet = await ensurePiggyWallet(groupId, target.targetUserId);
      newWalletBalance = wallet.balance + parsedAmount;
      const { error: walletError } = await supabase
        .from('piggy_wallets')
        .update({ balance: newWalletBalance, updated_at: now })
        .eq('id', wallet.id);
      if (walletError) throw walletError;

      const { error: walletTxError } = await supabase.from('piggy_wallet_transactions').insert({
        group_id: groupId,
        user_id: target.targetUserId,
        actor_id: target.actorUserId,
        amount: parsedAmount,
        type: 'withdraw_to_wallet',
        memo: memoText,
      });
      if (walletTxError) throw walletTxError;
    }

    return NextResponse.json({
      success: true,
      data: {
        bankBalance: newBankBalance,
        walletBalance: newWalletBalance,
        isProxy: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저금통 개봉(대리)에 실패했습니다.';
    console.error('Piggy open-execute 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
