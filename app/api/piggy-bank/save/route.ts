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

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, amount, memo, childId, asProxy } = body ?? {};

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
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
    if (target.isProxy) {
      const targetMember = await requireGroupMember(target.targetUserId, groupId);
      if (targetMember instanceof NextResponse) {
        return NextResponse.json({ error: '대상 사용자를 이 그룹에서 찾을 수 없습니다.' }, { status: 400 });
      }
    }

    const supabase = getSupabaseServerClient();
    const wallet = await ensurePiggyWallet(groupId, target.targetUserId);
    const account = await ensurePiggyAccountForUser(groupId, target.targetUserId);

    if (wallet.balance < parsedAmount) {
      return NextResponse.json({ error: '용돈 잔액이 부족합니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newWalletBalance = wallet.balance - parsedAmount;
    const newBankBalance = account.balance + parsedAmount;
    const memoText = withPiggyProxyMemo(memo, target.isProxy);

    const { error: walletError } = await supabase
      .from('piggy_wallets')
      .update({ balance: newWalletBalance, updated_at: now })
      .eq('id', wallet.id);
    if (walletError) throw walletError;

    const { error: bankError } = await supabase
      .from('piggy_bank_accounts')
      .update({ balance: newBankBalance, updated_at: now })
      .eq('id', account.id);
    if (bankError) throw bankError;

    const { error: walletTxError } = await supabase.from('piggy_wallet_transactions').insert({
      group_id: groupId,
      user_id: target.targetUserId,
      actor_id: target.actorUserId,
      amount: parsedAmount,
      type: 'child_save',
      memo: memoText,
    });
    if (walletTxError) throw walletTxError;

    const { error: bankTxError } = await supabase.from('piggy_bank_transactions').insert({
      group_id: groupId,
      actor_id: target.actorUserId,
      related_user_id: target.targetUserId,
      amount: parsedAmount,
      type: 'child_save',
      memo: memoText,
    });
    if (bankTxError) throw bankTxError;

    return NextResponse.json({
      success: true,
      data: {
        walletBalance: newWalletBalance,
        bankBalance: newBankBalance,
        isProxy: target.isProxy,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저금통 저축 처리에 실패했습니다.';
    console.error('Piggy save 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
