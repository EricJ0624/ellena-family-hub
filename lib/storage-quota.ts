import { getSupabaseServerClient } from '@/lib/api-helpers';

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
  const { data, error } = await supabase
    .from('memory_vault')
    .select('original_file_size')
    .eq('group_id', groupId);

  if (error) {
    console.error('그룹 사용량 조회 오류:', error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (row.original_file_size || 0), 0);
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
