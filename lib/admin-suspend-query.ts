import { getSupabaseServerClient } from '@/lib/api-helpers';
import { getGroupDisplayNameRaw } from '@/lib/group-display-name';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { isSystemAdmin } from '@/lib/permissions';
import type { SuspendAction, SuspendScope, UserGroupSuspendRow } from '@/lib/admin-suspend';
import { notifySuspendAction } from '@/lib/moderation-notify';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

async function getOrCreateThread(params: {
  scope: SuspendScope;
  groupId: string;
  userId: string | null;
}): Promise<string> {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from('moderation_threads')
    .select('id')
    .eq('scope', params.scope)
    .eq('group_id', params.groupId);
  query = params.userId ? query.eq('user_id', params.userId) : query.is('user_id', null);

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return String(existing.id);

  const { data: created, error: insertError } = await supabase
    .from('moderation_threads')
    .insert({
      scope: params.scope,
      group_id: params.groupId,
      user_id: params.userId,
    })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return String(created.id);
}

export async function listUserGroupsForSuspend(userId: string): Promise<UserGroupSuspendRow[]> {
  const supabase = getSupabaseServerClient();

  const [{ data: memberships, error: memError }, { data: owned, error: ownedError }] = await Promise.all([
    supabase.from('memberships').select('group_id').eq('user_id', userId),
    supabase.from('groups').select('id, name, family_name, display_name_pending, title_style, owner_id').eq('owner_id', userId),
  ]);
  if (memError) throw memError;
  if (ownedError) throw ownedError;

  const groupIds = new Set<string>();
  for (const row of memberships || []) groupIds.add(String(row.group_id));
  for (const row of owned || []) groupIds.add(String(row.id));

  if (groupIds.size === 0) return [];

  const ids = Array.from(groupIds);
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, name, family_name, display_name_pending, title_style, owner_id')
    .in('id', ids);
  if (groupsError) throw groupsError;

  const { data: suspensions, error: susError } = await supabase
    .from('account_suspensions')
    .select('group_id, user_id, scope')
    .eq('is_active', true)
    .in('group_id', ids);
  if (susError) throw susError;

  const groupSuspended = new Set<string>();
  const userSuspended = new Set<string>();
  for (const row of suspensions || []) {
    if (row.scope === 'group') groupSuspended.add(String(row.group_id));
    if (row.scope === 'user_in_group' && String(row.user_id) === userId) {
      userSuspended.add(String(row.group_id));
    }
  }

  return (groups || [])
    .map((group) => ({
      groupId: String(group.id),
      groupName: getGroupDisplayNameRaw(group) ?? '',
      isOwner: String(group.owner_id) === userId,
      userSuspended: userSuspended.has(String(group.id)),
      groupSuspended: groupSuspended.has(String(group.id)),
    }))
    .sort((a, b) => (a.groupName || a.groupId).localeCompare(b.groupName || b.groupId));
}

export async function loadSuspendSummary(): Promise<{
  userGroupPairs: Array<{ userId: string; groupId: string }>;
  groupIds: string[];
}> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('account_suspensions')
    .select('scope, group_id, user_id')
    .eq('is_active', true);
  if (error) throw error;

  const userGroupPairs: Array<{ userId: string; groupId: string }> = [];
  const groupIds: string[] = [];
  for (const row of data || []) {
    if (row.scope === 'group') {
      groupIds.push(String(row.group_id));
    } else if (row.user_id) {
      userGroupPairs.push({ userId: String(row.user_id), groupId: String(row.group_id) });
    }
  }
  return { userGroupPairs, groupIds };
}

export async function applySuspendAction(params: {
  action: SuspendAction;
  scope: SuspendScope;
  adminId: string;
  userId: string | null;
  groupIds: string[];
  message: string;
  request: Request;
}): Promise<{ applied: number; skipped: number }> {
  if (params.scope === 'user_in_group' && !params.userId) {
    throw new Error('회원 정지에는 사용자 ID가 필요합니다.');
  }
  if (params.scope === 'group' && params.userId) {
    throw new Error('그룹 정지는 그룹만 지정합니다.');
  }
  if (params.action === 'suspend' && params.userId && (await isSystemAdmin(params.userId))) {
    throw new Error('시스템 관리자는 정지할 수 없습니다.');
  }
  if (params.action === 'suspend' && params.userId && params.userId === params.adminId) {
    throw new Error('본인 계정은 정지할 수 없습니다.');
  }
  if (params.groupIds.length === 0) {
    throw new Error('그룹을 하나 이상 선택하세요.');
  }

  const supabase = getSupabaseServerClient();
  let applied = 0;
  let skipped = 0;

  for (const groupId of params.groupIds) {
    const threadId = await getOrCreateThread({
      scope: params.scope,
      groupId,
      userId: params.scope === 'user_in_group' ? params.userId : null,
    });

    let existingQuery = supabase
      .from('account_suspensions')
      .select('id')
      .eq('is_active', true)
      .eq('scope', params.scope)
      .eq('group_id', groupId);
    existingQuery =
      params.scope === 'user_in_group'
        ? existingQuery.eq('user_id', params.userId)
        : existingQuery.is('user_id', null);
    const { data: existing, error: existError } = await existingQuery.maybeSingle();
    if (existError) throw existError;

    const alreadyActive = Boolean(existing?.id);
    if (params.action === 'unsuspend' && !alreadyActive) {
      skipped += 1;
      continue;
    }

    const { error: msgError } = await supabase.from('moderation_messages').insert({
      thread_id: threadId,
      author_id: params.adminId,
      author_kind: 'system_admin',
      body: params.message,
    });
    if (msgError) throw msgError;

    const now = new Date().toISOString();
    if (params.action === 'suspend') {
      if (alreadyActive) {
        skipped += 1;
      } else {
        const { error: insertError } = await supabase.from('account_suspensions').insert({
          thread_id: threadId,
          scope: params.scope,
          group_id: groupId,
          user_id: params.scope === 'user_in_group' ? params.userId : null,
          is_active: true,
          suspended_by: params.adminId,
          suspended_at: now,
        });
        if (insertError) throw insertError;
        applied += 1;
      }
    } else {
      const { error: updateError } = await supabase
        .from('account_suspensions')
        .update({
          is_active: false,
          unsuspended_by: params.adminId,
          unsuspended_at: now,
          updated_at: now,
        })
        .eq('id', existing!.id);
      if (updateError) throw updateError;
      applied += 1;
    }

    await supabase.from('moderation_threads').update({ updated_at: now }).eq('id', threadId);
    void notifySuspendAction({
      action: params.action,
      scope: params.scope,
      adminId: params.adminId,
      groupId,
      userId: params.userId,
      message: params.message,
    });
  }

  const meta = getAuditRequestMeta(params.request);
  await writeAdminAuditLog(supabase, {
    adminId: params.adminId,
    action: params.action === 'suspend' ? 'UPDATE' : 'RESTORE',
    resourceType: params.scope === 'group' ? 'group_suspend' : 'user_suspend',
    resourceId: params.userId,
    groupId: params.groupIds[0] ?? null,
    targetUserId: params.userId,
    details: {
      action: params.action,
      scope: params.scope,
      group_ids: params.groupIds,
      applied,
      skipped,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { applied, skipped };
}
