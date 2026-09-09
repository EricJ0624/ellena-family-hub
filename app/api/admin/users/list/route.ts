import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';

/** 카운트 및 베타 자격에서 제외할 테스트 이메일 */
const BETA_EXCLUDED_EMAILS = ['soungtak@gmail.com', 'soungtak@icloud.com'];

/** 최근 N일 접속 기준 (일) */
const RECENT_ACTIVITY_DAYS = 30;

/**
 * 시스템 관리자용 모든 사용자 목록 조회 API
 * auth.users에서 직접 조회하여 모든 사용자를 반환합니다.
 * 반환 필드: id, email, nickname, preferred_language, country_code,
 *            created_at, last_sign_in_at, groups_count, is_active,
 *            recent_30day_login, beta_rank, is_beta_qualified
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

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
        pagination: { total: 0, totalPages: 0 },
      });
    }

    const userIds = allUsers.map((u) => u.id);

    // 프로필 정보 일괄 조회
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, nickname, preferred_language, country_code')
      .in('id', userIds);

    // 멤버십 일괄 조회 (memberships PK: user_id+group_id, 가입 시각 컬럼: joined_at)
    const { data: allMemberships } = await supabase
      .from('memberships')
      .select('user_id, group_id, joined_at')
      .in('user_id', userIds);

    // 소유 그룹 일괄 조회 (id, owner_id, created_at)
    const { data: allOwnedGroups } = await supabase
      .from('groups')
      .select('id, owner_id, created_at')
      .in('owner_id', userIds);

    // 유저별 가장 이른 그룹 소속 시각 맵 구성
    // memberships: joined_at / groups(소유): created_at
    const earliestGroupAtByUser = new Map<string, string>();
    for (const m of allMemberships ?? []) {
      const t = m.joined_at as string | null;
      if (!t) continue;
      const cur = earliestGroupAtByUser.get(m.user_id);
      if (!cur || t < cur) earliestGroupAtByUser.set(m.user_id, t);
    }
    for (const g of allOwnedGroups ?? []) {
      const t = g.created_at as string | null;
      if (!t) continue;
      const cur = earliestGroupAtByUser.get(g.owner_id);
      if (!cur || t < cur) earliestGroupAtByUser.set(g.owner_id, t);
    }

    // 유저별 그룹 수 맵 구성 (그룹 ID 중복 제거)
    const groupIdsByUser = new Map<string, Set<string>>();
    for (const m of allMemberships ?? []) {
      if (!groupIdsByUser.has(m.user_id)) groupIdsByUser.set(m.user_id, new Set());
      groupIdsByUser.get(m.user_id)!.add(m.group_id);
    }
    for (const g of allOwnedGroups ?? []) {
      if (!groupIdsByUser.has(g.owner_id)) groupIdsByUser.set(g.owner_id, new Set());
      groupIdsByUser.get(g.owner_id)!.add(g.id);
    }

    // 최근 N일 기준 시각
    const recentCutoff = new Date(
      Date.now() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // 유저별 상세 정보 계산
    const usersWithDetails = allUsers.map((authUser) => {
      const profile = profilesData?.find((p) => p.id === authUser.id);
      const groupCount = groupIdsByUser.get(authUser.id)?.size ?? 0;
      // Supabase auth.users 컬럼명은 banned_until (banned_at 아님)
      const isBanned = authUser.banned_until != null;
      const isDeleted = authUser.deleted_at !== null;
      const isExcluded = BETA_EXCLUDED_EMAILS.includes(authUser.email ?? '');

      // 베타 자격 판정: 이메일 인증 완료 + 그룹 소속 + 비제외 + 활성
      const emailConfirmedAt: string | null = authUser.email_confirmed_at ?? null;
      const earliestGroupAt: string | null = earliestGroupAtByUser.get(authUser.id) ?? null;
      let qualifiedAt: string | null = null;
      if (!isExcluded && !isBanned && !isDeleted && emailConfirmedAt && earliestGroupAt) {
        // 둘 다 충족된 시각 = 더 늦은 쪽
        qualifiedAt = emailConfirmedAt > earliestGroupAt ? emailConfirmedAt : earliestGroupAt;
      }

      // 최근 30일 접속 여부
      const recentLogin = authUser.last_sign_in_at
        ? authUser.last_sign_in_at >= recentCutoff
        : false;

      return {
        id: authUser.id,
        email: authUser.email ?? profile?.email ?? null,
        nickname: profile?.nickname ?? authUser.user_metadata?.nickname ?? null,
        preferred_language: profile?.preferred_language ?? null,
        country_code: profile?.country_code ?? null,
        created_at: authUser.created_at ?? new Date().toISOString(),
        last_sign_in_at: authUser.last_sign_in_at ?? null,
        groups_count: groupCount,
        is_active: !isBanned && !isDeleted,
        recent_30day_login: recentLogin,
        // 임시 베타 자격 시각 (순번 계산 후 제거)
        _qualified_at: qualifiedAt,
      };
    });

    // 베타 자격자 순번 계산 (qualified_at 오래된 순)
    const qualifiedList = usersWithDetails
      .filter((u) => u._qualified_at !== null)
      .sort((a, b) => (a._qualified_at! < b._qualified_at! ? -1 : 1));

    const betaRankMap = new Map<string, number>();
    qualifiedList.forEach((u, idx) => betaRankMap.set(u.id, idx + 1));

    // 임시 필드 제거 후 최종 응답 구성
    const finalUsers = usersWithDetails.map(({ _qualified_at, ...u }) => ({
      ...u,
      beta_rank: betaRankMap.get(u.id) ?? null,
      is_beta_qualified: (betaRankMap.get(u.id) ?? Infinity) <= 100,
    }));

    // 기본 정렬: 최신 가입일 내림차순
    finalUsers.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      data: finalUsers,
      pagination: {
        total: totalUsers || finalUsers.length,
        totalPages: Math.ceil((totalUsers || finalUsers.length) / perPage),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '사용자 목록 조회 중 오류가 발생했습니다.';
    console.error('사용자 목록 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
