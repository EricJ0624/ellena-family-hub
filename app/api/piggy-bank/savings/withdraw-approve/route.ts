import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import {
  ensurePiggyWallet,
  getPiggyAccountForUserIfExists,
  getPiggySavingsAccountById,
} from '@/lib/piggy-bank';
import { notifyFamily } from '@/lib/notifications/notify';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, requestId } = body ?? {};

    if (!groupId || !requestId) {
      return NextResponse.json({ error: 'groupId와 requestId가 필요합니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();
    const { data: requestData, error: requestError } = await supabase
      .from('piggy_savings_withdraw_requests')
      .select('id, group_id, child_id, amount, status, savings_account_id')
      .eq('id', requestId)
      .eq('group_id', groupId)
      .single();

    if (requestError || !requestData) {
      return NextResponse.json({ error: '요청 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (requestData.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }
    if (requestData.child_id === user.id) {
      return NextResponse.json({ error: '본인 요청은 승인할 수 없습니다.' }, { status: 403 });
    }
    if (!requestData.savings_account_id) {
      return NextResponse.json({ error: '요청에 은행계좌가 없습니다.' }, { status: 400 });
    }

    const piggy = await getPiggyAccountForUserIfExists(groupId, requestData.child_id);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다.' }, { status: 400 });
    }

    const savings = await getPiggySavingsAccountById(groupId, requestData.savings_account_id);
    if (!savings || savings.user_id !== requestData.child_id) {
      return NextResponse.json({ error: '은행계좌를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (savings.balance < requestData.amount) {
      return NextResponse.json({ error: '은행계좌 잔액이 부족합니다.' }, { status: 400 });
    }

    const wallet = await ensurePiggyWallet(groupId, requestData.child_id);
    const now = new Date().toISOString();
    const newSavingsBalance = savings.balance - requestData.amount;
    const newWalletBalance = wallet.balance + requestData.amount;

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
      user_id: requestData.child_id,
      actor_id: user.id,
      amount: requestData.amount,
      type: 'withdraw_to_wallet',
      memo: '은행 → 용돈 (승인)',
      request_id: requestData.id,
      savings_account_id: savings.id,
    });
    if (savingsTxError) throw savingsTxError;

    const { error: walletTxError } = await supabase.from('piggy_wallet_transactions').insert({
      group_id: groupId,
      user_id: requestData.child_id,
      actor_id: user.id,
      amount: requestData.amount,
      type: 'withdraw_from_savings',
      request_id: requestData.id,
      memo: '은행 인출 적립',
    });
    if (walletTxError) throw walletTxError;

    const { error: requestUpdateError } = await supabase
      .from('piggy_savings_withdraw_requests')
      .update({
        status: 'approved',
        updated_at: now,
        resolved_at: now,
        resolved_by: user.id,
      })
      .eq('id', requestData.id);
    if (requestUpdateError) throw requestUpdateError;

    try {
      await notifyFamily({
        groupId,
        actorUserId: user.id,
        recipientUserIds: [requestData.child_id],
        widgetKey: 'piggy',
        eventType: 'PIGGY_OPEN_RESOLVED',
        title: '🏦 은행 인출 승인',
        body: '은행 → 용돈 요청이 승인되었습니다.',
        url: '/piggy-bank',
        entityId: String(requestData.id),
      });
    } catch (notifyError) {
      console.warn('piggy savings withdraw approve notify:', notifyError);
    }

    return NextResponse.json({
      success: true,
      data: {
        walletBalance: newWalletBalance,
        savingsBalance: newSavingsBalance,
        savingsAccountId: savings.id,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '은행 인출 승인에 실패했습니다.';
    console.error('Piggy savings withdraw-approve 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
