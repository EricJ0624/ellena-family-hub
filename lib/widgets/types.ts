export const DASHBOARD_WIDGET_KEYS = [
  'tasks',
  'calendar',
  'chat',
  'location',
  'album',
  'travel',
  'piggy',
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

export interface WidgetConfigRow {
  id: string;
  group_id: string;
  widget_key: DashboardWidgetKey;
  is_enabled: boolean;
  display_order: number;
}

export interface WidgetConfigDraft {
  widget_key: DashboardWidgetKey;
  is_enabled: boolean;
  display_order: number;
}

export const DEFAULT_WIDGET_CONFIGS: WidgetConfigDraft[] = [
  { widget_key: 'tasks', is_enabled: true, display_order: 10 },
  { widget_key: 'calendar', is_enabled: true, display_order: 20 },
  { widget_key: 'chat', is_enabled: true, display_order: 30 },
  { widget_key: 'location', is_enabled: true, display_order: 40 },
  { widget_key: 'album', is_enabled: true, display_order: 50 },
  { widget_key: 'travel', is_enabled: true, display_order: 60 },
  { widget_key: 'piggy', is_enabled: true, display_order: 70 },
];

