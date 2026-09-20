import type { DashboardWidgetKey } from '@/lib/widgets/types';
import { DASHBOARD_WIDGET_KEYS } from '@/lib/widgets/types';

/**
 * 그룹 생성자 위젯 쇼룸 대상 여부.
 * - 마이그레이션 이전 그룹: widget_showroom_completed_at 백필됨 → false
 * - 이후 신규 그룹 + 미완료: null → true (소유자만 UI에서 게이트)
 */
export function groupNeedsWidgetShowroom(
  group: { widget_showroom_completed_at?: string | null } | null | undefined,
): boolean {
  if (!group) return false;
  return group.widget_showroom_completed_at == null;
}

/** 쇼룸에 노출하는 위젯 키 (대시보드 키와 동일) */
export const WIDGET_SHOWROOM_KEYS: readonly DashboardWidgetKey[] = DASHBOARD_WIDGET_KEYS;
