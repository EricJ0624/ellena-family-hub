import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { isFeatureUsagePeriod } from '@/lib/admin-feature-usage';
import { loadLiveFeatureUsage, parseUuid } from '@/lib/admin-feature-usage-query';

/**
 * 시스템 관리자 위젯 활동량 조회
 * GET ?from=ISO&to=ISO&period=today|7d|30d|since_reset|custom&group_id=
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
    const periodRaw = searchParams.get('period') || 'today';
    const periodLabel = isFeatureUsagePeriod(periodRaw) ? periodRaw : 'custom';
    const groupId = parseUuid(searchParams.get('group_id'));

    if (!from || !to) {
      return NextResponse.json({ error: 'from, to 기간이 필요합니다.' }, { status: 400 });
    }

    const data = await loadLiveFeatureUsage({
      fromIso: from,
      toIso: to,
      periodLabel,
      groupId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '활동량 조회 중 오류가 발생했습니다.';
    console.error('관리자 위젯 활동량 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
