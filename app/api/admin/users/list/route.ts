import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

/**
 * 시스템 관리자용 모든 사용자 목록 조회 API
 * auth.users에서 직접 조회하여 모든 사용자를 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 시스템 관리자 확인
    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServerClient();

    // auth.users에서 모든 사용자 조회 (페이지네이션 처리)
    let allUsers: any[] = [];
    let currentPage = 1;
    const perPage = 1000; // 한 번에 최대 1000명씩 조회
    let hasMore = true;
    let totalUsers = 0;

    // 모든 페이지를 순회하여 모든 사용자 조회
    while (hasMore) {
      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
        page: currentPage,
        perPage: perPage,
      });

      if (usersError) {
        console.error(`사용자 목록 조회 오류 (페이지 ${currentPage}):`, usersError);
        // 첫 페이지에서 에러가 발생하면 에러 반환, 이후 페이지에서 에러가 발생하면 중단
        if (currentPage === 1) {
          return NextResponse.json(
            { error: '사용자 목록 조회에 실패했습니다.', details: usersError.message },
            { status: 500 }
          );
        }
        break;
      }

      if (!usersData || !usersData.users || usersData.users.length === 0) {
        hasMore = false;
        break;
      }

      allUsers = allUsers.concat(usersData.users);
      totalUsers = usersData.total || allUsers.length;

      // 현재 페이지의 사용자 수가 perPage보다 작으면 마지막 페이지
      if (usersData.users.length < perPage) {
        hasMore = false;
      } else {
        currentPage++;
      }

      // 안전장치: 무한 루프 방지 (최대 100페이지, 즉 100,000명까지 조회 가능)
      if (currentPage > 100) {
        console.warn('사용자 목록 조회가 100페이지를 초과했습니다. 일부 사용자만 조회됩니다.');
        break;
      }
    }

    if (allUsers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          totalPages: 0,
        },
      });
    }

    // 각 사용자의 프로필 정보 조회 (profiles 테이블)
    const userIds = allUsers.map(u => u.id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, nickname, avatar_url')
      .in('id', userIds);

    // 각 사용자의 그룹 수 계산 (병렬 처리)
    const usersWithDetails = await Promise.all(
      allUsers.map(async (authUser) => {
        const profile = profilesData?.find(p => p.id === authUser.id);
        
        try {
          // 그룹 수 계산
          const { count } = await supabase
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', authUser.id);

          // 소유자인 그룹 수 계산
          const { count: ownedCount } = await supabase
            .from('groups')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', authUser.id);

          const totalGroups = (count || 0) + (ownedCount || 0);

          return {
            id: authUser.id,
            email: authUser.email || profile?.email || null,
            nickname: profile?.nickname || authUser.user_metadata?.nickname || null,
            created_at: authUser.created_at || new Date().toISOString(),
            last_sign_in_at: authUser.last_sign_in_at || null,
            groups_count: totalGroups,
            is_active: authUser.banned_at === null && authUser.deleted_at === null,
            avatar_url: profile?.avatar_url || null,
          };
        } catch (err: any) {
          console.error(`사용자 ${authUser.id} 그룹 수 계산 오류:`, err);
          return {
            id: authUser.id,
            email: authUser.email || profile?.email || null,
            nickname: profile?.nickname || authUser.user_metadata?.nickname || null,
            created_at: authUser.created_at || new Date().toISOString(),
            last_sign_in_at: authUser.last_sign_in_at || null,
            groups_count: 0,
            is_active: authUser.banned_at === null && authUser.deleted_at === null,
            avatar_url: profile?.avatar_url || null,
          };
        }
      })
    );

    // 최신 가입일 기준으로 정렬
    usersWithDetails.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      data: usersWithDetails,
      pagination: {
        total: totalUsers || usersWithDetails.length,
        totalPages: Math.ceil((totalUsers || usersWithDetails.length) / perPage),
      },
    });
  } catch (error: any) {
    console.error('사용자 목록 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '사용자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

