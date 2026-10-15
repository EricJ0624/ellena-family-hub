import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { getAuditRequestMeta, writeAdminAuditLog } from '@/lib/admin-audit';
import { ALL_APP_IDS, isAppId, type AppId } from '@/lib/apps';
import { BETA_QUALIFIED_LIMIT, countQualifiedBetaTesters } from '@/lib/beta-testers';

export const dynamic = 'force-dynamic';

type BetaStatusRow = {
  appId: AppId;
  betaCount: number;
  limit: number;
  betaPeriodEnabled: boolean;
};

async function loadBetaStatus(): Promise<BetaStatusRow[]> {
  const supabase = getSupabaseServerClient();
  const [{ data: plans, error: planError }, counts] = await Promise.all([
    supabase.from('billing_plans').select('app_id, beta_period_enabled'),
    Promise.all(
      ALL_APP_IDS.map(async (appId) => ({
        appId,
        betaCount: await countQualifiedBetaTesters(appId),
      })),
    ),
  ]);
  if (planError) throw planError;

  const enabledByApp = new Map<string, boolean>();
  for (const plan of plans ?? []) {
    enabledByApp.set(plan.app_id, plan.beta_period_enabled !== false);
  }

  return counts.map((row) => ({
    appId: row.appId,
    betaCount: row.betaCount,
    limit: BETA_QUALIFIED_LIMIT,
    betaPeriodEnabled: enabledByApp.get(row.appId) ?? true,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const adminCheck = await requireSystemAdmin(authResult.user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    return NextResponse.json({ success: true, data: await loadBetaStatus() });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '베타 현황을 불러오지 못했습니다.';
    console.error('베타 현황 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    if (!isAppId(body.appId)) {
      return NextResponse.json({ error: '유효한 appId가 필요합니다.' }, { status: 400 });
    }
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled 값이 필요합니다.' }, { status: 400 });
    }

    const appId = body.appId as AppId;
    const supabase = getSupabaseServerClient();
    const { data: before } = await supabase
      .from('billing_plans')
      .select('beta_period_enabled')
      .eq('app_id', appId)
      .maybeSingle();

    const { error } = await supabase
      .from('billing_plans')
      .update({
        beta_period_enabled: body.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('app_id', appId);
    if (error) throw error;

    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'UPDATE',
      resourceType: 'billing_plans',
      resourceId: appId,
      details: {
        app_id: appId,
        before: { betaPeriodEnabled: before?.beta_period_enabled !== false },
        after: { betaPeriodEnabled: body.enabled },
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      success: true,
      data: { appId, betaPeriodEnabled: body.enabled },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '베타 기간을 저장하지 못했습니다.';
    console.error('베타 기간 저장 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
