import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { isAppId } from '@/lib/apps';

const DASHBOARD_ACCESS_TYPE = 'dashboard_access';

type AuditListRow = {
  id: string;
  created_at: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  admin_id: string;
  group_id: string | null;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
};

type AccessLogRow = {
  id: string;
  access_request_id: string | null;
  system_admin_id: string;
  group_id: string;
  accessed_at: string;
  session_duration_seconds: number | null;
  ip_address: string | null;
  user_agent: string | null;
};

function endOfTo(to: string): string {
  return to.includes('T') ? to : `${to}T23:59:59.999Z`;
}

function toAuditRow(row: AccessLogRow): AuditListRow {
  const details: Record<string, unknown> = {};
  if (row.session_duration_seconds != null) {
    details.session_duration_seconds = row.session_duration_seconds;
  }
  return {
    id: row.id,
    created_at: row.accessed_at,
    action: 'OPEN',
    resource_type: DASHBOARD_ACCESS_TYPE,
    resource_id: row.access_request_id,
    admin_id: row.system_admin_id,
    group_id: row.group_id,
    target_user_id: null,
    details: Object.keys(details).length > 0 ? details : null,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  };
}

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

    const includeAccessLogs = !resourceType || resourceType === DASHBOARD_ACCESS_TYPE;
    const includeAdminLogs = resourceType !== DASHBOARD_ACCESS_TYPE;
    const toEnd = to ? endOfTo(to) : null;
    const windowSize = offset + limit;

    let rows: AuditListRow[] = [];
    let count = 0;

    if (!includeAccessLogs) {
      let query = supabase
        .from('admin_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (from) query = query.gte('created_at', from);
      if (toEnd) query = query.lte('created_at', toEnd);
      if (adminId) query = query.eq('admin_id', adminId);
      if (groupId) query = query.eq('group_id', groupId);
      else if (appGroupIds) query = query.in('group_id', appGroupIds);
      if (resourceType) query = query.eq('resource_type', resourceType);

      const result = await query;
      if (result.error) {
        console.error('감사 로그 조회 오류:', result.error);
        return NextResponse.json({ error: '감사 로그 조회에 실패했습니다.' }, { status: 500 });
      }
      rows = (result.data ?? []) as AuditListRow[];
      count = result.count ?? 0;
    } else {
      const [adminResult, accessResult] = await Promise.all([
        includeAdminLogs
          ? fetchAdminAuditWindow(supabase, { from, toEnd, adminId, groupId, appGroupIds, resourceType, windowSize })
          : Promise.resolve({ rows: [] as AuditListRow[], count: 0, error: null }),
        fetchDashboardAccessWindow(supabase, { from, toEnd, adminId, groupId, appGroupIds, windowSize }),
      ]);
      if (adminResult.error || accessResult.error) {
        console.error('감사 로그 조회 오류:', adminResult.error || accessResult.error);
        return NextResponse.json({ error: '감사 로그 조회에 실패했습니다.' }, { status: 500 });
      }
      rows = [...adminResult.rows, ...accessResult.rows]
        .sort((a, b) => {
          const byTime = b.created_at.localeCompare(a.created_at);
          if (byTime !== 0) return byTime;
          return b.id.localeCompare(a.id);
        })
        .slice(offset, offset + limit);
      count = adminResult.count + accessResult.count;
    }
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

type WindowFilters = {
  from: string | null;
  toEnd: string | null;
  adminId: string | null;
  groupId: string | null;
  appGroupIds: string[] | null;
  resourceType?: string | null;
  windowSize: number;
};

type WindowResult = {
  rows: AuditListRow[];
  count: number;
  error: { message?: string } | null;
};

async function fetchAdminAuditWindow(
  supabase: SupabaseClient,
  filters: WindowFilters,
): Promise<WindowResult> {
  const { rows, count, error } = await fetchWindow(filters.windowSize, (start, end) => {
    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.toEnd) query = query.lte('created_at', filters.toEnd);
    if (filters.adminId) query = query.eq('admin_id', filters.adminId);
    if (filters.groupId) query = query.eq('group_id', filters.groupId);
    else if (filters.appGroupIds) query = query.in('group_id', filters.appGroupIds);
    if (filters.resourceType) query = query.eq('resource_type', filters.resourceType);
    return query.range(start, end);
  });
  return { rows: rows as AuditListRow[], count, error };
}

async function fetchDashboardAccessWindow(
  supabase: SupabaseClient,
  filters: WindowFilters,
): Promise<WindowResult> {
  const { rows, count, error } = await fetchWindow(filters.windowSize, (start, end) => {
    let query = supabase
      .from('dashboard_access_logs')
      .select('*', { count: 'exact' })
      .order('accessed_at', { ascending: false });
    if (filters.from) query = query.gte('accessed_at', filters.from);
    if (filters.toEnd) query = query.lte('accessed_at', filters.toEnd);
    if (filters.adminId) query = query.eq('system_admin_id', filters.adminId);
    if (filters.groupId) query = query.eq('group_id', filters.groupId);
    else if (filters.appGroupIds) query = query.in('group_id', filters.appGroupIds);
    return query.range(start, end);
  });
  return {
    rows: (rows as AccessLogRow[]).map(toAuditRow),
    count,
    error,
  };
}

async function fetchWindow(
  windowSize: number,
  load: (start: number, end: number) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null; count: number | null }>,
): Promise<{ rows: unknown[]; count: number; error: { message?: string } | null }> {
  const chunk = 1000;
  const rows: unknown[] = [];
  let count = 0;
  for (let start = 0; start < windowSize; start += chunk) {
    const end = Math.min(windowSize, start + chunk) - 1;
    const result = await load(start, end);
    if (result.error) return { rows: [], count: 0, error: result.error };
    if (start === 0) count = result.count ?? 0;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < end - start + 1) break;
  }
  return { rows, count, error: null };
}
