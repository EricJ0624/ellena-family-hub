import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

const WALLET_TYPE_LABELS: Record<string, string> = {
  allowance: '용돈 지급',
  spend: '지출',
  child_save: '저금통 저축',
  withdraw_to_wallet: '개봉 → 용돈 적립',
};

const BANK_TYPE_LABELS: Record<string, string> = {
  parent_deposit: '저금통 입금',
  child_save: '저금통 저축',
  withdraw_to_wallet: '개봉(용돈 적립)',
  withdraw_cash: '개봉(현금 인출)',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
}

/** 그룹 관리자 전용: 해당 그룹의 삭제된 저금통 보관 내역 조회 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const snapshotId = searchParams.get('snapshot_id');

    if (!groupId) {
      return NextResponse.json({ error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '그룹 관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();

    if (snapshotId) {
      const { data: snapshot, error: snapErr } = await supabase
        .from('piggy_deleted_account_snapshots')
        .select('id, group_id')
        .eq('id', snapshotId)
        .eq('group_id', groupId)
        .maybeSingle();

      if (snapErr || !snapshot) {
        return NextResponse.json({ error: '해당 보관 내역을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
      }

      const { data: walletRows, error: we } = await supabase
        .from('piggy_wallet_transactions_archive')
        .select('id, amount, type, memo, created_at, actor_id')
        .eq('snapshot_id', snapshotId)
        .order('created_at', { ascending: false });

      if (we) throw we;

      const { data: bankRows, error: be } = await supabase
        .from('piggy_bank_transactions_archive')
        .select('id, amount, type, memo, created_at, actor_id')
        .eq('snapshot_id', snapshotId)
        .order('created_at', { ascending: false });

      if (be) throw be;

      const actorIds = new Set<string>();
      (walletRows || []).forEach((r) => actorIds.add(r.actor_id));
      (bankRows || []).forEach((r) => actorIds.add(r.actor_id));

      let actorNicknames: Record<string, string> = {};
      if (actorIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nickname')
          .in('id', Array.from(actorIds));
        (profiles || []).forEach((p) => {
          actorNicknames[p.id] = p.nickname || '멤버';
        });
      }

      const walletTransactions = (walletRows || []).map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        type: tx.type,
        typeLabel: WALLET_TYPE_LABELS[tx.type] || tx.type,
        memo: tx.memo,
        created_at: tx.created_at,
        dateLabel: formatDate(tx.created_at),
        actor_nickname: actorNicknames[tx.actor_id] || '멤버',
      }));

      const bankTransactions = (bankRows || []).map((tx) => ({
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
        data: { walletTransactions, bankTransactions },
      });
    }

    const { data: snapshots, error: snapErr } = await supabase
      .from('piggy_deleted_account_snapshots')
      .select('id, group_id, user_id, deleted_at, deleted_by, account_name')
      .eq('group_id', groupId)
      .order('deleted_at', { ascending: false })
      .limit(100);

    if (snapErr) throw snapErr;

    const userIds = new Set<string>();
    (snapshots || []).forEach((s) => {
      userIds.add(s.user_id);
      if (s.deleted_by) userIds.add(s.deleted_by);
    });

    let nicknames: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', Array.from(userIds));
      (profiles || []).forEach((p) => {
        nicknames[p.id] = p.nickname || '-';
      });
    }

    const list = (snapshots || []).map((s) => ({
      id: s.id,
      group_id: s.group_id,
      user_id: s.user_id,
      user_nickname: nicknames[s.user_id] || '-',
      deleted_at: s.deleted_at,
      deleted_by: s.deleted_by,
      deleted_by_nickname: s.deleted_by ? nicknames[s.deleted_by] || '-' : null,
      account_name: s.account_name,
    }));

    return NextResponse.json({
      success: true,
      data: { snapshots: list },
    });
  } catch (error: any) {
    console.error('Group admin piggy archives 오류:', error);
    return NextResponse.json(
      { error: error.message || '보관 내역 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
