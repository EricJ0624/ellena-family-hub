import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyWallet } from '@/lib/piggy-bank';

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
    const { groupId, childId, amount, memo } = body;

    if (!groupId || !childId) {
      return NextResponse.json({ error: 'groupId와 childId가 필요합니다.' }, { status: 400 });
    }

    const parsedAmount = parseAmount(amount);
    if (!parsedAmount) {
      return NextResponse.json({ error: '유효한 금액을 입력해주세요.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const wallet = await ensurePiggyWallet(groupId, childId);

    const newBalance = wallet.balance + parsedAmount;
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('piggy_wallets')
      .update({ balance: newBalance, updated_at: now })
      .eq('id', wallet.id);

    if (updateError) {
      throw updateError;
    }

    const { error: txError } = await supabase
      .from('piggy_wallet_transactions')
      .insert({
        group_id: groupId,
        user_id: childId,
        actor_id: user.id,
        amount: parsedAmount,
        type: 'allowance',
        memo: memo ? String(memo).trim().slice(0, 200) : null,
      });

    if (txError) {
      throw txError;
    }

    return NextResponse.json({
      success: true,
      data: { balance: newBalance },
    });
  } catch (error: any) {
    console.error('Piggy allowance 오류:', error);
    return NextResponse.json(
      { error: error.message || '용돈 지급에 실패했습니다.' },
      { status: 500 }
    );
  }
}
