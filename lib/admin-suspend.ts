export const SUSPEND_SCOPES = ['user_in_group', 'group'] as const;
export type SuspendScope = (typeof SUSPEND_SCOPES)[number];

export const SUSPEND_ACTIONS = ['suspend', 'unsuspend'] as const;
export type SuspendAction = (typeof SUSPEND_ACTIONS)[number];

export const MODERATION_AUTHOR_KINDS = ['system_admin', 'member'] as const;
export type ModerationAuthorKind = (typeof MODERATION_AUTHOR_KINDS)[number];

export const MESSAGE_MAX_LENGTH = 500;
export const MESSAGE_MIN_LENGTH = 1;

export type UserGroupSuspendRow = {
  groupId: string;
  groupName: string;
  isOwner: boolean;
  userSuspended: boolean;
  groupSuspended: boolean;
};

export type SuspendSummary = {
  userGroupPairs: Array<{ userId: string; groupId: string }>;
  groupIds: string[];
};

export function userSuspendBadgeKind(
  userId: string,
  groupsCount: number,
  pairs: Array<{ userId: string; groupId: string }>,
): 'none' | 'partial' | 'all' {
  const n = pairs.reduce((count, pair) => count + (pair.userId === userId ? 1 : 0), 0);
  if (n <= 0) return 'none';
  if (groupsCount <= 0 || n >= groupsCount) return 'all';
  return 'partial';
}

export function isSuspendAction(value: string): value is SuspendAction {
  return (SUSPEND_ACTIONS as readonly string[]).includes(value);
}

export function isSuspendScope(value: string): value is SuspendScope {
  return (SUSPEND_SCOPES as readonly string[]).includes(value);
}

export function normalizeSuspendMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (text.length < MESSAGE_MIN_LENGTH || text.length > MESSAGE_MAX_LENGTH) return null;
  return text;
}
