import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccountForUser, ensurePiggyWallet, getPiggyAccountsForGroup, getGroupMembers } from '@/lib/piggy-bank';

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
      const account = await ensurePiggyAccountForUser(groupId, childId);
      const wallet = await ensurePiggyWallet(groupId, childId);
      
      // 소유자 닉네임 조회
      let ownerNickname: string | null = null;
      if (account.user_id) {
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
          account: { ...account, ownerNickname },
          wallet,
          pendingRequests: pendingRequests || [],
        },
      });
    }

    if (isAdmin && !childId) {
      const accounts = await getPiggyAccountsForGroup(groupId);
      
      // 일반 멤버(MEMBER 역할)만 필터링
      const members = await getGroupMembers(groupId);
      const memberUserIds = new Set(
        members.filter(m => m.role === 'MEMBER').map(m => m.user_id)
      );
      
      // MEMBER 역할인 계정만 필터링
      const memberAccounts = accounts.filter(account => 
        account.user_id && memberUserIds.has(account.user_id)
      );
      
      // 각 계정의 ownerNickname과 wallet 정보 조회
      const accountsWithDetails = await Promise.all(
        memberAccounts.map(async (account) => {
          let ownerNickname: string | null = null;
          let walletBalance = 0;
          
          if (account.user_id) {
            // 닉네임 조회
            const { data: profile } = await supabase
              .from('profiles')
              .select('nickname')
              .eq('id', account.user_id)
              .single();
            ownerNickname = profile?.nickname || null;
            
            // 지갑 잔액 조회
            try {
              const wallet = await ensurePiggyWallet(groupId, account.user_id);
              walletBalance = wallet.balance;
            } catch (error) {
              // 지갑이 없으면 0으로 설정
              walletBalance = 0;
            }
          }
          
          return {
            ...account,
            ownerNickname,
            walletBalance,
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
      return NextResponse.json({
        success: true,
        data: {
          role: permissionResult.role,
          isOwner: permissionResult.isOwner,
          accounts: accountsWithDetails,
          pendingRequests: pendingRequests || [],
        },
      });
    }

    const account = await ensurePiggyAccountForUser(groupId, user.id);
    const wallet = await ensurePiggyWallet(groupId, user.id);
    
    // 소유자 닉네임 조회
    let ownerNickname: string | null = null;
    if (account.user_id) {
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

    return NextResponse.json({
      success: true,
      data: {
        role: permissionResult.role,
        isOwner: permissionResult.isOwner,
        account: { ...account, ownerNickname },
        wallet,
        pendingRequests: pendingRequests || [],
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
