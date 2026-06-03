import type { WidgetConfigDraft } from '@/lib/widgets/types';

export type TripDiaryWidgetFields = {
  diary_enabled?: boolean | null;
};

export function hasDiaryEnabledTrip(trips: TripDiaryWidgetFields[]): boolean {
  return trips.some((t) => t.diary_enabled === true);
}

/** Widget row is in grid only when config is enabled (default off). */
export function isTravelDiaryWidgetEnabled(configs: WidgetConfigDraft[]): boolean {
  return configs.some((c) => c.widget_key === 'travel_diary' && c.is_enabled);
}

export function getTravelDiaryWidgetConfig(configs: WidgetConfigDraft[]): WidgetConfigDraft | undefined {
  return configs.find((c) => c.widget_key === 'travel_diary');
}

/**
 * Dashboard grid: widget row enabled AND (diary trip exists OR user/admin turned widget on).
 * Opt-in sets is_enabled; empty state is shown when enabled without diary_enabled trips.
 */
export function shouldShowTravelDiaryDashboardWidget(
  configs: WidgetConfigDraft[],
  trips: TripDiaryWidgetFields[],
): boolean {
  if (!isTravelDiaryWidgetEnabled(configs)) return false;
  return hasDiaryEnabledTrip(trips) || isTravelDiaryWidgetEnabled(configs);
}
