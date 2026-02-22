import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccountForUser, ensurePiggyWallet, getPiggyAccountForUserIfExists, getPiggyWalletForUserIfExists, getGroupMembers } from '@/lib/piggy-bank';

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

    if (!groupId) {
      return NextResponse.json({ error: 'group_id가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, null, user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '그룹 멤버 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const isAdmin = permissionResult.role === 'ADMIN' || permissionResult.isOwner;

    if (isAdmin && childId) {
      // 관리자가 특정 아이 조회 시: 있으면 반환(잔고 0 포함), 없으면 null (저금통 추가 버튼용)
      const account = await getPiggyAccountForUserIfExists(groupId, childId);
      const wallet = account ? await ensurePiggyWallet(groupId, childId) : null;
      
      let ownerNickname: string | null = null;
      if (account?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', account.user_id)
          .single();
        ownerNickname = profile?.nickname || null;
      }
      
      const { data: pendingRequests } = await supabase
        .from('piggy_open_requests')
        .select('id, child_id, amount, reason, destination, status, created_at')
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      return NextResponse.json({
        success: true,
        data: {
          role: permissionResult.role,
          isOwner: permissionResult.isOwner,
          account: account ? { ...account, ownerNickname } : null,
          wallet,
          pendingRequests: pendingRequests || [],
        },
      });
    }

    if (isAdmin && !childId) {
      // 관리자 대시보드: 모든 MEMBER 멤버 목록 + 각자 저금통 유무/잔고 (생성하지 않음)
      const members = await getGroupMembers(groupId);
      const memberList = members.filter(m => m.role === 'MEMBER');
      
      const memberPiggies = await Promise.all(
        memberList.map(async (member) => {
          const account = await getPiggyAccountForUserIfExists(groupId, member.user_id);
          if (!account) {
            return { user_id: member.user_id, ownerNickname: member.nickname || null, noAccount: true as const };
          }
          const wallet = await ensurePiggyWallet(groupId, member.user_id);
          return {
            id: account.id,
            user_id: account.user_id,
            ownerNickname: member.nickname || null,
            name: account.name,
            balance: account.balance,
            currency: account.currency,
            walletBalance: wallet.balance,
            noAccount: false as const,
          };
        })
      );
      
      const { data: pendingRequests } = await supabase
        .from('piggy_open_requests')
        .select('id, child_id, amount, reason, destination, status, created_at')
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      let pendingAccountRequestsWithNick: Array<{ id: string; user_id: string; status: string; created_at: string; nickname: string | null }> = [];
      try {
        const { data: pendingAccountRequests } = await supabase
          .from('piggy_account_requests')
          .select('id, user_id, status, created_at')
          .eq('group_id', groupId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        const accountRequestNicknames: Record<string, string | null> = {};
        if (pendingAccountRequests?.length) {
          const userIds = [...new Set(pendingAccountRequests.map((r: { user_id: string }) => r.user_id))];
          const { data: profiles } = await supabase.from('profiles').select('id, nickname').in('id', userIds);
          profiles?.forEach((p: { id: string; nickname: string | null }) => {
            accountRequestNicknames[p.id] = p.nickname ?? null;
          });
        }
        pendingAccountRequestsWithNick = (pendingAccountRequests || []).map((r: { id: string; user_id: string; status: string; created_at: string }) => ({
          id: r.id,
          user_id: r.user_id,
          status: r.status,
          created_at: r.created_at,
          nickname: accountRequestNicknames[r.user_id] ?? null,
        }));
      } catch (_) {
        // piggy_account_requests 테이블이 없을 수 있음
      }

      return NextResponse.json({
        success: true,
        data: {
          role: permissionResult.role,
          isOwner: permissionResult.isOwner,
          memberPiggies,
          pendingRequests: pendingRequests || [],
          pendingAccountRequests: pendingAccountRequestsWithNick,
        },
      });
    }

    // 일반 멤버: 저금통은 관리자가 생성해야 함. 있으면 반환(용돈 지갑은 있으면 0으로 생성), 없으면 null
    const account = await getPiggyAccountForUserIfExists(groupId, user.id);
    const wallet = account ? await ensurePiggyWallet(groupId, user.id) : null;
    
    let ownerNickname: string | null = null;
    if (account?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', account.user_id)
        .single();
      ownerNickname = profile?.nickname || null;
    }
    
    const { data: pendingRequests } = await supabase
      .from('piggy_open_requests')
      .select('id, child_id, amount, reason, destination, status, created_at')
      .eq('group_id', groupId)
      .eq('child_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    let pendingAccountRequest = false;
    try {
      const { data: myRequest } = await supabase
        .from('piggy_account_requests')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      pendingAccountRequest = !!myRequest;
    } catch (_) {}

    return NextResponse.json({
      success: true,
      data: {
        role: permissionResult.role,
        isOwner: permissionResult.isOwner,
        account: account ? { ...account, ownerNickname } : null,
        wallet: wallet ?? null,
        pendingRequests: pendingRequests || [],
        pendingAccountRequest,
      },
    });
  } catch (error: any) {
    console.error('Piggy summary 오류:', error);
    return NextResponse.json(
      { error: error.message || '요약 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
