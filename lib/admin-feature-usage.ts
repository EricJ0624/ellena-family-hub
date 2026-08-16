import { DASHBOARD_WIDGET_KEYS, type DashboardWidgetKey } from '@/lib/widgets/types';
import { getGroupDisplayNameRaw, type GroupDisplayNameFields } from '@/lib/group-display-name';

export const FEATURE_USAGE_PERIODS = ['today', '7d', '30d', 'since_reset', 'custom'] as const;
export type FeatureUsagePeriod = (typeof FEATURE_USAGE_PERIODS)[number];

export type FeatureUsageCounts = Record<DashboardWidgetKey, number>;

export type FeatureUsageGroupRow = {
  groupId: string;
  groupName: string;
  counts: FeatureUsageCounts;
  total: number;
};

export type FeatureUsagePayload = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  effectiveFrom: string;
  lastResetAt: string | null;
  groupId: string | null;
  totals: FeatureUsageCounts;
  perGroup: FeatureUsageGroupRow[];
};

export type FeatureUsageCountRow = {
  widget_key: string;
  group_id: string;
  activity_count: number | string;
};

function emptyFeatureUsageCounts(): FeatureUsageCounts {
  return Object.fromEntries(DASHBOARD_WIDGET_KEYS.map((key) => [key, 0])) as FeatureUsageCounts;
}

export function isFeatureUsagePeriod(value: string): value is FeatureUsagePeriod {
  return (FEATURE_USAGE_PERIODS as readonly string[]).includes(value);
}

function isDashboardWidgetKey(value: string): value is DashboardWidgetKey {
  return (DASHBOARD_WIDGET_KEYS as readonly string[]).includes(value);
}

export function parseIsoDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function addCounts(target: FeatureUsageCounts, key: string, amount: number) {
  if (!isDashboardWidgetKey(key)) return;
  target[key] += amount;
}

export function assembleFeatureUsage(params: {
  rows: FeatureUsageCountRow[] | null | undefined;
  groups: Array<{ id: string } & GroupDisplayNameFields>;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  effectiveFrom: Date;
  lastResetAt: string | null;
  groupId: string | null;
}): FeatureUsagePayload {
  const totals = emptyFeatureUsageCounts();
  const byGroup = new Map<string, FeatureUsageCounts>();

  for (const group of params.groups) {
    byGroup.set(group.id, emptyFeatureUsageCounts());
  }

  for (const row of params.rows || []) {
    const count = Number(row.activity_count) || 0;
    const groupId = String(row.group_id || '');
    if (!groupId || count <= 0) continue;
    addCounts(totals, row.widget_key, count);
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, emptyFeatureUsageCounts());
    }
    addCounts(byGroup.get(groupId)!, row.widget_key, count);
  }

  const groupNameById = new Map(
    params.groups.map((group) => [
      group.id,
      getGroupDisplayNameRaw(group) || group.family_name?.trim() || group.name?.trim() || group.id.slice(0, 8),
    ]),
  );

  const perGroup: FeatureUsageGroupRow[] = Array.from(byGroup.entries())
    .map(([groupId, counts]) => {
      const total = DASHBOARD_WIDGET_KEYS.reduce((sum, key) => sum + counts[key], 0);
      return {
        groupId,
        groupName: groupNameById.get(groupId) || groupId.slice(0, 8),
        counts,
        total,
      };
    })
    .sort((a, b) => b.total - a.total || a.groupName.localeCompare(b.groupName));

  return {
    periodLabel: params.periodLabel,
    periodStart: params.periodStart.toISOString(),
    periodEnd: params.periodEnd.toISOString(),
    effectiveFrom: params.effectiveFrom.toISOString(),
    lastResetAt: params.lastResetAt,
    groupId: params.groupId,
    totals,
    perGroup,
  };
}
