import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { isAppId } from '@/lib/apps';

/**
 * 감사 로그 조회 (시스템 관리자 전용)
 * GET ?from=&to=&admin_id=&group_id=&resource_type=&app_id=&page=1&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const adminId = searchParams.get('admin_id');
    const groupId = searchParams.get('group_id');
    const resourceType = searchParams.get('resource_type');
    const appIdParam = searchParams.get('app_id');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const supabase = getSupabaseServerClient();

    let appGroupIds: string[] | null = null;
    if (appIdParam && isAppId(appIdParam)) {
      const { data: appGroups, error: appGroupsError } = await supabase
        .from('groups')
        .select('id')
        .eq('app_id', appIdParam);
      if (appGroupsError) throw appGroupsError;
      appGroupIds = (appGroups || []).map((g) => g.id);
      if (appGroupIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page,
          limit,
        });
      }
    }

    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      const toEnd = to.includes('T') ? to : `${to}T23:59:59.999Z`;
      query = query.lte('created_at', toEnd);
    }
    if (adminId) {
      query = query.eq('admin_id', adminId);
    }
    if (groupId) {
      query = query.eq('group_id', groupId);
    } else if (appGroupIds) {
      query = query.in('group_id', appGroupIds);
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('감사 로그 조회 오류:', error);
      return NextResponse.json(
        { error: '감사 로그 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const groupIds = Array.from(
      new Set(rows.map((r: { group_id?: string | null }) => r.group_id).filter(Boolean) as string[])
    );
    const appByGroup = new Map<string, string | null>();
    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from('groups')
        .select('id, app_id')
        .in('id', groupIds);
      for (const g of groups || []) {
        appByGroup.set(g.id, g.app_id ?? null);
      }
    }

    const enriched = rows.map((row: Record<string, unknown>) => ({
      ...row,
      app_id: row.group_id ? appByGroup.get(String(row.group_id)) ?? null : null,
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
    console.error('감사 로그 API 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
