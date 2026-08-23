import type { SupabaseClient } from '@supabase/supabase-js';
import { formatUnknownError, isAbortLikeError, isTransientClientError } from '@/lib/supabase-error';
import { normalizeGroupId } from '@/lib/validation';
import { sameGroupId } from '@/lib/group-id-resolve';

export const GROUP_SUSPENDED_CODE = 'GROUP_SUSPENDED';
export const ACCESS_UNAVAILABLE_PATH = '/access-unavailable';

type SuspensionRow = {
  group_id: string;
  user_id: string | null;
  scope: string;
};

export type UserGroupAccess = {
  groupIds: string[];
  accessibleGroupIds: string[];
  suspendedGroupIds: string[];
  lookupFailed: boolean;
};

export type SuspendCheckResult = {
  blocked: boolean;
  lookupFailed: boolean;
};

const ACCESS_LOOKUP_ATTEMPTS = 2;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function suspendedPath(groupId?: string | null): string {
  const id = groupId?.trim();
  if (id) return `/suspended?group=${encodeURIComponent(id)}`;
  return '/suspended';
}

export function classifyGroupAccess(
  groupIds: string[],
  userId: string,
  rows: SuspensionRow[],
): UserGroupAccess {
  const normalizedUserId = userId.toLowerCase();
  const normalizedIds = groupIds.map((id) => id.toLowerCase());
  const suspended = new Set<string>();
  for (const row of rows) {
    const groupId = String(row.group_id).toLowerCase();
    if (row.scope === 'group') {
      suspended.add(groupId);
    } else if (row.scope === 'user_in_group' && String(row.user_id).toLowerCase() === normalizedUserId) {
      suspended.add(groupId);
    }
  }
  return {
    groupIds: normalizedIds,
    accessibleGroupIds: normalizedIds.filter((id) => !suspended.has(id)),
    suspendedGroupIds: normalizedIds.filter((id) => suspended.has(id)),
    lookupFailed: false,
  };
}

export function resolveSuspendRedirect(
  access: UserGroupAccess,
  options?: { openGroup?: string | null; savedGroupId?: string | null },
): string | null {
  if (access.lookupFailed) return ACCESS_UNAVAILABLE_PATH;
  if (access.groupIds.length === 0) return null;
  const openGroup = normalizeGroupId(options?.openGroup);
  if (openGroup && access.suspendedGroupIds.some((id) => sameGroupId(id, openGroup))) {
    return suspendedPath(openGroup);
  }
  if (access.accessibleGroupIds.length === 0) {
    return '/suspended';
  }
  const savedGroupId = normalizeGroupId(options?.savedGroupId);
  if (savedGroupId && access.suspendedGroupIds.some((id) => sameGroupId(id, savedGroupId))) {
    return suspendedPath(savedGroupId);
  }
  return null;
}

function untypedClient(supabase: SupabaseClient): SupabaseClient {
  return supabase as SupabaseClient;
}

async function isSystemAdminUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await untypedClient(supabase).rpc('is_system_admin', {
    user_id_param: userId,
  });
  if (error) {
    if (!isAbortLikeError(error)) {
      console.error('is_system_admin 오류:', formatUnknownError(error));
    }
    return false;
  }
  return data === true;
}

async function loadUserGroupAccessOnce(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserGroupAccess> {
  const client = untypedClient(supabase);
  const [{ data: memberships, error: memError }, { data: owned, error: ownedError }] = await Promise.all([
    client.from('memberships').select('group_id').eq('user_id', userId),
    client.from('groups').select('id').eq('owner_id', userId),
  ]);

  if (memError || ownedError) {
    const err = memError || ownedError;
    if (!isTransientClientError(err)) {
      console.error('그룹 목록 조회 오류:', formatUnknownError(err));
    }
    return { groupIds: [], accessibleGroupIds: [], suspendedGroupIds: [], lookupFailed: true };
  }

  const ids = new Set<string>();
  for (const row of memberships || []) ids.add(String((row as { group_id: string }).group_id));
  for (const row of owned || []) ids.add(String((row as { id: string }).id));
  const groupIds = Array.from(ids);
  if (groupIds.length === 0) {
    return { groupIds: [], accessibleGroupIds: [], suspendedGroupIds: [], lookupFailed: false };
  }

  if (await isSystemAdminUser(client, userId)) {
    return { groupIds, accessibleGroupIds: groupIds, suspendedGroupIds: [], lookupFailed: false };
  }

  const { data, error } = await client
    .from('account_suspensions' as never)
    .select('group_id, user_id, scope')
    .eq('is_active', true)
    .in('group_id', groupIds);
  if (error) {
    if (!isTransientClientError(error)) {
      console.error('정지 상태 조회 오류:', formatUnknownError(error));
    }
    return { groupIds, accessibleGroupIds: [], suspendedGroupIds: [], lookupFailed: true };
  }

  return classifyGroupAccess(groupIds, userId, (data || []) as SuspensionRow[]);
}

/**
 * 그룹/정지 접근 조회. 로그인 직후 모바일에서 REST가 끊기면 일시적으로 lookupFailed가 나므로
 * 짧은 백오프로 재시도한다. 정지 판정 자체(RLS·정책)는 바꾸지 않는다.
 */
export async function loadUserGroupAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserGroupAccess> {
  let last = await loadUserGroupAccessOnce(supabase, userId);
  for (let attempt = 1; attempt < ACCESS_LOOKUP_ATTEMPTS && last.lookupFailed; attempt++) {
    await sleep(280 + (attempt - 1) * 220);
    last = await loadUserGroupAccessOnce(supabase, userId);
  }
  return last;
}

export async function checkUserSuspendedInGroup(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<SuspendCheckResult> {
  if (await isSystemAdminUser(supabase, userId)) {
    return { blocked: false, lookupFailed: false };
  }
  const { data, error } = await supabase.rpc('is_user_suspended_in_group', {
    p_user_id: userId,
    p_group_id: groupId,
  });
  if (error) {
    console.error('is_user_suspended_in_group 오류:', error);
    return { blocked: false, lookupFailed: true };
  }
  return { blocked: Boolean(data), lookupFailed: false };
}

/** @deprecated use checkUserSuspendedInGroup — lookup failure is treated as not blocked */
export async function isUserSuspendedInGroup(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<boolean> {
  const result = await checkUserSuspendedInGroup(supabase, userId, groupId);
  return result.blocked;
}

export function messageFromSuspendRpcError(raw: string | null | undefined): 'ALL_GROUPS_SUSPENDED' | 'GROUP_SUSPENDED' | null {
  const text = String(raw || '');
  if (text.includes('ALL_GROUPS_SUSPENDED')) return 'ALL_GROUPS_SUSPENDED';
  if (text.includes('GROUP_SUSPENDED')) return 'GROUP_SUSPENDED';
  return null;
}
