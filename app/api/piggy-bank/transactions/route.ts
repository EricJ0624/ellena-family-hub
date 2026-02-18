import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

// type → 한글 라벨 매핑
const WALLET_TYPE_LABELS: Record<string, string> = {
  allowance: '용돈 지급',
  spend: '지출',
  child_save: '저금통 저축',
  withdraw_to_wallet: '개봉 → 용돈 적립',
};

const BANK_TYPE_LABELS: Record<string, string> = {
  parent_deposit: '저축 입금',
  child_save: '저금통 저축',
  withdraw_to_wallet: '개봉(용돈 적립)',
  withdraw_cash: '개봉(현금 인출)',
};

// 날짜 포맷: "n월 n일"
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const childId = searchParams.get('child_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!groupId) {
      return NextResponse.json({ error: 'group_id가 필요합니다.' }, { status: 400 });
    }

    // 대상 사용자 결정: 관리자가 childId 지정하면 해당 아이, 아니면 본인
    const targetUserId = childId || user.id;

    // 권한 확인: 본인이거나 관리자만 조회 가능
    const permissionResult = await checkPermission(user.id, groupId, null, user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '그룹 멤버 권한이 필요합니다.' }, { status: 403 });
    }

    const isAdmin = permissionResult.role === 'ADMIN' || permissionResult.isOwner;
    
    // 관리자가 아니면 본인 것만 조회 가능
    if (!isAdmin && targetUserId !== user.id) {
      return NextResponse.json({ error: '다른 사용자의 거래 내역을 조회할 권한이 없습니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const safeLimit = Math.min(Math.max(limit, 1), 100); // 1~100 사이
    const safeOffset = Math.max(offset, 0);

    // 1. 용돈 거래 내역 조회
    const { data: walletTransactions, error: walletError } = await supabase
      .from('piggy_wallet_transactions')
      .select('id, amount, type, memo, created_at, actor_id')
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (walletError) {
      throw walletError;
    }

    // 2. 저금통 거래 내역 조회
    const { data: bankTransactions, error: bankError } = await supabase
      .from('piggy_bank_transactions')
      .select('id, amount, type, memo, created_at, actor_id')
      .eq('group_id', groupId)
      .eq('related_user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (bankError) {
      throw bankError;
    }

    // 3. actor_id 목록 수집 (닉네임 조회용)
    const actorIds = new Set<string>();
    (walletTransactions || []).forEach((tx) => actorIds.add(tx.actor_id));
    (bankTransactions || []).forEach((tx) => actorIds.add(tx.actor_id));

    // 4. 닉네임 조회
    let actorNicknames: Record<string, string> = {};
    if (actorIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', Array.from(actorIds));

      if (profiles) {
        profiles.forEach((p) => {
          actorNicknames[p.id] = p.nickname || '멤버';
        });
      }
    }

    // 5. 응답 데이터 포맷팅
    const formattedWalletTransactions = (walletTransactions || []).map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      typeLabel: WALLET_TYPE_LABELS[tx.type] || tx.type,
      memo: tx.memo,
      created_at: tx.created_at,
      dateLabel: formatDate(tx.created_at),
      actor_nickname: actorNicknames[tx.actor_id] || '멤버',
    }));

    const formattedBankTransactions = (bankTransactions || []).map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      typeLabel: BANK_TYPE_LABELS[tx.type] || tx.type,
      memo: tx.memo,
      created_at: tx.created_at,
      dateLabel: formatDate(tx.created_at),
      actor_nickname: actorNicknames[tx.actor_id] || '멤버',
    }));

    return NextResponse.json({
      success: true,
      data: {
        walletTransactions: formattedWalletTransactions,
        bankTransactions: formattedBankTransactions,
      },
    });
  } catch (error: any) {
    console.error('Piggy transactions 오류:', error);
    return NextResponse.json(
      { error: error.message || '거래 내역을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
