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
  /**
   * @deprecated Phase 6 이후 layout_x/y로 위치를 관리.
   * layout_* 백필 완료 후 1~2 릴리스 유지 → 이후 제거 예정.
   */
  display_order: number;
  size: string;
  /**
   * @deprecated Phase 6 이후 layout_w로 너비를 관리.
   * layout_w가 null인 행의 폴백 및 복구 기준으로만 사용. 이후 제거 예정.
   */
  col_span: number;
  /**
   * @deprecated Phase 6 이후 layout_h로 높이를 관리.
   * layout_h가 null인 행의 폴백 및 복구 기준으로만 사용. 이후 제거 예정.
   */
  row_span: number;
  min_w: number | null;
  min_h: number | null;
  priority: number;
  /** 12열 정규화 그리드 좌표 (nullable — null이면 col_span/row_span 폴백) */
  layout_x: number | null;
  layout_y: number | null;
  layout_w: number | null;
  layout_h: number | null;
  layout_version: number;
}

export interface WidgetConfigDraft {
  widget_key: DashboardWidgetKey;
  is_enabled: boolean;
  /**
   * @deprecated Phase 6 이후 layoutX/Y로 위치를 관리.
   * 백필 완료 후 1~2 릴리스 유지 → 이후 제거 예정.
   * 현재는 packLayoutsFromOrder에서 정렬 기준으로 사용.
   */
  display_order: number;
  size: WidgetSize;
  /**
   * @deprecated Phase 6 이후 layoutW로 너비를 관리.
   * layoutW null 폴백 및 복구 기준으로만 사용. 이후 제거 예정.
   */
  colSpan: number;
  /**
   * @deprecated Phase 6 이후 layoutH로 높이를 관리.
   * layoutH null 폴백 및 복구 기준으로만 사용. 이후 제거 예정.
   */
  rowSpan: number;
  minW: number | null;
  minH: number | null;
  priority: number;
  /** 12열 정규화 그리드 좌표 (null = 미설정, resolveWidgetGridSpans 폴백 사용) */
  layoutX: number | null;
  layoutY: number | null;
  layoutW: number | null;
  layoutH: number | null;
  layoutVersion: number;
}

/**
 * 12열 정규화 그리드 기준 S/M/L/XL 프리셋 크기.
 * WIDGET_SIZE_PRESETS(col_span/row_span)와 별개 — 복구·시드 전용.
 * w=6: 12열 중 절반(스마트폰 세로 1열 = 12, 2열 = 각 6).
 */
export const WIDGET_LAYOUT_PRESETS: Record<WidgetSize, { w: number; h: number }> = {
  S:  { w: 4, h: 2 },
  M:  { w: 6, h: 3 },
  L:  { w: 8, h: 4 },
  XL: { w: 12, h: 6 },
};

/** 위젯별 기본 size — 모두 M (스마트폰 세로 최적화, ADR C항) */
export const WIDGET_DEFAULT_SIZE: Record<DashboardWidgetKey, WidgetSize> = {
  tasks:    'M',
  calendar: 'M',
  chat:     'M',
  location: 'M',
  album:    'M',
  travel:   'M',
  piggy:    'M',
};

const _layoutNull = { layoutX: null, layoutY: null, layoutW: null, layoutH: null, layoutVersion: 1 } as const;

export const DEFAULT_WIDGET_CONFIGS: WidgetConfigDraft[] = [
  { widget_key: 'tasks',    is_enabled: true, display_order: 10, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutNull },
  { widget_key: 'calendar', is_enabled: true, display_order: 20, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutNull },
  { widget_key: 'chat',     is_enabled: true, display_order: 30, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutNull },
  { widget_key: 'location', is_enabled: true, display_order: 40, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutNull },
  { widget_key: 'album',    is_enabled: true, display_order: 50, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutNull },
  { widget_key: 'travel',   is_enabled: true, display_order: 60, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutNull },
  { widget_key: 'piggy',    is_enabled: true, display_order: 70, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutNull },
];
