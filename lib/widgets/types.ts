export const DASHBOARD_WIDGET_KEYS = [
  'tasks',
  'calendar',
  'chat',
  'location',
  'album',
  'travel',
  'piggy',
  'games',
  'travel_diary',
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

export type WidgetSize = 'S' | 'M' | 'L' | 'XL';

/**
 * 12열 정규화 그리드 기준 S/M/L/XL (단일 소스 — 복구·시드·렌더 layout_*).
 *   S  = 6×6   → portrait 50% 너비
 *   M  = 12×8  → portrait 100% 너비
 *   L  = 12×12 → portrait 100% × 정사각형
 * landscape 너비 = portrait w × 2 (24열에서 동일 비율).
 */
export const WIDGET_LAYOUT_PRESETS: Record<WidgetSize, { w: number; h: number }> = {
  S:  { w: 6,  h: 6  },
  M:  { w: 12, h: 8  },
  L:  { w: 12, h: 12 },
  XL: { w: 12, h: 12 }, // @deprecated — L 과 동일
};

/** layout_w/h(12열) → DB col_span/row_span (CHECK 1~4, 1~6). layout-presets.layoutWHToLegacySpans 와 동일 */
function legacySpanFromLayoutWH(w: number, h: number): { colSpan: number; rowSpan: number } {
  return {
    colSpan: Math.min(4, Math.max(1, Math.round((w / 12) * 4))),
    rowSpan: Math.min(6, Math.max(1, Math.round(h))),
  };
}

/** DB 레거시 span — WIDGET_LAYOUT_PRESETS 에서만 파생 (수동 값 금지) */
export const WIDGET_SIZE_PRESETS: Record<WidgetSize, { colSpan: number; rowSpan: number }> = {
  S:  legacySpanFromLayoutWH(WIDGET_LAYOUT_PRESETS.S.w, WIDGET_LAYOUT_PRESETS.S.h),
  M:  legacySpanFromLayoutWH(WIDGET_LAYOUT_PRESETS.M.w, WIDGET_LAYOUT_PRESETS.M.h),
  L:  legacySpanFromLayoutWH(WIDGET_LAYOUT_PRESETS.L.w, WIDGET_LAYOUT_PRESETS.L.h),
  XL: legacySpanFromLayoutWH(WIDGET_LAYOUT_PRESETS.XL.w, WIDGET_LAYOUT_PRESETS.XL.h),
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

 * 위젯별 이상적인 가로:세로 비율 (황금비율, Phase C).
 * 리사이즈 시 이 비율을 유지하며 가로/세로 중 먼저 100%에 도달하는 쪽에 맞춰 최대 확대.
 * w:h 로 표현 — 예) tasks 1:2 = 세로가 가로의 2배.
 */
export const WIDGET_GOLDEN_RATIOS: Record<DashboardWidgetKey, { w: number; h: number }> = {
  tasks:    { w: 1, h: 2 },  // 세로형: 할 일 목록
  calendar: { w: 1, h: 1 },  // 정사각형: 달력
  chat:     { w: 1, h: 2 },  // 세로형: 채팅 흐름
  location: { w: 4, h: 3 },  // 가로형: 지도
  album:    { w: 1, h: 1 },  // 정사각형: 사진 그리드
  travel:   { w: 4, h: 3 },  // 가로형: 여행 일정
  piggy:    { w: 1, h: 1 },  // 정사각형: 저금통
  games:        { w: 1, h: 1 },
  travel_diary: { w: 1, h: 2 },
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
  games:        'M',
  travel_diary: 'M',
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

const _spanM = WIDGET_SIZE_PRESETS.M;

export const DEFAULT_WIDGET_CONFIGS: WidgetConfigDraft[] = [
  { widget_key: 'tasks',    is_enabled: true, display_order: 10, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'calendar', is_enabled: true, display_order: 20, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'chat',     is_enabled: true, display_order: 30, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'piggy',    is_enabled: true, display_order: 40, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'travel',   is_enabled: true, display_order: 50, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'album',    is_enabled: true, display_order: 60, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'location', is_enabled: true, display_order: 70, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'games',        is_enabled: true,  display_order: 80, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
  { widget_key: 'travel_diary', is_enabled: false, display_order: 85, size: 'M', colSpan: _spanM.colSpan, rowSpan: _spanM.rowSpan, minW: null, minH: null, priority: 0, ..._layoutM },
];

/** 위젯별 기본 display_order — resetAllLayouts에서 순서 초기화 시 사용 */
export const WIDGET_DEFAULT_ORDER: Record<DashboardWidgetKey, number> = Object.fromEntries(
  DEFAULT_WIDGET_CONFIGS.map((c) => [c.widget_key, c.display_order]),
) as Record<DashboardWidgetKey, number>;
