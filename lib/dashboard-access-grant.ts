import type { SupabaseClient } from '@supabase/supabase-js';

type GrantRow = {
  group_id: string | null;
  expires_at: string | null;
};

function stillActive(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time > Date.now();
}

/** 승인됐고 취소·만료되지 않은 대시보드 입장 권한이 있는 그룹. */
export async function listActiveGrantedGroupIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('dashboard_access_requests')
    .select('group_id, expires_at')
    .eq('status', 'approved')
    .is('revoked_at', null)
    .or(`requested_by.eq.${userId},approved_by.eq.${userId}`);

  if (error || !data) {
    if (error) console.error('대시보드 입장 권한 조회 오류:', error);
    return [];
  }

  const ids = new Set<string>();
  for (const row of data as GrantRow[]) {
    if (!row.group_id || !stillActive(row.expires_at)) continue;
    ids.add(row.group_id);
  }
  return [...ids];
}

export async function hasActiveDashboardGrant(
  client: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<boolean> {
  const ids = await listActiveGrantedGroupIds(client, userId);
  const target = groupId.toLowerCase();
  return ids.some((id) => id.toLowerCase() === target);
}
