import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { ensurePiggyAccountForUser } from '@/lib/piggy-bank';

function parseAmount(raw: any): number | null {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(value)) return null;
  const amount = Math.floor(value);
  return amount > 0 ? amount : null;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
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

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();
    const account = await ensurePiggyAccountForUser(groupId, childId);

    const newBalance = account.balance + parsedAmount;
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('piggy_bank_accounts')
      .update({ balance: newBalance, updated_at: now })
      .eq('id', account.id);

    if (updateError) {
      throw updateError;
    }

    const { error: txError } = await supabase
      .from('piggy_bank_transactions')
      .insert({
        group_id: groupId,
        actor_id: user.id,
        related_user_id: childId,
        amount: parsedAmount,
        type: 'parent_deposit',
        memo: memo ? String(memo).trim().slice(0, 200) : null,
      });

    if (txError) {
      throw txError;
    }

    return NextResponse.json({
      success: true,
      data: { balance: newBalance },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저금통 입금에 실패했습니다.';
    console.error('Piggy parent deposit 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
