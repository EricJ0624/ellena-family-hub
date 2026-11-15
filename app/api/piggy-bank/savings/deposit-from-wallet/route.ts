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

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId, savingsAccountId, amount, memo, asProxy } = body ?? {};

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
    const wantsProxy = asProxy === true || asProxy === 'true' || asProxy === 1;
    const hasOtherChild =
      typeof childId === 'string' && childId.trim() !== '' && childId.trim() !== user.id;

    let targetUserId = user.id;
    let isProxy = false;

    if (wantsProxy || hasOtherChild) {
      if (!isAdmin) {
        return NextResponse.json({ error: '다른 사용자 용돈으로 예금할 권한이 없습니다.' }, { status: 403 });
      }
      const target = resolvePiggyProxyTarget({
        actorUserId: user.id,
        childId: childId || undefined,
        asProxy: true,
        isAdmin,
      });
      if (!target.ok) {
        return NextResponse.json({ error: target.error }, { status: target.status });
      }
      targetUserId = target.targetUserId;
      isProxy = true;
    }

    const targetMember = await requireGroupMember(targetUserId, groupId);
    if (targetMember instanceof NextResponse) {
      return NextResponse.json({ error: '대상 사용자를 이 그룹에서 찾을 수 없습니다.' }, { status: 400 });
    }

    const piggy = await getPiggyAccountForUserIfExists(groupId, targetUserId);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다. 먼저 저금통을 만들어 주세요.' }, { status: 400 });
    }

    const savings = await getPiggySavingsAccountById(groupId, String(savingsAccountId));
    if (!savings || savings.user_id !== targetUserId) {
      return NextResponse.json({ error: '은행계좌를 찾을 수 없습니다.' }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const wallet = await ensurePiggyWallet(groupId, targetUserId);

    if (wallet.balance < parsedAmount) {
      return NextResponse.json({ error: '용돈 잔액이 부족합니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newWalletBalance = wallet.balance - parsedAmount;
    const newSavingsBalance = savings.balance + parsedAmount;
    const memoText = withPiggyProxyMemo(memo, isProxy);

    const { error: walletError } = await supabase
      .from('piggy_wallets')
      .update({ balance: newWalletBalance, updated_at: now })
      .eq('id', wallet.id);
    if (walletError) throw walletError;

    const { error: savingsError } = await supabase
      .from('piggy_savings_accounts')
      .update({ balance: newSavingsBalance, updated_at: now })
      .eq('id', savings.id);
    if (savingsError) throw savingsError;

    const { error: walletTxError } = await supabase.from('piggy_wallet_transactions').insert({
      group_id: groupId,
      user_id: targetUserId,
      actor_id: user.id,
      amount: parsedAmount,
      type: 'deposit_to_savings',
      memo: memoText,
    });
    if (walletTxError) throw walletTxError;

    const { error: savingsTxError } = await supabase.from('piggy_savings_transactions').insert({
      group_id: groupId,
      user_id: targetUserId,
      actor_id: user.id,
      amount: parsedAmount,
      type: 'deposit_from_wallet',
      memo: memoText,
      savings_account_id: savings.id,
    });
    if (savingsTxError) throw savingsTxError;

    return NextResponse.json({
      success: true,
      data: {
        walletBalance: newWalletBalance,
        savingsBalance: newSavingsBalance,
        savingsAccountId: savings.id,
        isProxy,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '은행 예금에 실패했습니다.';
    console.error('Piggy savings deposit-from-wallet 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
