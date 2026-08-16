import { getSupabaseServerClient } from '@/lib/api-helpers';
import {
  assembleFeatureUsage,
  parseIsoDate,
  type FeatureUsageCountRow,
  type FeatureUsagePayload,
} from '@/lib/admin-feature-usage';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

export async function loadLiveFeatureUsage(params: {
  fromIso: string;
  toIso: string;
  periodLabel: string;
  groupId: string | null;
}): Promise<FeatureUsagePayload> {
  const supabase = getSupabaseServerClient();
  const periodStart = parseIsoDate(params.fromIso, new Date(Date.now() - 24 * 60 * 60 * 1000));
  const periodEnd = parseIsoDate(params.toIso, new Date());
  if (!(periodEnd.getTime() > periodStart.getTime())) {
    throw new Error('기간 종료는 시작보다 뒤여야 합니다.');
  }

  const { data: resetRow, error: resetError } = await supabase
    .from('feature_usage_resets')
    .select('reset_at')
    .order('reset_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (resetError) throw resetError;

  const lastResetAt = resetRow?.reset_at ? String(resetRow.reset_at) : null;
  const resetDate = lastResetAt ? new Date(lastResetAt) : null;
  const effectiveFrom =
    resetDate && resetDate.getTime() > periodStart.getTime() ? resetDate : periodStart;

  const { data: countRows, error: countError } = await supabase.rpc('admin_feature_usage_counts', {
    p_from: effectiveFrom.toISOString(),
    p_to: periodEnd.toISOString(),
    p_group_id: params.groupId,
  });
  if (countError) throw countError;

  let groupsQuery = supabase
    .from('groups')
    .select('id, name, family_name, display_name_pending, title_style');
  if (params.groupId) {
    groupsQuery = groupsQuery.eq('id', params.groupId);
  }
  const { data: groups, error: groupsError } = await groupsQuery;
  if (groupsError) throw groupsError;

  return assembleFeatureUsage({
    rows: (countRows || []) as FeatureUsageCountRow[],
    groups: groups || [],
    periodLabel: params.periodLabel,
    periodStart,
    periodEnd,
    effectiveFrom,
    lastResetAt,
    groupId: params.groupId,
  });
}
