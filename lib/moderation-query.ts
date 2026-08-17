import { getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';
import { getGroupDisplayNameRaw } from '@/lib/group-display-name';
import { normalizeSuspendMessage, type ModerationAuthorKind } from '@/lib/admin-suspend';
import { notifyModerationReply } from '@/lib/moderation-notify';

export type ModerationMessageRow = {
  id: string;
  threadId: string;
  authorId: string;
  authorKind: ModerationAuthorKind;
  body: string;
  createdAt: string;
};

export type ModerationThreadDetail = {
  threadId: string;
  scope: string;
  groupId: string;
  groupName: string;
  userId: string | null;
  userLabel: string | null;
  updatedAt: string;
  messages: ModerationMessageRow[];
};

export async function canAccessModerationThread(userId: string, threadId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data: thread, error } = await supabase
    .from('moderation_threads' as never)
    .select('id, scope, group_id, user_id, deleted_at')
    .eq('id', threadId)
    .maybeSingle();
  if (error || !thread) return false;

  const row = thread as { group_id: string; user_id: string | null; deleted_at: string | null };
  if (row.deleted_at) return false;
  if (await isSystemAdmin(userId)) return true;
  if (row.user_id && String(row.user_id) === userId) return true;
  if (row.user_id) return false;

  const [{ data: membership }, { data: owned }] = await Promise.all([
    supabase.from('memberships').select('group_id').eq('user_id', userId).eq('group_id', row.group_id).maybeSingle(),
    supabase.from('groups').select('id').eq('id', row.group_id).eq('owner_id', userId).maybeSingle(),
  ]);
  return Boolean(membership || owned);
}

export async function insertModerationMessage(params: {
  threadId: string;
  authorId: string;
  authorKind: ModerationAuthorKind;
  body: string;
}): Promise<ModerationMessageRow> {
  const message = normalizeSuspendMessage(params.body);
  if (!message) {
    throw new Error('메시지는 1~500자로 입력해야 합니다.');
  }

  const allowed = await canAccessModerationThread(params.authorId, params.threadId);
  if (!allowed) {
    throw new Error('이 문의에 답장할 수 없습니다.');
  }

  const supabase = getSupabaseServerClient();
  if (params.authorKind === 'member') {
    const { data: active } = await supabase
      .from('account_suspensions' as never)
      .select('id')
      .eq('thread_id', params.threadId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!active) {
      throw new Error('이 문의에 답장할 수 없습니다.');
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('moderation_messages' as never)
    .insert({
      thread_id: params.threadId,
      author_id: params.authorId,
      author_kind: params.authorKind,
      body: message,
    })
    .select('id, thread_id, author_id, author_kind, body, created_at')
    .single();
  if (error || !data) throw error || new Error('메시지 저장에 실패했습니다.');

  await supabase.from('moderation_threads' as never).update({ updated_at: now }).eq('id', params.threadId);

  const row = data as {
    id: string;
    thread_id: string;
    author_id: string;
    author_kind: string;
    body: string;
    created_at: string;
  };
  const saved: ModerationMessageRow = {
    id: String(row.id),
    threadId: String(row.thread_id),
    authorId: String(row.author_id),
    authorKind: row.author_kind === 'system_admin' ? 'system_admin' : 'member',
    body: String(row.body),
    createdAt: String(row.created_at),
  };

  void notifyModerationReply({
    threadId: saved.threadId,
    authorId: saved.authorId,
    authorKind: saved.authorKind,
    body: saved.body,
  });

  return saved;
}

export async function listModerationThreadsForAdmin(): Promise<ModerationThreadDetail[]> {
  const supabase = getSupabaseServerClient();
  const { data: threads, error } = await supabase
    .from('moderation_threads' as never)
    .select('id, scope, group_id, user_id, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const threadRows = (threads || []) as Array<{
    id: string;
    scope: string;
    group_id: string;
    user_id: string | null;
    updated_at: string;
  }>;
  if (threadRows.length === 0) return [];

  const threadIds = threadRows.map((row) => row.id);
  const groupIds = [...new Set(threadRows.map((row) => String(row.group_id)))];
  const userIds = [...new Set(threadRows.map((row) => row.user_id).filter((id): id is string => !!id))];

  const [{ data: groups }, { data: profiles }, { data: messages }] = await Promise.all([
    supabase.from('groups').select('id, name, family_name, display_name_pending, title_style').in('id', groupIds),
    userIds.length
      ? supabase.from('profiles').select('id, email, nickname').in('id', userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; nickname: string | null }> }),
    supabase
      .from('moderation_messages' as never)
      .select('id, thread_id, author_id, author_kind, body, created_at')
      .in('thread_id', threadIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ]);

  const groupNameById = new Map<string, string>();
  for (const group of groups || []) {
    const g = group as { id: string; name?: string; family_name?: string; display_name_pending?: boolean; title_style?: unknown };
    groupNameById.set(String(g.id), getGroupDisplayNameRaw(g) || String(g.id).slice(0, 8));
  }
  const userLabelById = new Map<string, string>();
  for (const profile of profiles || []) {
    const p = profile as { id: string; email: string | null; nickname: string | null };
    userLabelById.set(String(p.id), p.nickname || p.email || String(p.id).slice(0, 8));
  }

  const messagesByThread = new Map<string, ModerationMessageRow[]>();
  for (const row of (messages || []) as Array<{
    id: string;
    thread_id: string;
    author_id: string;
    author_kind: string;
    body: string;
    created_at: string;
  }>) {
    const list = messagesByThread.get(String(row.thread_id)) || [];
    list.push({
      id: String(row.id),
      threadId: String(row.thread_id),
      authorId: String(row.author_id),
      authorKind: row.author_kind === 'system_admin' ? 'system_admin' : 'member',
      body: String(row.body),
      createdAt: String(row.created_at),
    });
    messagesByThread.set(String(row.thread_id), list);
  }

  return threadRows.map((row) => ({
    threadId: String(row.id),
    scope: String(row.scope),
    groupId: String(row.group_id),
    groupName: groupNameById.get(String(row.group_id)) || String(row.group_id).slice(0, 8),
    userId: row.user_id ? String(row.user_id) : null,
    userLabel: row.user_id ? userLabelById.get(String(row.user_id)) || String(row.user_id).slice(0, 8) : null,
    updatedAt: String(row.updated_at),
    messages: messagesByThread.get(String(row.id)) || [],
  }));
}

export async function softDeleteModerationThread(params: {
  threadId: string;
  adminId: string;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('moderation_threads' as never)
    .update({ deleted_at: now, deleted_by: params.adminId, updated_at: now })
    .eq('id', params.threadId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('문의 실을 찾을 수 없습니다.');

  await supabase
    .from('moderation_messages' as never)
    .update({ deleted_at: now, deleted_by: params.adminId })
    .eq('thread_id', params.threadId)
    .is('deleted_at', null);
}
