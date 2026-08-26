import type { WidgetConfigDraft } from '@/lib/widgets/types';

/**
 * Dashboard grid: show when travel_diary widget config is enabled.
 * Empty state is shown when enabled without diary_enabled trips.
 */
export function shouldShowTravelDiaryDashboardWidget(configs: WidgetConfigDraft[]): boolean {
  return configs.some((c) => c.widget_key === 'travel_diary' && c.is_enabled);
}
