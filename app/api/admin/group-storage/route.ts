import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { isAppId } from '@/lib/apps';
import { getAppBetaQualification } from '@/lib/beta-testers';
import { getBillingGroupOverride } from '@/lib/billing-group-override';
import { DEFAULT_GROUP_STORAGE_QUOTA_BYTES, getGroupStorageQuotaBytes, getGroupStorageUsedBytes } from '@/lib/storage-quota';

/**
 * 시스템 관리자 전용: 전 앱 그룹 저장용량 목록/변경.
 * (일반 사용자·대시보드 그룹 접근은 CURRENT_APP_ID 격리 유지)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, owner_id, created_at, storage_quota_bytes, app_id')
      .order('created_at', { ascending: false })
      .limit(500);

    if (groupsError) {
      console.error('그룹 조회 오류:', groupsError);
      return NextResponse.json(
        { error: '그룹 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!groupsData || groupsData.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const groupIds = groupsData.map((group) => group.id);
    const appIds = [...new Set(groupsData.map((group) => group.app_id).filter((id): id is string => Boolean(id)))];
    const [{ data: overrides }, { data: plans }, { data: subscriptions }] = await Promise.all([
      supabase
        .from('billing_group_overrides')
        .select('group_id, billing_comp, comp_seats, quota_admin_set')
        .in('group_id', groupIds),
      supabase
        .from('billing_plans')
        .select('app_id, beta_period_enabled, beta_free_seats, included_seats')
        .in('app_id', appIds),
      supabase
        .from('billing_subscriptions')
        .select('group_id, status, seat_count')
        .in('group_id', groupIds),
    ]);
    const overrideByGroup = new Map(
      (overrides ?? []).map((row) => [String(row.group_id), row]),
    );
    const planByApp = new Map((plans ?? []).map((row) => [String(row.app_id), row]));
    const subscriptionByGroup = new Map(
      (subscriptions ?? []).map((row) => [String(row.group_id), row]),
    );

    const groupsWithDetails = await Promise.all(
      groupsData.map(async (group) => {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', group.owner_id)
          .single();

        let memberCount = 0;
        try {
          const { count } = await supabase
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          memberCount = count || 0;
        } catch (countError) {
          console.warn(`그룹 ${group.id} 멤버 수 조회 오류:`, countError);
        }

        const [usedBytes, quotaBytes] = await Promise.all([
          getGroupStorageUsedBytes(group.id),
          getGroupStorageQuotaBytes(group.id),
        ]);
        const override = overrideByGroup.get(String(group.id));
        const plan = group.app_id ? planByApp.get(String(group.app_id)) : undefined;
        const subscription = subscriptionByGroup.get(String(group.id));
        const compSeats = typeof override?.comp_seats === 'number' ? override.comp_seats : null;
        const allowedSeats =
          override?.billing_comp === true && compSeats
            ? compSeats
            : subscription?.status === 'active' && subscription.seat_count
              ? subscription.seat_count
              : plan?.beta_period_enabled !== false
                ? plan?.beta_free_seats ?? plan?.included_seats ?? 2
                : 1;

        return {
          id: group.id,
          name: group.name,
          app_id: group.app_id ?? null,
          owner_id: group.owner_id,
          owner_email: ownerData?.email || null,
          member_count: memberCount,
          allowed_seats: allowedSeats,
          created_at: group.created_at,
          storage_quota_bytes: quotaBytes,
          storage_used_bytes: usedBytes,
          billing_comp: override?.billing_comp === true,
          billing_comp_seats: compSeats,
          quota_admin_set: override?.quota_admin_set === true,
        };
      })
    );

    return NextResponse.json({ success: true, data: groupsWithDetails });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '그룹 저장 용량 조회 중 오류가 발생했습니다.';
    console.error('그룹 저장 용량 조회 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function restoreUnmanagedQuota(groupId: string) {
  const supabase = getSupabaseServerClient();
  const { data: group } = await supabase
    .from('groups')
    .select('owner_id, app_id')
    .eq('id', groupId)
    .maybeSingle();
  if (!group || !isAppId(group.app_id)) return;

  const { data: subscription } = await supabase
    .from('billing_subscriptions')
    .select('status, quota_bytes')
    .eq('app_id', group.app_id)
    .eq('group_id', groupId)
    .maybeSingle();

  let bytes = DEFAULT_GROUP_STORAGE_QUOTA_BYTES;
  if (subscription?.status === 'active' && subscription.quota_bytes) {
    bytes = subscription.quota_bytes;
  } else {
    const beta = await getAppBetaQualification(group.app_id, group.owner_id);
    if (beta.qualified) {
      const { data: plan } = await supabase
        .from('billing_plans')
        .select('beta_free_quota_bytes')
        .eq('app_id', group.app_id)
        .maybeSingle();
      if (plan?.beta_free_quota_bytes) bytes = plan.beta_free_quota_bytes;
    }
  }

  const { error } = await supabase
    .from('groups')
    .update({ storage_quota_bytes: bytes })
    .eq('id', groupId);
  if (error) console.error('관리 해제 용량 복원 오류:', error);
}

async function clearBillingOverride(groupId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('billing_group_overrides')
    .delete()
    .eq('group_id', groupId);
  if (error) {
    console.error('그룹 결제 설정 해제 오류:', error);
    return false;
  }
  await restoreUnmanagedQuota(groupId);
  return true;
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json();
    const { groupId, storageQuotaBytes, storageQuotaGb, billingComp, billingCompSeats, releaseQuotaLock } = body;

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (releaseQuotaLock === true) {
      const existing = await getBillingGroupOverride(groupId);
      if (existing.billingComp) {
        return NextResponse.json(
          { error: '결제 없이 사용 중인 그룹은 그 스위치를 끄면 결제 용량으로 돌아갑니다.' },
          { status: 400 },
        );
      }
      if (existing.quotaAdminSet && !(await clearBillingOverride(groupId))) {
        return NextResponse.json({ error: '용량 잠금을 풀지 못했습니다.' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    const nextComp = billingComp === true;
    const seats = Number(billingCompSeats);
    if (nextComp && (!Number.isInteger(seats) || seats < 1)) {
      return NextResponse.json({ error: '허용 인원은 1명 이상이어야 합니다.' }, { status: 400 });
    }

    if (billingComp === false) {
      if (!(await clearBillingOverride(groupId))) {
        return NextResponse.json({ error: '결제 면제를 해제하지 못했습니다.' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    const resolvedQuotaBytes =
      typeof storageQuotaBytes === 'number'
        ? storageQuotaBytes
        : typeof storageQuotaGb === 'number'
          ? Math.round(storageQuotaGb * 1024 * 1024 * 1024)
          : null;

    if (!resolvedQuotaBytes || resolvedQuotaBytes <= 0) {
      return NextResponse.json(
        { error: 'storageQuotaBytes 또는 storageQuotaGb가 필요합니다.' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('groups')
      .update({ storage_quota_bytes: resolvedQuotaBytes })
      .eq('id', groupId)
      .select('id, storage_quota_bytes, app_id')
      .single();

    if (updateError || !updated || !isAppId(updated.app_id)) {
      console.error('그룹 용량 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '그룹 용량 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    const existing = await getBillingGroupOverride(groupId);

    const { error: overrideError } = await supabase.from('billing_group_overrides').upsert(
      {
        group_id: groupId,
        app_id: updated.app_id,
        quota_admin_set: true,
        billing_comp: nextComp ? true : existing.billingComp,
        comp_seats: nextComp ? seats : existing.compSeats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id' },
    );
    if (overrideError) {
      console.error('그룹 용량 우선 설정 오류:', overrideError);
      return NextResponse.json({ error: '그룹 설정을 저장하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '그룹 저장 용량 업데이트 중 오류가 발생했습니다.';
    console.error('그룹 저장 용량 업데이트 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
