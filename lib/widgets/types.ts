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

export type WidgetSize = 'S' | 'M' | 'L' | 'XL';

/** 대시보드 관리자에서 크기 선택 시 적용되는 기본 그리드 span */
export const WIDGET_SIZE_PRESETS: Record<WidgetSize, { colSpan: number; rowSpan: number }> = {
  S: { colSpan: 1, rowSpan: 1 },
  M: { colSpan: 1, rowSpan: 1 },
  L: { colSpan: 2, rowSpan: 1 },
  XL: { colSpan: 2, rowSpan: 2 },
};

export function parseWidgetSize(raw: string | null | undefined): WidgetSize {
  if (raw === 'S' || raw === 'M' || raw === 'L' || raw === 'XL') return raw;
  return 'M';
}

export interface WidgetConfigRow {
  id: string;
  group_id: string;
  widget_key: DashboardWidgetKey;
  is_enabled: boolean;
  display_order: number;
  size: string;
  col_span: number;
  row_span: number;
  min_w: number | null;
  min_h: number | null;
  priority: number;
}

export interface WidgetConfigDraft {
  widget_key: DashboardWidgetKey;
  is_enabled: boolean;
  display_order: number;
  size: WidgetSize;
  colSpan: number;
  rowSpan: number;
  minW: number | null;
  minH: number | null;
  priority: number;
}

export const DEFAULT_WIDGET_CONFIGS: WidgetConfigDraft[] = [
  { widget_key: 'tasks', is_enabled: true, display_order: 10, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0 },
  { widget_key: 'calendar', is_enabled: true, display_order: 20, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0 },
  { widget_key: 'chat', is_enabled: true, display_order: 30, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0 },
  { widget_key: 'location', is_enabled: true, display_order: 40, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0 },
  { widget_key: 'album', is_enabled: true, display_order: 50, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0 },
  { widget_key: 'travel', is_enabled: true, display_order: 60, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0 },
  { widget_key: 'piggy', is_enabled: true, display_order: 70, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0 },
];
