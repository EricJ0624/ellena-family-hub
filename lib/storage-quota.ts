import { getSupabaseServerClient } from '@/lib/api-helpers';
import { DB_TABLES } from '@/lib/db-table-names';

export const DEFAULT_GROUP_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

export async function getGroupStorageQuotaBytes(groupId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('groups')
    .select('storage_quota_bytes')
    .eq('id', groupId)
    .single();

  if (error) {
    console.error('그룹 용량 한도 조회 오류:', error);
    return DEFAULT_GROUP_STORAGE_QUOTA_BYTES;
  }

  return data?.storage_quota_bytes ?? DEFAULT_GROUP_STORAGE_QUOTA_BYTES;
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
