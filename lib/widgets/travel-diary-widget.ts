import type { WidgetConfigDraft } from '@/lib/widgets/types';

export type TripDiaryWidgetFields = {
  diary_enabled?: boolean | null;
};

/** Widget row is in grid only when config is enabled (default off). */
export function isTravelDiaryWidgetEnabled(configs: WidgetConfigDraft[]): boolean {
  return configs.some((c) => c.widget_key === 'travel_diary' && c.is_enabled);
}

/**
 * Dashboard grid: show when widget config is enabled.
 * Empty state is shown when enabled without diary_enabled trips.
 */
export function shouldShowTravelDiaryDashboardWidget(
  configs: WidgetConfigDraft[],
  _trips?: TripDiaryWidgetFields[],
): boolean {
  return isTravelDiaryWidgetEnabled(configs);
}
