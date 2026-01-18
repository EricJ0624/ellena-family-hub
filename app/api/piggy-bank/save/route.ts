import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccount, ensurePiggyWallet } from '@/lib/piggy-bank';

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
    const { groupId, amount, memo } = body;

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const parsedAmount = parseAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json({ error: '유효한 금액을 입력해주세요.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, null, user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '그룹 멤버 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const wallet = await ensurePiggyWallet(groupId, user.id);
    const account = await ensurePiggyAccount(groupId);

    if (wallet.balance < parsedAmount) {
      return NextResponse.json({ error: '용돈 잔액이 부족합니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newWalletBalance = wallet.balance - parsedAmount;
    const newBankBalance = account.balance + parsedAmount;

    const { error: walletError } = await supabase
      .from('piggy_wallets')
      .update({ balance: newWalletBalance, updated_at: now })
      .eq('id', wallet.id);

    if (walletError) {
      throw walletError;
    }

    const { error: bankError } = await supabase
      .from('piggy_bank_accounts')
      .update({ balance: newBankBalance, updated_at: now })
      .eq('id', account.id);

    if (bankError) {
      throw bankError;
    }

    const memoText = memo ? String(memo).trim().slice(0, 200) : null;
    const { error: walletTxError } = await supabase
      .from('piggy_wallet_transactions')
      .insert({
        group_id: groupId,
        user_id: user.id,
        actor_id: user.id,
        amount: parsedAmount,
        type: 'child_save',
        memo: memoText,
      });

    if (walletTxError) {
      throw walletTxError;
    }

    const { error: bankTxError } = await supabase
      .from('piggy_bank_transactions')
      .insert({
        group_id: groupId,
        actor_id: user.id,
        related_user_id: user.id,
        amount: parsedAmount,
        type: 'child_save',
        memo: memoText,
      });

    if (bankTxError) {
      throw bankTxError;
    }

    return NextResponse.json({
      success: true,
      data: { walletBalance: newWalletBalance, bankBalance: newBankBalance },
    });
  } catch (error: any) {
    console.error('Piggy save 오류:', error);
    return NextResponse.json(
      { error: error.message || '저축 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
