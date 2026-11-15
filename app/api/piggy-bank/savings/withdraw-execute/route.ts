import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import {
  ensurePiggyWallet,
  getPiggyAccountForUserIfExists,
  getPiggySavingsAccountById,
  parsePiggyAmount,
  resolvePiggyProxyTarget,
  withPiggyProxyMemo,
} from '@/lib/piggy-bank';

/** 부모 대리: 은행 → 용돈 즉시 인출 (요청/승인 생략). */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId, asProxy, savingsAccountId, amount, reason } = body ?? {};

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
    if (!(asProxy === true || asProxy === 'true' || asProxy === 1)) {
      return NextResponse.json(
        { error: '은행 즉시 인출은 부모 대리 입력(asProxy)에서만 가능합니다. 아이는 출금 요청을 사용하세요.' },
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

    const piggy = await getPiggyAccountForUserIfExists(groupId, target.targetUserId);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다.' }, { status: 400 });
    }

    const savings = await getPiggySavingsAccountById(groupId, String(savingsAccountId));
    if (!savings || savings.user_id !== target.targetUserId) {
      return NextResponse.json({ error: '은행계좌를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (savings.balance < parsedAmount) {
      return NextResponse.json({ error: '은행계좌 잔액이 부족합니다.' }, { status: 400 });
    }

    const wallet = await ensurePiggyWallet(groupId, target.targetUserId);
    const now = new Date().toISOString();
    const newSavingsBalance = savings.balance - parsedAmount;
    const newWalletBalance = wallet.balance + parsedAmount;
    const memoText = withPiggyProxyMemo(reason || '은행 → 용돈', true);
    const supabase = getSupabaseServerClient();

    const { error: savingsError } = await supabase
      .from('piggy_savings_accounts')
      .update({ balance: newSavingsBalance, updated_at: now })
      .eq('id', savings.id);
    if (savingsError) throw savingsError;

    const { error: walletError } = await supabase
      .from('piggy_wallets')
      .update({ balance: newWalletBalance, updated_at: now })
      .eq('id', wallet.id);
    if (walletError) throw walletError;

    const { error: savingsTxError } = await supabase.from('piggy_savings_transactions').insert({
      group_id: groupId,
      user_id: target.targetUserId,
      actor_id: target.actorUserId,
      amount: parsedAmount,
      type: 'withdraw_to_wallet',
      memo: memoText,
      savings_account_id: savings.id,
    });
    if (savingsTxError) throw savingsTxError;

    const { error: walletTxError } = await supabase.from('piggy_wallet_transactions').insert({
      group_id: groupId,
      user_id: target.targetUserId,
      actor_id: target.actorUserId,
      amount: parsedAmount,
      type: 'withdraw_from_savings',
      memo: memoText,
    });
    if (walletTxError) throw walletTxError;

    return NextResponse.json({
      success: true,
      data: {
        walletBalance: newWalletBalance,
        savingsBalance: newSavingsBalance,
        savingsAccountId: savings.id,
        isProxy: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '은행 인출(대리)에 실패했습니다.';
    console.error('Piggy savings withdraw-execute 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
