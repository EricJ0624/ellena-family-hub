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

/**
 * 대시보드 관리자에서 크기 선택 시 적용되는 기본 그리드 span.
 * Phase B: 12열(portrait) 기준. layoutW == null 인 폴백에도 사용.
 * colSpan: portrait 12열 기준 / rowSpan: Phase C에서 gridAutoRows 조정 후 확정.
 */
export const WIDGET_SIZE_PRESETS: Record<WidgetSize, { colSpan: number; rowSpan: number }> = {
  S:  { colSpan: 6,  rowSpan: 3 },   // 50% portrait width
  M:  { colSpan: 12, rowSpan: 3 },   // 100% portrait width (Phase C: h→6)
  L:  { colSpan: 12, rowSpan: 6 },   // 100% portrait width, taller
  XL: { colSpan: 12, rowSpan: 6 },   // Phase C에서 제거 예정
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
  /** 세로 화면 전용 레이아웃 (12열 × 24행 기준, Phase A+) */
  layout_portrait_x: number | null;
  layout_portrait_y: number | null;
  layout_portrait_w: number | null;
  layout_portrait_h: number | null;
  /** 가로 화면 전용 레이아웃 (24열 × 12행 기준, Phase A+) */
  layout_landscape_x: number | null;
  layout_landscape_y: number | null;
  layout_landscape_w: number | null;
  layout_landscape_h: number | null;
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
  /** 세로 화면 전용 레이아웃 (12열 × 24행 기준, Phase A+) */
  layoutPortraitX: number | null;
  layoutPortraitY: number | null;
  layoutPortraitW: number | null;
  layoutPortraitH: number | null;
  /** 가로 화면 전용 레이아웃 (24열 × 12행 기준, Phase A+) */
  layoutLandscapeX: number | null;
  layoutLandscapeY: number | null;
  layoutLandscapeW: number | null;
  layoutLandscapeH: number | null;
}

/**
 * 12열 정규화 그리드 기준 S/M/L/XL 프리셋 크기 (복구·시드 전용).
 * Phase B: portrait 12열 체계에 맞게 w 재정의.
 *   S  = 6×h  → portrait 50% 너비
 *   M  = 12×h → portrait 100% 너비  (landscape: 12/12×24 = 50%)
 *   L  = 12×h → portrait 100% 너비
 *   XL = 12×h → Phase C에서 제거 예정
 * h 값은 Phase C(gridAutoRows 조정) 완료 후 S:6, M:6, L:12 로 확정.
 */
export const WIDGET_LAYOUT_PRESETS: Record<WidgetSize, { w: number; h: number }> = {
  S:  { w: 6,  h: 3 },   // Phase C: h→6
  M:  { w: 12, h: 3 },   // Phase C: h→6
  L:  { w: 12, h: 6 },   // Phase C: h→12
  XL: { w: 12, h: 6 },   // Phase C에서 제거
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

/** M 사이즈 기본 레이아웃 (스마트폰 세로 최적화, ADR C항) */
const _layoutM = {
  layoutX: null, layoutY: null,
  layoutW: WIDGET_LAYOUT_PRESETS.M.w, layoutH: WIDGET_LAYOUT_PRESETS.M.h,
  layoutVersion: 1,
  // portrait (12열): M = w:12 → 전체 너비 100%
  layoutPortraitX: null, layoutPortraitY: null,
  layoutPortraitW: WIDGET_LAYOUT_PRESETS.M.w, layoutPortraitH: WIDGET_LAYOUT_PRESETS.M.h,
  // landscape (24열): M = w:24 (12×2) → 전체 너비 100%
  layoutLandscapeX: null, layoutLandscapeY: null,
  layoutLandscapeW: WIDGET_LAYOUT_PRESETS.M.w * 2, layoutLandscapeH: WIDGET_LAYOUT_PRESETS.M.h,
} as const;

export const DEFAULT_WIDGET_CONFIGS: WidgetConfigDraft[] = [
  { widget_key: 'tasks',    is_enabled: true, display_order: 10, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'calendar', is_enabled: true, display_order: 20, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'chat',     is_enabled: true, display_order: 30, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'location', is_enabled: true, display_order: 40, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'album',    is_enabled: true, display_order: 50, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'travel',   is_enabled: true, display_order: 60, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'piggy',    is_enabled: true, display_order: 70, size: 'M', colSpan: 1, rowSpan: 1, minW: null, minH: null, priority: 0, ..._layoutM },
];
