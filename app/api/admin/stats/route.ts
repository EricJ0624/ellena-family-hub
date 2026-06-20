import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';

/**
 * 시스템 관리자 대시보드 통계 조회
 * - service role 기반 집계로 RLS 영향 없이 일관된 숫자 반환
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
    const { count: activeUsers, error: activeUsersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', thirtyDaysAgo.toISOString());
    if (activeUsersError) throw activeUsersError;

    const { count: totalAdmins, error: adminsError } = await supabase
      .from('system_admins')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (adminsError) throw adminsError;

    const { data: profileLocaleRows, error: localeError } = await supabase
      .from('profiles')
      .select('preferred_language, country_code');
    if (localeError) throw localeError;

    const languageDistribution: Record<string, number> = {};
    const countryDistribution: Record<string, number> = {};
    for (const row of profileLocaleRows || []) {
      const langKey = String(row.preferred_language || 'unknown');
      const countryKey = String(row.country_code || 'unknown');
      languageDistribution[langKey] = (languageDistribution[langKey] || 0) + 1;
      countryDistribution[countryKey] = (countryDistribution[countryKey] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        totalGroups: totalGroups || 0,
        activeUsers: activeUsers || 0,
        totalAdmins: totalAdmins || 0,
        languageDistribution,
        countryDistribution,
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
