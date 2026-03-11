import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

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

/** 시스템 관리자 전용: 삭제된 저금통 보관 내역 조회 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: '시스템 관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const snapshotId = searchParams.get('snapshot_id');
    const groupId = searchParams.get('group_id');

    const supabase = getSupabaseServerClient();

    if (snapshotId) {
      // 특정 스냅샷의 용돈/저금통 거래 내역 조회
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

    // 삭제된 저금통 스냅샷 목록 (group_id 선택 시 필터)
    let q = supabase
      .from('piggy_deleted_account_snapshots')
      .select('id, group_id, user_id, deleted_at, deleted_by, account_name')
      .order('deleted_at', { ascending: false })
      .limit(100);

    if (groupId) {
      q = q.eq('group_id', groupId);
    }

    const { data: snapshots, error: snapErr } = await q;

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

    const groupIds = [...new Set((snapshots || []).map((s) => s.group_id))];
    let groupNames: Record<string, string> = {};
    if (groupIds.length > 0) {
      const { data: groups } = await supabase.from('groups').select('id, name').in('id', groupIds);
      (groups || []).forEach((g) => {
        groupNames[g.id] = g.name || '-';
      });
    }

    const list = (snapshots || []).map((s) => ({
      id: s.id,
      group_id: s.group_id,
      group_name: groupNames[s.group_id] || '-',
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
    console.error('Piggy archives 오류:', error);
    return NextResponse.json(
      { error: error.message || '보관 내역 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
