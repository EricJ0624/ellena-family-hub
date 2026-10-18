import { getSupabaseServerClient } from '@/lib/api-helpers';
import { isAppId } from '@/lib/apps';
import { getBillingGroupOverride } from '@/lib/billing-group-override';
import { getAppBetaQualification } from '@/lib/beta-testers';
import { DB_TABLES } from '@/lib/db-table-names';

export const DEFAULT_GROUP_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

export async function getGroupStorageQuotaBytes(groupId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('groups')
    .select('owner_id, app_id, storage_quota_bytes')
    .eq('id', groupId)
    .single();

  if (error || !data) {
    console.error('그룹 용량 한도 조회 오류:', error);
    return DEFAULT_GROUP_STORAGE_QUOTA_BYTES;
  }

  const storedQuota = data.storage_quota_bytes ?? DEFAULT_GROUP_STORAGE_QUOTA_BYTES;
  const appId = data.app_id;
  if (!isAppId(appId)) return storedQuota;

  const override = await getBillingGroupOverride(groupId);
  if (override.quotaAdminSet) return storedQuota;

  const { data: subscription } = await supabase
    .from('billing_subscriptions')
    .select('status, quota_bytes')
    .eq('app_id', appId)
    .eq('group_id', groupId)
    .maybeSingle();
  if (subscription?.status === 'active' && subscription.quota_bytes) {
    return subscription.quota_bytes;
  }

  try {
    const beta = await getAppBetaQualification(appId, data.owner_id);
    if (!beta.qualified) return storedQuota;
    const { data: plan } = await supabase
      .from('billing_plans')
      .select('beta_free_quota_bytes')
      .eq('app_id', appId)
      .maybeSingle();
    return plan?.beta_free_quota_bytes ?? storedQuota;
  } catch (betaError) {
    console.error('베타 용량 계산 오류:', betaError);
    return storedQuota;
  }
}

export async function groupAllowsOriginalUpload(groupId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data: group } = await supabase
    .from('groups')
    .select('app_id, storage_quota_bytes')
    .eq('id', groupId)
    .maybeSingle();
  if (!group || !isAppId(group.app_id)) return false;

  const { data: plan } = await supabase
    .from('billing_plans')
    .select('upgraded_quota_bytes')
    .eq('app_id', group.app_id)
    .maybeSingle();
  if (!plan?.upgraded_quota_bytes) return false;

  const override = await getBillingGroupOverride(groupId);
  if (override.quotaAdminSet) {
    return (group.storage_quota_bytes ?? 0) >= plan.upgraded_quota_bytes;
  }

  const { data: subscription } = await supabase
    .from('billing_subscriptions')
    .select('status, quota_bytes')
    .eq('app_id', group.app_id)
    .eq('group_id', groupId)
    .maybeSingle();
  if (subscription?.status !== 'active' || !subscription.quota_bytes) return false;
  return subscription.quota_bytes >= plan.upgraded_quota_bytes;
}

export async function getGroupStorageUsedBytes(groupId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const [{ data, error }, { data: sceneRows, error: sceneError }] = await Promise.all([
    supabase
      .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
      .select('original_file_size')
      .eq('group_id', groupId),
    supabase
      .from('picture_find_scenes')
      .select('image_size_bytes, variant_image_size_bytes')
      .eq('group_id', groupId)
      .eq('scope', 'group')
      .eq('is_active', true),
  ]);

  if (error) {
    console.error('그룹 사용량 조회 오류:', error);
  }
  if (sceneError && sceneError.code !== '42P01') {
    console.error('그림찾기 장면 용량 조회 오류:', sceneError);
  }

  const albumBytes = (data || []).reduce((sum, row) => sum + (row.original_file_size || 0), 0);
  const sceneBytes = (sceneRows || []).reduce(
    (sum, row) => sum + (row.image_size_bytes || 0) + (row.variant_image_size_bytes || 0),
    0,
  );
  return albumBytes + sceneBytes;
}

export async function getGroupStorageStats(groupId: string): Promise<{
  quotaBytes: number;
  usedBytes: number;
  remainingBytes: number;
}> {
  const [quotaBytes, usedBytes] = await Promise.all([
    getGroupStorageQuotaBytes(groupId),
    getGroupStorageUsedBytes(groupId),
  ]);

  return {
    quotaBytes,
    usedBytes,
    remainingBytes: Math.max(quotaBytes - usedBytes, 0),
  };
}
