import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { isAppId } from '@/lib/apps';
import { getAppBetaQualification } from '@/lib/beta-testers';
import { getBillingGroupOverride } from '@/lib/billing-group-override';
import { getGroupStorageQuotaBytes, groupAllowsOriginalUpload } from '@/lib/storage-quota';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;

  const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
  if (!groupId) {
    return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
  }

  const memberCheck = await requireGroupMember(authResult.user.id, groupId, { skipBillingLock: true });
  if (memberCheck instanceof NextResponse) return memberCheck;

  const supabase = getSupabaseServerClient();
  const { data: group } = await supabase
    .from('groups')
    .select('id, owner_id, app_id')
    .eq('id', groupId)
    .maybeSingle();
  if (!group || !isAppId(group.app_id)) {
    return NextResponse.json({ error: '그룹을 찾을 수 없습니다.', code: 'group_missing' }, { status: 404 });
  }

  const [memberResult, planResult, subscriptionResult, quotaBytes, originalUploadEnabled, override] =
    await Promise.all([
      supabase
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('group_id', groupId),
      supabase
        .from('billing_plans')
        .select('included_seats, beta_free_seats, base_price_cents, extra_seat_price_cents, storage_upgrade_price_cents, beta_discount_percent, beta_period_enabled, currency')
        .eq('app_id', group.app_id)
        .maybeSingle(),
      supabase
        .from('billing_subscriptions')
        .select('status, seat_count, quota_bytes')
        .eq('app_id', group.app_id)
        .eq('group_id', groupId)
        .maybeSingle(),
      getGroupStorageQuotaBytes(groupId),
      groupAllowsOriginalUpload(groupId),
      getBillingGroupOverride(groupId),
    ]);
  if (memberResult.error || planResult.error || subscriptionResult.error) {
    console.error('그룹 결제 상태 조회 오류:', memberResult.error ?? planResult.error ?? subscriptionResult.error);
    return NextResponse.json({ error: '결제 상태를 불러오지 못했습니다.' }, { status: 500 });
  }
  const count = memberResult.count;
  const plan = planResult.data;
  const subscription = subscriptionResult.data;

  const beta = await getAppBetaQualification(group.app_id, group.owner_id);
  const betaPeriodEnabled = plan?.beta_period_enabled !== false;
  const allowedSeats =
    override.billingComp && override.compSeats
      ? override.compSeats
      : subscription?.status === 'active'
        ? subscription.seat_count
        : betaPeriodEnabled
          ? plan?.beta_free_seats ?? plan?.included_seats ?? 2
          : 1;

  return NextResponse.json({
    appId: group.app_id,
    isOwner: group.owner_id === authResult.user.id,
    originalUploadEnabled,
    quotaBytes,
    memberCount: count ?? 0,
    allowedSeats,
    betaOwner: beta.qualified,
    betaPeriodEnabled,
    virtualPayment: process.env.BILLING_ACCEPT_LIVE_STORE !== 'true',
    currency: plan?.currency ?? 'usd',
    basePriceCents: plan?.base_price_cents ?? 100,
    extraSeatPriceCents: plan?.extra_seat_price_cents ?? 100,
    storageUpgradePriceCents: plan?.storage_upgrade_price_cents ?? 100,
    betaDiscountPercent: plan?.beta_discount_percent ?? 50,
  });
}
