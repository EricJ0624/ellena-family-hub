import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import {
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
    const { groupId, amount, memo, category, childId, asProxy } = body ?? {};

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

    const wallet = await ensurePiggyWallet(groupId, target.targetUserId);
    if (wallet.balance < parsedAmount) {
      return NextResponse.json({ error: '용돈 잔액이 부족합니다.' }, { status: 400 });
    }

    const newBalance = wallet.balance - parsedAmount;
    const now = new Date().toISOString();
    const supabase = getSupabaseServerClient();

    const { error: updateError } = await supabase
      .from('piggy_wallets')
      .update({ balance: newBalance, updated_at: now })
      .eq('id', wallet.id);
    if (updateError) throw updateError;

    const memoText = withPiggyProxyMemo(
      [category, memo].filter(Boolean).join(' | ').trim() || null,
      target.isProxy,
    );
    const { error: txError } = await supabase.from('piggy_wallet_transactions').insert({
      group_id: groupId,
      user_id: target.targetUserId,
      actor_id: target.actorUserId,
      amount: parsedAmount,
      type: 'spend',
      memo: memoText,
    });
    if (txError) throw txError;

    return NextResponse.json({
      success: true,
      data: { balance: newBalance, isProxy: target.isProxy },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '지출 기록에 실패했습니다.';
    console.error('Piggy spend 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
