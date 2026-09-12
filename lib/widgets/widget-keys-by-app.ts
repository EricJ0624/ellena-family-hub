import { ALL_APP_IDS, isAppId, type AppId } from '@/lib/apps';
import { DASHBOARD_WIDGET_KEYS, type DashboardWidgetKey } from '@/lib/widgets/types';

/**
 * 앱별 대시보드 위젯 키 레지스트리.
 *
 * - `DASHBOARD_WIDGET_KEYS` = 전 앱 슈퍼셋(집계 RPC·타입 호환)
 * - 앱마다 노출·활동량에 쓸 키는 여기서만 분기한다.
 * - 지금은 네 앱 모두 동일. 이후 Couple 등만 위젯이 달라지면
 *   해당 앱 배열만 수정하면 관리자 활동량 UI가 따라간다.
 */
export const WIDGET_KEYS_BY_APP: Record<AppId, readonly DashboardWidgetKey[]> = {
  hearth_family: DASHBOARD_WIDGET_KEYS,
  hearth_couple: DASHBOARD_WIDGET_KEYS,
  hearth_biker: DASHBOARD_WIDGET_KEYS,
  hearth_camper: DASHBOARD_WIDGET_KEYS,
};

export function widgetKeysForApp(appId: string | null | undefined): readonly DashboardWidgetKey[] {
  if (appId && isAppId(appId)) return WIDGET_KEYS_BY_APP[appId];
  return DASHBOARD_WIDGET_KEYS;
}

/** 관리자 활동량: 표시할 앱 목록 (필터 반영) */
export function appsForFeatureUsageFilter(
  appFilter: 'all' | 'global' | AppId | undefined,
): readonly AppId[] {
  if (appFilter && isAppId(appFilter)) return [appFilter];
  return ALL_APP_IDS;
}

export function sumWidgetCounts(
  counts: Partial<Record<DashboardWidgetKey, number>> | null | undefined,
  keys: readonly DashboardWidgetKey[],
): number {
  let total = 0;
  for (const key of keys) {
    total += Number(counts?.[key] || 0);
  }
  return total;
}
