import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { getAuditRequestMeta, writeAdminAuditLog } from '@/lib/admin-audit';
import { isFeatureUsagePeriod, type FeatureUsageGroupRow } from '@/lib/admin-feature-usage';
import { loadLiveFeatureUsage, parseUuid } from '@/lib/admin-feature-usage-query';
import { isAppId } from '@/lib/apps';

type SnapshotRow = {
  id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  group_id: string | null;
  totals: unknown;
  per_group: FeatureUsageGroupRow[] | null;
  last_reset_at: string | null;
  saved_at: string;
  note: string | null;
};

/** 예전 스냅샷에 appId가 없으면 groups.app_id로 보강 */
async function enrichSnapshotsWithAppId(rows: SnapshotRow[]): Promise<SnapshotRow[]> {
  const missingIds = new Set<string>();
  for (const row of rows) {
    for (const group of row.per_group || []) {
      if (group?.groupId && !group.appId) missingIds.add(String(group.groupId));
    }
  }
  if (missingIds.size === 0) return rows;

  const supabase = getSupabaseServerClient();
  const { data: groups, error } = await supabase
    .from('groups')
    .select('id, app_id')
    .in('id', [...missingIds]);
  if (error) throw error;

  const appByGroupId = new Map<string, string | null>();
  for (const group of groups || []) {
    appByGroupId.set(String(group.id), group.app_id ? String(group.app_id) : null);
  }

  return rows.map((row) => ({
    ...row,
    per_group: (row.per_group || []).map((group) => ({
      ...group,
      appId: group.appId ?? appByGroupId.get(String(group.groupId)) ?? null,
    })),
  }));
}

/**
 * 저장된 기간별 활동량 스냅샷 목록
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const adminCheck = await requireSystemAdmin(authResult.user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('feature_usage_snapshots')
      .select('id, period_start, period_end, period_label, group_id, totals, per_group, last_reset_at, saved_at, note')
      .order('saved_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const enriched = await enrichSnapshotsWithAppId((data || []) as SnapshotRow[]);
    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저장 기록 조회 중 오류가 발생했습니다.';
    console.error('활동량 스냅샷 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 현재 조회 기간의 활동량을 스냅샷으로 저장
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    const from = typeof body.from === 'string' ? body.from : '';
    const to = typeof body.to === 'string' ? body.to : '';
    const periodRaw = typeof body.period === 'string' ? body.period : 'custom';
    const periodLabel = isFeatureUsagePeriod(periodRaw) ? periodRaw : 'custom';
    const groupId = parseUuid(typeof body.groupId === 'string' ? body.groupId : null);
    const appIdRaw = typeof body.appId === 'string' ? body.appId.trim() : null;
    const appId = appIdRaw && isAppId(appIdRaw) ? appIdRaw : null;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';

    if (!from || !to) {
      return NextResponse.json({ error: 'from, to 기간이 필요합니다.' }, { status: 400 });
    }

    const usage = await loadLiveFeatureUsage({
      fromIso: from,
      toIso: to,
      periodLabel,
      groupId,
      appId,
    });

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('feature_usage_snapshots')
      .insert({
        period_start: usage.effectiveFrom,
        period_end: usage.periodEnd,
        period_label: usage.periodLabel,
        group_id: usage.groupId,
        totals: usage.totals,
        per_group: usage.perGroup,
        last_reset_at: usage.lastResetAt,
        saved_by: user.id,
        note: note || null,
      })
      .select('id, period_start, period_end, period_label, group_id, totals, per_group, last_reset_at, saved_at, note')
      .single();

    if (error) throw error;

    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'CREATE',
      resourceType: 'feature_usage_snapshot',
      resourceId: data?.id ?? null,
      details: {
        period_label: usage.periodLabel,
        period_start: usage.effectiveFrom,
        period_end: usage.periodEnd,
        group_id: usage.groupId,
        app_id: appId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '활동량 저장 중 오류가 발생했습니다.';
    console.error('활동량 스냅샷 저장 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 저장 스냅샷 1건 삭제 (가족 데이터는 삭제하지 않음)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const id = parseUuid(new URL(request.url).searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: '삭제할 저장 기록 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('feature_usage_snapshots').delete().eq('id', id);
    if (error) throw error;

    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'DELETE',
      resourceType: 'feature_usage_snapshot',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '저장 기록 삭제 중 오류가 발생했습니다.';
    console.error('활동량 스냅샷 삭제 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
