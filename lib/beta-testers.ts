import { getSupabaseServerClient } from '@/lib/api-helpers';
import type { AppId } from '@/lib/apps';

/** 베타 자격 집계에서 빼는 테스트 계정. 관리자 순번과 가입 화면 숫자가 같은 목록을 쓴다. */
export const BETA_EXCLUDED_EMAILS = ['soungtak@gmail.com', 'soungtak@icloud.com'];

/** 앱별 결제 베타 컷. 관리자 목록의 전역 순번 표시는 바꾸지 않는다. */
export const BETA_QUALIFIED_LIMIT = 100;

export function isBetaExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return BETA_EXCLUDED_EMAILS.includes(email);
}

type AuthUserQualification = {
  email?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  deleted_at?: string | null;
};

function isQualifiedBetaTester(user: AuthUserQualification): boolean {
  if (!user.email_confirmed_at) return false;
  if (user.deleted_at != null) return false;
  if (user.banned_until != null) return false;
  if (isBetaExcludedEmail(user.email)) return false;
  return true;
}

/**
 * 이 앱의 베타 자격 인원.
 * 이메일 인증 완료, 이 앱 그룹 소속(멤버 또는 소유자), 테스트 계정 제외, 정지·탈퇴 아님.
 * 가입 한도 차단에는 쓰지 않는다.
 */
export async function countQualifiedBetaTesters(appId: AppId): Promise<number> {
  const supabase = getSupabaseServerClient();

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, owner_id')
    .eq('app_id', appId);
  if (groupsError) throw groupsError;

  const groupIds = (groups ?? []).map((group) => group.id).filter((id): id is string => Boolean(id));
  const userIds = new Set<string>();
  for (const group of groups ?? []) {
    if (group.owner_id) userIds.add(group.owner_id);
  }

  const { data: membershipsByApp, error: membershipsByAppError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('app_id', appId);
  if (membershipsByAppError) throw membershipsByAppError;
  for (const membership of membershipsByApp ?? []) {
    if (membership.user_id) userIds.add(membership.user_id);
  }

  if (groupIds.length > 0) {
    const { data: membershipsByGroup, error: membershipsByGroupError } = await supabase
      .from('memberships')
      .select('user_id, app_id')
      .in('group_id', groupIds);
    if (membershipsByGroupError) throw membershipsByGroupError;
    for (const membership of membershipsByGroup ?? []) {
      if (!membership.user_id) continue;
      if (membership.app_id && membership.app_id !== appId) continue;
      userIds.add(membership.user_id);
    }
  }

  if (userIds.size === 0) return 0;

  const ids = Array.from(userIds);
  let count = 0;
  const chunkSize = 10;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const results = await Promise.all(chunk.map((id) => supabase.auth.admin.getUserById(id)));
    for (const result of results) {
      if (result.error || !result.data.user) {
        const status = (result.error as { status?: number } | null)?.status;
        if (status === 404) continue;
        throw result.error ?? new Error('베타 자격 사용자 조회에 실패했습니다.');
      }
      if (isQualifiedBetaTester(result.data.user as AuthUserQualification)) count += 1;
    }
  }
  return count;
}

export type AppBetaQualification = {
  /** 이 앱 선착순 100명 안이면 true */
  qualified: boolean;
  /** 자격 시각 기준 순번. 자격 없으면 null */
  rank: number | null;
};

type AuthUserForRank = AuthUserQualification & {
  id: string;
};

/**
 * 결제용 앱별 베타 판정.
 * 자격 시각은 이메일 인증 시각과 그 앱에서 처음 그룹에 속한 시각 중 늦은 쪽이고,
 * 오래된 순으로 100명까지가 베타다.
 */
export async function getAppBetaQualification(
  appId: AppId,
  userId: string,
): Promise<AppBetaQualification> {
  const ranked = await listAppBetaRanks(appId);
  const rank = ranked.get(userId) ?? null;
  return {
    qualified: rank !== null && rank <= BETA_QUALIFIED_LIMIT,
    rank,
  };
}

const betaRankCache = new Map<string, { at: number; ranks: Map<string, number> }>();
const BETA_RANK_CACHE_MS = 60_000;

async function listAppBetaRanks(appId: AppId): Promise<Map<string, number>> {
  const cached = betaRankCache.get(appId);
  if (cached && Date.now() - cached.at < BETA_RANK_CACHE_MS) return cached.ranks;

  const supabase = getSupabaseServerClient();
  const earliestGroupAtByUser = new Map<string, string>();

  const remember = (userId: string | null, at: string | null) => {
    if (!userId || !at) return;
    const current = earliestGroupAtByUser.get(userId);
    if (!current || at < current) earliestGroupAtByUser.set(userId, at);
  };

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, owner_id, created_at')
    .eq('app_id', appId);
  if (groupsError) throw groupsError;

  const groupIds: string[] = [];
  for (const group of groups ?? []) {
    if (group.id) groupIds.push(group.id);
    remember(group.owner_id, group.created_at);
  }

  const membershipsByApp = await fetchMembershipRows(appId, groupIds);
  for (const membership of membershipsByApp) {
    remember(membership.user_id, membership.joined_at);
  }

  if (earliestGroupAtByUser.size === 0) return new Map();

  const qualified: { userId: string; qualifiedAt: string }[] = [];
  const ids = Array.from(earliestGroupAtByUser.keys());
  const chunkSize = 10;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const results = await Promise.all(chunk.map((id) => supabase.auth.admin.getUserById(id)));
    for (const result of results) {
      if (result.error || !result.data.user) {
        const status = (result.error as { status?: number } | null)?.status;
        if (status === 404) continue;
        throw result.error ?? new Error('베타 자격 사용자 조회에 실패했습니다.');
      }
      const user = result.data.user as AuthUserForRank;
      const earliestGroupAt = earliestGroupAtByUser.get(user.id);
      if (!earliestGroupAt || !isQualifiedBetaTester(user) || !user.email_confirmed_at) continue;
      const confirmedAt = user.email_confirmed_at;
      qualified.push({
        userId: user.id,
        qualifiedAt: confirmedAt > earliestGroupAt ? confirmedAt : earliestGroupAt,
      });
    }
  }

  qualified.sort((a, b) => (a.qualifiedAt < b.qualifiedAt ? -1 : a.qualifiedAt > b.qualifiedAt ? 1 : 0));
  const ranks = new Map<string, number>();
  qualified.forEach((row, index) => ranks.set(row.userId, index + 1));
  betaRankCache.set(appId, { at: Date.now(), ranks });
  return ranks;
}

async function fetchMembershipRows(
  appId: AppId,
  groupIds: string[],
): Promise<{ user_id: string | null; joined_at: string | null }[]> {
  const supabase = getSupabaseServerClient();
  const rows: { user_id: string | null; joined_at: string | null }[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('memberships')
      .select('user_id, joined_at')
      .eq('app_id', appId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  if (groupIds.length === 0) return rows;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('memberships')
      .select('user_id, app_id, joined_at')
      .in('group_id', groupIds)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const membership of data ?? []) {
      if (membership.app_id && membership.app_id !== appId) continue;
      rows.push({ user_id: membership.user_id, joined_at: membership.joined_at });
    }
    if (!data || data.length < pageSize) break;
  }

  return rows;
}
