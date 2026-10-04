import { getSupabaseServerClient } from '@/lib/api-helpers';
import type { AppId } from '@/lib/apps';

/** 베타 자격 집계에서 빼는 테스트 계정. 관리자 순번과 가입 화면 숫자가 같은 목록을 쓴다. */
export const BETA_EXCLUDED_EMAILS = ['soungtak@gmail.com', 'soungtak@icloud.com'];

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
