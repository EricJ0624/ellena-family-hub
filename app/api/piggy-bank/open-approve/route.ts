import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccountForUser, ensurePiggyWallet } from '@/lib/piggy-bank';

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { groupId, requestId } = body;

    if (!groupId || !requestId) {
      return NextResponse.json({ error: 'groupId와 requestId가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, null, user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '그룹 멤버 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();

    const { data: requestData, error: requestError } = await supabase
      .from('piggy_open_requests')
      .select('id, group_id, child_id, amount, destination, status')
      .eq('id', requestId)
      .eq('group_id', groupId)
      .single();

    if (requestError || !requestData) {
      return NextResponse.json({ error: '요청 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (requestData.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }

    const isRequester = requestData.child_id === user.id;
    const isAdmin = permissionResult.role === 'ADMIN' || permissionResult.isOwner;

    if (isRequester) {
      return NextResponse.json({ error: '아이는 승인할 수 없습니다.' }, { status: 403 });
    }
    if (!isAdmin) {
      return NextResponse.json({ error: '승인 권한이 없습니다.' }, { status: 403 });
    }

    const { error: approvalError } = await supabase
      .from('piggy_open_approvals')
      .insert({
        request_id: requestData.id,
        approver_id: user.id,
        role: 'parent',
      });

    if (approvalError) {
      if (approvalError.message?.includes('duplicate') || approvalError.code === '23505') {
        return NextResponse.json({ error: '이미 승인했습니다.' }, { status: 400 });
      }
      throw approvalError;
    }

    const account = await ensurePiggyAccountForUser(groupId, requestData.child_id);
    if (account.balance < requestData.amount) {
      return NextResponse.json({ error: '저금통 잔액이 부족합니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newBankBalance = account.balance - requestData.amount;

    const { error: bankError } = await supabase
      .from('piggy_bank_accounts')
      .update({ balance: newBankBalance, updated_at: now })
      .eq('id', account.id);

    if (bankError) {
      throw bankError;
    }

    const bankType =
      requestData.destination === 'wallet' ? 'withdraw_to_wallet' : 'withdraw_cash';

    const { error: bankTxError } = await supabase
      .from('piggy_bank_transactions')
      .insert({
        group_id: groupId,
        actor_id: user.id,
        related_user_id: requestData.child_id,
        amount: requestData.amount,
        type: bankType,
        request_id: requestData.id,
        memo: requestData.destination === 'wallet' ? '저금통 개봉(용돈 적립)' : '저금통 개봉(현금 인출)',
      });

    if (bankTxError) {
      throw bankTxError;
    }

    if (requestData.destination === 'wallet') {
      const wallet = await ensurePiggyWallet(groupId, requestData.child_id);
      const newWalletBalance = wallet.balance + requestData.amount;

      const { error: walletError } = await supabase
        .from('piggy_wallets')
        .update({ balance: newWalletBalance, updated_at: now })
        .eq('id', wallet.id);

      if (walletError) {
        throw walletError;
      }

      const { error: walletTxError } = await supabase
        .from('piggy_wallet_transactions')
        .insert({
          group_id: groupId,
          user_id: requestData.child_id,
          actor_id: user.id,
          amount: requestData.amount,
          type: 'withdraw_to_wallet',
          request_id: requestData.id,
          memo: '저금통 개봉 적립',
        });

      if (walletTxError) {
        throw walletTxError;
      }
    }

    const { error: requestUpdateError } = await supabase
      .from('piggy_open_requests')
      .update({ status: 'approved', updated_at: now, resolved_at: now })
      .eq('id', requestData.id);

    if (requestUpdateError) {
      throw requestUpdateError;
    }

    return NextResponse.json({ success: true, data: { status: 'approved' } });
  } catch (error: any) {
    console.error('Piggy open approve 오류:', error);
    return NextResponse.json(
      { error: error.message || '승인 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
