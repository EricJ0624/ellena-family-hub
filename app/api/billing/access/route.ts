import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import { isSystemAdmin } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;

  const supabase = getSupabaseServerClient();
  const { data: plan, error: planError } = await supabase
    .from('billing_plans')
    .select('beta_period_enabled')
    .eq('app_id', CURRENT_APP_ID)
    .maybeSingle();
  const betaPeriodEnabled = Boolean(planError) || !plan || plan.beta_period_enabled !== false;
  const admin = await isSystemAdmin(authResult.user.id);

  const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
  let hasActiveSubscription = false;
  if (groupId) {
    const memberCheck = await requireGroupMember(authResult.user.id, groupId, { skipBillingLock: true });
    if (!(memberCheck instanceof NextResponse)) {
      const { data: subscription } = await supabase
        .from('billing_subscriptions')
        .select('status')
        .eq('app_id', CURRENT_APP_ID)
        .eq('group_id', groupId)
        .eq('status', 'active')
        .maybeSingle();
      hasActiveSubscription = subscription?.status === 'active';
    }
  }

  return NextResponse.json({
    betaPeriodEnabled,
    hasActiveSubscription,
    isSystemAdmin: admin,
  });
}
