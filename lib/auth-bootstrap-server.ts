import { getSupabaseServerClient } from '@/lib/api-helpers';
import { classifyGroupAccess } from '@/lib/account-suspend-access';
import { isSystemAdmin } from '@/lib/permissions';

export type BootstrapGroupSummary = {
  id: string;
  name: string;
  invite_code: string;
  is_owner: boolean;
  role: 'ADMIN' | 'MEMBER';
  display_name_pending: boolean;
};

export type BootstrapMembershipRole = {
  group_id: string;
  role: 'ADMIN' | 'MEMBER';
  family_role: string | null;
};

export type AuthBootstrapPayload = {
  user: {
    id: string;
    email: string | null;
    emailConfirmed: boolean;
  };
  isSystemAdmin: boolean;
  hasGroups: boolean;
  groupIds: string[];
  accessibleGroupIds: string[];
  suspendedGroupIds: string[];
  lookupFailed: boolean;
  /** 온보딩 그룹 선택 UI */
  groups: BootstrapGroupSummary[];
  /** GroupContext 초기 seed (PR-3) */
  groupRows: Record<string, unknown>[];
  membershipRoles: BootstrapMembershipRole[];
  ownedGroupIds: string[];
};

type BootstrapUserInput = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

type MembershipJoinRow = {
  group_id: string;
  role: string;
  family_role: string | null;
  groups: {
    id: string;
    name: string;
    invite_code: string;
    owner_id: string;
    display_name_pending: boolean | null;
  } | null;
};

type OwnedGroupRow = Record<string, unknown> & {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  display_name_pending?: boolean | null;
};

function toUserMeta(user: BootstrapUserInput): AuthBootstrapPayload['user'] {
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
  };
}

function emptyPayload(
  user: BootstrapUserInput,
  adminFlag: boolean,
  lookupFailed: boolean,
): AuthBootstrapPayload {
  const userMeta = toUserMeta(user);
  return {
    user: userMeta,
    isSystemAdmin: adminFlag,
    hasGroups: false,
    groupIds: [],
    accessibleGroupIds: [],
    suspendedGroupIds: [],
    lookupFailed,
    groups: [],
    groupRows: [],
    membershipRoles: [],
    ownedGroupIds: [],
  };
}

function buildGroupSummaries(
  userId: string,
  memberships: MembershipJoinRow[] | null,
  ownedGroups: OwnedGroupRow[] | null,
): {
  summaries: BootstrapGroupSummary[];
  membershipRoles: BootstrapMembershipRole[];
  ownedGroupIds: string[];
} {
  const summaries: BootstrapGroupSummary[] = [];
  const membershipRoles: BootstrapMembershipRole[] = [];
  const ownedGroupIds = (ownedGroups || []).map((g) => String(g.id));
  const seen = new Set<string>();

  for (const group of ownedGroups || []) {
    const id = String(group.id);
    if (seen.has(id)) continue;
    seen.add(id);
    summaries.push({
      id,
      name: String(group.name ?? ''),
      invite_code: String(group.invite_code ?? ''),
      is_owner: true,
      role: 'ADMIN',
      display_name_pending: Boolean(group.display_name_pending),
    });
  }

  for (const row of memberships || []) {
    membershipRoles.push({
      group_id: String(row.group_id),
      role: row.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      family_role: row.family_role ?? null,
    });
    const group = row.groups;
    if (!group || seen.has(group.id)) continue;
    seen.add(group.id);
    summaries.push({
      id: String(group.id),
      name: String(group.name ?? ''),
      invite_code: String(group.invite_code ?? ''),
      is_owner: String(group.owner_id) === userId,
      role: row.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      display_name_pending: Boolean(group.display_name_pending),
    });
  }

  return { summaries, membershipRoles, ownedGroupIds };
}

/**
 * 로그인·온보딩·대시보드 진입에 필요한 그룹·정지·관리자 판정을 서버에서 한 번에 계산.
 */
export async function computeAuthBootstrap(user: BootstrapUserInput): Promise<AuthBootstrapPayload> {
  const supabase = getSupabaseServerClient();
  const userId = user.id;
  const userMeta = toUserMeta(user);

  const [adminFlag, membershipsRes, ownedRes] = await Promise.all([
    isSystemAdmin(userId),
    supabase
      .from('memberships')
      .select('group_id, role, family_role, groups(id, name, invite_code, owner_id, display_name_pending)')
      .eq('user_id', userId),
    supabase.from('groups').select('*').eq('owner_id', userId),
  ]);

  if (membershipsRes.error || ownedRes.error) {
    console.error('auth bootstrap 그룹 조회 오류:', membershipsRes.error || ownedRes.error);
    return emptyPayload(user, adminFlag, true);
  }

  const { summaries, membershipRoles, ownedGroupIds } = buildGroupSummaries(
    userId,
    (membershipsRes.data || []) as unknown as MembershipJoinRow[],
    (ownedRes.data || []) as OwnedGroupRow[],
  );
  const groupIds = summaries.map((g) => g.id);

  if (groupIds.length === 0) {
    return {
      ...emptyPayload(user, adminFlag, false),
      user: userMeta,
    };
  }

  const { data: groupRows, error: groupRowsError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (groupRowsError) {
    console.error('auth bootstrap 그룹 상세 조회 오류:', groupRowsError);
    return {
      ...emptyPayload(user, adminFlag, true),
      user: userMeta,
      hasGroups: true,
      groupIds,
      groups: summaries,
      membershipRoles,
      ownedGroupIds,
    };
  }

  const base = {
    user: userMeta,
    hasGroups: true,
    groupIds,
    groups: summaries,
    groupRows: (groupRows || []) as Record<string, unknown>[],
    membershipRoles,
    ownedGroupIds,
  };

  if (adminFlag) {
    return {
      ...base,
      isSystemAdmin: true,
      accessibleGroupIds: groupIds,
      suspendedGroupIds: [],
      lookupFailed: false,
    };
  }

  const { data: suspensions, error: suspendError } = await supabase
    .from('account_suspensions')
    .select('group_id, user_id, scope')
    .eq('is_active', true)
    .in('group_id', groupIds);

  if (suspendError) {
    console.error('auth bootstrap 정지 조회 오류:', suspendError);
    return {
      ...base,
      isSystemAdmin: false,
      accessibleGroupIds: [],
      suspendedGroupIds: [],
      lookupFailed: true,
    };
  }

  const access = classifyGroupAccess(
    groupIds,
    userId,
    (suspensions || []) as Array<{ group_id: string; user_id: string | null; scope: string }>,
  );

  return {
    ...base,
    isSystemAdmin: false,
    accessibleGroupIds: access.accessibleGroupIds,
    suspendedGroupIds: access.suspendedGroupIds,
    lookupFailed: false,
  };
}
