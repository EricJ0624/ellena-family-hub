import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import {
  advanceInterestOn,
  calculateMonthlyInterest,
  getPiggyAccountForUserIfExists,
  getPiggySavingsAccountById,
} from '@/lib/piggy-bank';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId, savingsAccountId } = body ?? {};

    if (!groupId || !childId || !savingsAccountId) {
      return NextResponse.json(
        { error: 'groupId, childId, savingsAccountId가 필요합니다.' },
        { status: 400 },
      );
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
    const { gross, tax, net } = calculateMonthlyInterest(
      savings.balance,
      savings.annual_interest_rate_bps,
      savings.tax_rate_bps,
    );

    if (gross <= 0) {
      return NextResponse.json(
        { error: '적용할 이자가 없습니다. 잔액 또는 이율을 확인해 주세요.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const newBalance = savings.balance + net;
    const nextOn = advanceInterestOn(savings.next_interest_on, savings.interest_day);
    const memo =
      tax > 0 ? `세전 ${gross} / 세금 ${tax} / 세후 ${net}` : `이자 ${net}`;

    const { error: updateError } = await supabase
      .from('piggy_savings_accounts')
      .update({
        balance: newBalance,
        next_interest_on: nextOn,
        updated_at: now,
      })
      .eq('id', savings.id);
    if (updateError) throw updateError;

    if (net > 0) {
      const { error: txError } = await supabase.from('piggy_savings_transactions').insert({
        group_id: groupId,
        user_id: childId,
        actor_id: user.id,
        amount: net,
        type: 'interest',
        memo,
        gross_amount: gross,
        tax_amount: tax,
        rate_bps_snapshot: savings.annual_interest_rate_bps,
        tax_rate_bps_snapshot: savings.tax_rate_bps,
        savings_account_id: savings.id,
      });
      if (txError) throw txError;
    }

    return NextResponse.json({
      success: true,
      data: {
        balance: newBalance,
        gross,
        tax,
        net,
        nextInterestOn: nextOn,
        credited: net > 0,
        savingsAccountId: savings.id,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '이자 적용에 실패했습니다.';
    console.error('Piggy savings apply-interest 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
