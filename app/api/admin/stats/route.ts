import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { ALL_APP_IDS } from '@/lib/apps';

/**
 * 시스템 관리자 대시보드 통계 조회
 * - 전체 합계 + 앱별 그룹/유저/문의/언어·국가/활성 유저 집계
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { count: totalUsers, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    if (usersError) throw usersError;

    const { count: totalGroups, error: groupsError } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true });
    if (groupsError) throw groupsError;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

    const { count: activeUsers, error: activeUsersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', thirtyDaysAgoIso);
    if (activeUsersError) throw activeUsersError;

    const { count: totalAdmins, error: adminsError } = await supabase
      .from('system_admins')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (adminsError) throw adminsError;

    const { data: profileLocaleRows, error: localeError } = await supabase
      .from('profiles')
      .select('id, preferred_language, country_code, updated_at');
    if (localeError) throw localeError;

    const languageDistribution: Record<string, number> = {};
    const countryDistribution: Record<string, number> = {};
    const profileById = new Map<
      string,
      { language: string; country: string; updatedAt: string | null }
    >();

    for (const row of profileLocaleRows || []) {
      const langKey = String(row.preferred_language || '').trim() || 'unknown';
      const countryRaw = String(row.country_code ?? '').trim().toUpperCase();
      const countryKey = countryRaw || 'unknown';
      languageDistribution[langKey] = (languageDistribution[langKey] || 0) + 1;
      countryDistribution[countryKey] = (countryDistribution[countryKey] || 0) + 1;
      if (row.id) {
        profileById.set(String(row.id), {
          language: langKey,
          country: countryKey,
          updatedAt: row.updated_at ? String(row.updated_at) : null,
        });
      }
    }

    const { data: groupRows, error: groupAppError } = await supabase
      .from('groups')
      .select('id, app_id, owner_id');
    if (groupAppError) throw groupAppError;

    const groupsByApp: Record<string, number> = {};
    const groupAppById = new Map<string, string>();
    const usersByAppSets: Record<string, Set<string>> = {};
    for (const appId of ALL_APP_IDS) {
      groupsByApp[appId] = 0;
      usersByAppSets[appId] = new Set();
    }

    for (const row of groupRows || []) {
      const appKey = String(row.app_id || 'unknown');
      groupsByApp[appKey] = (groupsByApp[appKey] || 0) + 1;
      if (row.id && row.app_id) {
        groupAppById.set(row.id, row.app_id);
        if (!usersByAppSets[row.app_id]) usersByAppSets[row.app_id] = new Set();
        if (row.owner_id) usersByAppSets[row.app_id].add(row.owner_id);
      }
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from('memberships')
      .select('user_id, group_id, app_id');
    if (membershipError) throw membershipError;

    for (const m of membershipRows || []) {
      const appKey =
        m.app_id ||
        (m.group_id ? groupAppById.get(m.group_id) : null) ||
        'unknown';
      if (!usersByAppSets[appKey]) usersByAppSets[appKey] = new Set();
      if (m.user_id) usersByAppSets[appKey].add(m.user_id);
    }

    const usersByApp: Record<string, number> = {};
    const languageDistributionByApp: Record<string, Record<string, number>> = {};
    const countryDistributionByApp: Record<string, Record<string, number>> = {};
    const activeUsersByApp: Record<string, number> = {};

    for (const [appKey, set] of Object.entries(usersByAppSets)) {
      usersByApp[appKey] = set.size;
      const langDist: Record<string, number> = {};
      const countryDist: Record<string, number> = {};
      let activeCount = 0;
      for (const userId of set) {
        const profile = profileById.get(userId);
        const langKey = profile?.language || 'unknown';
        const countryKey = profile?.country || 'unknown';
        langDist[langKey] = (langDist[langKey] || 0) + 1;
        countryDist[countryKey] = (countryDist[countryKey] || 0) + 1;
        if (profile?.updatedAt && profile.updatedAt >= thirtyDaysAgoIso) {
          activeCount += 1;
        }
      }
      languageDistributionByApp[appKey] = langDist;
      countryDistributionByApp[appKey] = countryDist;
      activeUsersByApp[appKey] = activeCount;
    }

    const countTicketsByApp = async (table: 'support_tickets' | 'member_support_tickets') => {
      const { data: rows, error } = await supabase.from(table).select('group_id');
      if (error) throw error;
      const byApp: Record<string, number> = {};
      for (const appId of ALL_APP_IDS) byApp[appId] = 0;
      for (const row of rows || []) {
        const appKey = (row.group_id && groupAppById.get(row.group_id)) || 'unknown';
        byApp[appKey] = (byApp[appKey] || 0) + 1;
      }
      return byApp;
    };

    const supportTicketsByApp = await countTicketsByApp('support_tickets');
    const memberTicketsByApp = await countTicketsByApp('member_support_tickets');

    const { count: totalSupportTickets } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true });
    const { count: totalMemberTickets } = await supabase
      .from('member_support_tickets')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        totalGroups: totalGroups || 0,
        activeUsers: activeUsers || 0,
        totalAdmins: totalAdmins || 0,
        totalSupportTickets: totalSupportTickets || 0,
        totalMemberTickets: totalMemberTickets || 0,
        languageDistribution,
        countryDistribution,
        languageDistributionByApp,
        countryDistributionByApp,
        activeUsersByApp,
        groupsByApp,
        usersByApp,
        supportTicketsByApp,
        memberTicketsByApp,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '통계 조회 중 오류가 발생했습니다.';
    console.error('관리자 통계 조회 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
