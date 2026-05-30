import type { DashboardWidgetKey, WidgetConfigDraft } from './types';
import type { DashboardShell } from './layout-shell';
import type { AppPreviewOrientation } from './preview-orientation';

/**
 * Phase B: 세로 화면 그리드 열 수 (12열 × 24행 체계)
 * layout_portrait_w, layout_w 저장 단위와 일치.
 */
export const PORTRAIT_COLS = 12;

/**
 * Phase B: 가로 화면 그리드 열 수 (24열 × 12행 체계)
 * layout_landscape_w 저장 단위와 일치.
 */
export const LANDSCAPE_COLS = 24;

/** PC 웹 세로 미리보기(430px)도 PORTRAIT_COLS 와 동일하게 12열 사용 */
const WEB_PREVIEW_PORTRAIT_MAX_COLUMNS = PORTRAIT_COLS;

/** 가로 화면 그리드 최대 열 수 */
export const LANDSCAPE_MAX_COLUMNS = LANDSCAPE_COLS;

/** PC 가로 미리보기 프레임 CSS 상한 (globals.css와 동기) */
export const LANDSCAPE_REFERENCE_MAX_WIDTH_PX = 900;

const WEB_PREVIEW_LANDSCAPE_VW_RATIO = 0.92;
const DESKTOP_MAX_FRAME_PX = 72 * 16;
/** .main-content 좌우 padding (md+: spacing-lg × 2) */
const MAIN_CONTENT_PADDING_X_PX = 48;

/** 세로 mobile portrait 상한 — Phase B: 12열 */
const MOBILE_PORTRAIT_MAX_COLUMNS = PORTRAIT_COLS;

export interface LandscapeGridLayoutParams {
  shell: DashboardShell;
  previewOrientation: AppPreviewOrientation;
  deviceOrientationLandscape: boolean;
}

/**
 * 기기·쉘별 가로 최대 usable 그리드 너비(패딩 제외).
 * 이 너비일 때 열 상한 4가 되도록 실측 열 수를 비율로 축소한다.
 */
export function getDeviceMaxUsableGridWidth(params: LandscapeGridLayoutParams): number {
  const { shell, previewOrientation, deviceOrientationLandscape } = params;
  const pad = MAIN_CONTENT_PADDING_X_PX;

  if (shell === 'web-preview' && previewOrientation === 'landscape') {
    const frame =
      typeof window !== 'undefined'
        ? Math.min(
            window.innerWidth * WEB_PREVIEW_LANDSCAPE_VW_RATIO,
            LANDSCAPE_REFERENCE_MAX_WIDTH_PX,
          )
        : LANDSCAPE_REFERENCE_MAX_WIDTH_PX;
    return Math.max(0, Math.floor(frame) - pad);
  }

  if (shell === 'desktop') {
    const frame =
      typeof window !== 'undefined'
        ? Math.min(window.innerWidth, DESKTOP_MAX_FRAME_PX)
        : DESKTOP_MAX_FRAME_PX;
    return Math.max(0, Math.floor(frame) - pad);
  }

  if (shell === 'mobile' && deviceOrientationLandscape) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
    return Math.max(280, Math.floor(vw) - pad);
  }

  return Math.max(280, LANDSCAPE_REFERENCE_MAX_WIDTH_PX - pad);
}

/**
 * 컨테이너 실측 너비 기준 세로(portrait) 그리드 열 수.
 * Phase B: 세로 화면은 항상 PORTRAIT_COLS(12) 고정.
 * 가로·PC는 getLandscapeColumnCountFromWidth 별도 경로 사용.
 */
export function getDashboardColumnCountFromWidth(_width: number): number {
  return PORTRAIT_COLS;
}

/**
 * 가로·desktop: 기기 최대 usable 너비 → LANDSCAPE_COLS(24)열 단위로 축소.
 * PC 데스크탑: 화면 크기에 비례해 PORTRAIT_COLS(12)~LANDSCAPE_COLS(24) 범위 내 스케일.
 */
export function getLandscapeColumnCountFromWidth(
  contentWidth: number,
  params: LandscapeGridLayoutParams,
): number {
  const deviceMax = getDeviceMaxUsableGridWidth(params);
  if (deviceMax <= 0) return 1;
  const unitWidth = deviceMax / LANDSCAPE_MAX_COLUMNS;
  const w = Math.max(0, Math.floor(contentWidth));
  return Math.min(LANDSCAPE_MAX_COLUMNS, Math.max(1, Math.floor(w / unitWidth)));
}

/**
 * 위젯 span 반영: 최대 가로 LANDSCAPE_COLS(24)열, L/XL span 맞게 축소.
 * PC desktop: 최소 PORTRAIT_COLS(12) 보장 (화면 크기에 비례 스케일).
 *
 * maxSpan 계산 시 stored col_span 대신 실제 layout_landscape_w 값 우선 사용.
 * col_span은 portrait 기준 레거시 값으로 landscape 열 수 계산에 부적합.
 */
export function getLandscapeColumnCountForWidgets(
  contentWidth: number,
  widgets: readonly WidgetConfigDraft[],
  params: LandscapeGridLayoutParams,
): number {
  const raw = getLandscapeColumnCountFromWidth(contentWidth, params);
  // PC desktop은 PORTRAIT_COLS(12) 이상 보장 (화면이 좁아도 세로 동일 해상도)
  const viewportCap = params.shell === 'desktop'
    ? Math.max(PORTRAIT_COLS, raw)
    : raw;

  const enabled = widgets.filter((w) => w.is_enabled);
  if (enabled.length === 0) return viewportCap;

  // layout_landscape_w 값이 있으면 24열 기준 비례 span 계산 (정확)
  // 없으면 stored col_span 폴백 (레거시)
  const maxSpan = Math.max(
    1,
    ...enabled.map((w) => {
      const lw = w.layoutLandscapeW ?? w.layoutW;
      if (lw != null) {
        const storedBase = w.layoutLandscapeW != null ? LANDSCAPE_MAX_COLUMNS : PORTRAIT_COLS;
        return Math.min(viewportCap, Math.max(1, Math.round((lw * viewportCap) / storedBase)));
      }
      return resolveWidgetGridSpans(w, viewportCap).colSpan;
    }),
  );
  const fitCols = Math.floor(viewportCap / maxSpan);
  return Math.max(maxSpan, Math.min(viewportCap, Math.max(1, fitCols)));
}

export function isDashboardLandscapeLayout(
  shell: DashboardShell,
  previewOrientation: AppPreviewOrientation,
  deviceOrientationLandscape: boolean,
): boolean {
  if (shell === 'web-preview') return previewOrientation === 'landscape';
  if (shell === 'mobile') return deviceOrientationLandscape;
  return false;
}

/** 가로 stretch·dense 그리드 CSS를 쓸 쉘 (desktop 전체 창 포함) */
export function usesLandscapeWidgetGridLayout(
  shell: DashboardShell,
  previewOrientation: AppPreviewOrientation,
  deviceOrientationLandscape: boolean,
): boolean {
  if (shell === 'desktop') return true;
  return isDashboardLandscapeLayout(shell, previewOrientation, deviceOrientationLandscape);
}

/**
 * 쉘·실측 너비·방향·위젯 설정으로 그리드 열 수 결정.
 * 뷰포트가 아닌 위젯 그리드 컨테이너 너비를 넘겨야 PC 430px 프레임 버그가 나지 않음.
 */
export function getDashboardColumnCount(
  contentWidth: number,
  shell: DashboardShell,
  previewOrientation: AppPreviewOrientation = 'portrait',
  deviceOrientationLandscape = false,
  widgets: readonly WidgetConfigDraft[] = [],
): number {
  if (shell === 'web-preview' && previewOrientation === 'portrait') {
    return WEB_PREVIEW_PORTRAIT_MAX_COLUMNS;
  }

  const layoutParams: LandscapeGridLayoutParams = {
    shell,
    previewOrientation,
    deviceOrientationLandscape,
  };

  if (shell === 'desktop') {
    return getLandscapeColumnCountForWidgets(contentWidth, widgets, layoutParams);
  }

  if (isDashboardLandscapeLayout(shell, previewOrientation, deviceOrientationLandscape)) {
    return getLandscapeColumnCountForWidgets(contentWidth, widgets, layoutParams);
  }

  if (shell === 'mobile') {
    return Math.min(getDashboardColumnCountFromWidth(contentWidth), MOBILE_PORTRAIT_MAX_COLUMNS);
  }

  return getDashboardColumnCountFromWidth(contentWidth);
}

export function clampGridSpan(span: number, max: number): number {
  const n = Math.floor(Number(span));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, max));
}

/**
 * Phase C: 정사각형 셀(square cell) gridAutoRows 계산.
 * 1 grid unit = columnWidth = contentWidth / columnCount.
 * rowHeight = contentWidth / columnCount → 셀이 정사각형이 되어
 * S(6×6)=1:1, M(12×6)=2:1, L(12×12)=1:1 비율이 자동 성립.
 */
export function getSquareCellRowHeight(contentWidth: number, columnCount: number): number {
  if (contentWidth <= 0 || columnCount <= 0) return 40; // fallback
  return contentWidth / columnCount;
}

/**
 * 저장된 span·size를 현재 열 수에 맞게 보정.
 * Phase C: rowSpan 상한 6 → 24 (portrait 24행 체계).
 */
export function resolveWidgetGridSpans(
  cfg: WidgetConfigDraft,
  columnCount: number,
): { colSpan: number; rowSpan: number } {
  let col = clampGridSpan(cfg.colSpan, columnCount);
  const row = clampGridSpan(cfg.rowSpan, 24); // Phase C: 최대 24행

  if (columnCount >= 2 && (cfg.size === 'L' || cfg.size === 'XL')) {
    col = Math.min(Math.max(col, 2), columnCount);
  } else if (columnCount === 1) {
    col = 1;
  }

  return { colSpan: col, rowSpan: row };
}

/** portrait layout_w/x 저장 단위 (12열) */
const PORTRAIT_LAYOUT_BASE = 12;
/** landscape layout_w/x 저장 단위 (24열) */
const LANDSCAPE_LAYOUT_BASE = 24;

export interface WidgetGridPlacement {
  colSpan: number;
  rowSpan: number;
  /**
   * CSS grid-column-start (1-based).
   * undefined이면 auto-flow(기존 동작) 유지.
   */
  gridColumnStart?: number;
  /**
   * CSS grid-row-start (1-based).
   * Phase D fix: layoutPortraitY/landscapeY 값이 있을 때 설정.
   * undefined이면 auto-flow(기존 동작) 유지.
   */
  gridRowStart?: number;
}

/**
 * layout_* 우선으로 CSS grid placement를 결정.
 * Phase D: isLandscape=true이면 layoutLandscape* 값 우선 사용 (24열 기준).
 *          isLandscape=false(기본)이면 layoutPortrait* 값 우선 사용 (12열 기준).
 *          orientation 전용 컬럼이 null이면 공유 layoutW/H/X(12열 단위)로 폴백.
 *
 * 변환 공식:
 *   actualColSpan  = clamp(round(effectiveW * columnCount / baseCols), 1, columnCount)
 *   actualRowSpan  = clamp(round(effectiveH), 1, 24)
 *   gridColumnStart = round(effectiveX * columnCount / baseCols) + 1
 *   gridRowStart    = round(effectiveY) + 1  (layout Y 단위; CSS 행은 buildWidgetGridItemStyle에서 y/h 슬롯 변환)
 */
export function resolveWidgetGridPlacement(
  cfg: WidgetConfigDraft,
  columnCount: number,
  isLandscape = false,
): WidgetGridPlacement {
  // orientation별 유효값 선택
  const effectiveW = isLandscape
    ? (cfg.layoutLandscapeW ?? cfg.layoutW)
    : (cfg.layoutPortraitW ?? cfg.layoutW);
  const effectiveH = isLandscape
    ? (cfg.layoutLandscapeH ?? cfg.layoutH)
    : (cfg.layoutPortraitH ?? cfg.layoutH);
  const effectiveX = isLandscape
    ? (cfg.layoutLandscapeX ?? cfg.layoutX)
    : (cfg.layoutPortraitX ?? cfg.layoutX);
  const effectiveY = isLandscape
    ? (cfg.layoutLandscapeY ?? cfg.layoutY)
    : (cfg.layoutPortraitY ?? cfg.layoutY);

  // orientation 전용 W/H/X 모두 null이고 공유 layoutW도 없으면 기존 폴백
  if (effectiveW == null) {
    return resolveWidgetGridSpans(cfg, columnCount);
  }

  // 저장 단위에 맞는 기준 열 수 결정
  // landscape 전용 값이 있으면 24열 기준, portrait 또는 공유 값이면 12열 기준
  const storedBaseCols = (isLandscape && (cfg.layoutLandscapeW ?? null) !== null)
    ? LANDSCAPE_LAYOUT_BASE
    : PORTRAIT_LAYOUT_BASE;

  // effectiveW → colSpan
  const rawCol = Math.round((effectiveW * columnCount) / storedBaseCols);
  const colSpan = Math.min(columnCount, Math.max(1, rawCol));

  // effectiveH → rowSpan (Phase C: 최대 24행)
  const rowSpan =
    effectiveH != null
      ? Math.min(24, Math.max(1, Math.round(effectiveH)))
      : clampGridSpan(cfg.rowSpan, 24);

  // effectiveX → gridColumnStart (1-based). 너비 초과 시 x를 왼쪽으로 밀어 span-only 폴백 방지.
  let gridColumnStart: number | undefined;
  if (effectiveX != null) {
    let rawStart = Math.round((effectiveX * columnCount) / storedBaseCols) + 1;
    if (rawStart + colSpan - 1 > columnCount) {
      rawStart = Math.max(1, columnCount - colSpan + 1);
    }
    gridColumnStart = Math.min(columnCount, Math.max(1, rawStart));
  }

  // effectiveY → gridRowStart (1-based).
  // X와 Y 모두 있을 때만 설정 — 하나만 있으면 auto-flow에 맡겨 레이아웃 일관성 유지.
  // portrait/landscape 행 단위(0-based) → CSS grid-row-start(1-based) 변환.
  let gridRowStart: number | undefined;
  if (effectiveX != null && effectiveY != null) {
    const rawRow = Math.round(effectiveY) + 1;
    const maxRows = isLandscape ? 12 : 24;
    if (rawRow >= 1 && rawRow <= maxRows) {
      gridRowStart = rawRow;
    }
  }

  return { colSpan, rowSpan, gridColumnStart, gridRowStart };
}

/** 대시보드·편집 읽기 전용 그리드 셀 인라인 스타일 (배치만 — 위젯 내용/로직 무관) */
export type WidgetGridItemStyle = {
  gridColumn: string;
  gridRow: string;
  alignSelf?: 'start';
  height?: 'auto';
  minHeight?: number;
  ['--tasks-min-h']?: string;
  ['--widget-min-h']?: string;
};

/**
 * layout_y(0-based) + layout_h → CSS grid 행 슬롯(1-based).
 * layout_y는 0,8,16… 처럼 h 단위 누적값 — CSS rowStart = round(y/h)+1, span은 1만 사용.
 */
export function layoutYHToCssGridRowStart(
  gridRowStart: number | undefined,
  layoutRowSpan: number,
): number | undefined {
  if (gridRowStart == null || layoutRowSpan < 1) return undefined;
  const layoutY = gridRowStart - 1;
  return 1 + Math.round(layoutY / layoutRowSpan);
}

/**
 * resolveWidgetGridPlacement → CSS gridColumn/gridRow.
 * tasks: 기존 gridRowStart + span rowSpan (칠판·임무 높이 성장).
 * 그 외: CSS 행 span 1 + minHeight(layout_h×cellRowH) — gap-3가 span 내부 행에 중복 적용되지 않음.
 */
export function buildWidgetGridItemStyle(
  widgetKey: DashboardWidgetKey,
  placement: WidgetGridPlacement,
  cellRowH: number,
): WidgetGridItemStyle {
  const { colSpan, rowSpan, gridColumnStart, gridRowStart } = placement;
  const gridColumn = gridColumnStart
    ? `${gridColumnStart} / span ${colSpan}`
    : `span ${colSpan}`;

  if (widgetKey === 'tasks') {
    const minPx = cellRowH > 0 ? cellRowH * rowSpan : 0;
    const style: WidgetGridItemStyle = {
      gridColumn,
      gridRow: gridRowStart != null ? `${gridRowStart} / span ${rowSpan}` : 'auto',
      alignSelf: 'start',
      height: 'auto',
    };
    if (minPx > 0) {
      style.minHeight = minPx;
      style['--tasks-min-h'] = `${minPx}px`;
    }
    return style;
  }

  const minPx = cellRowH > 0 ? cellRowH * rowSpan : 0;
  const cssRowStart = layoutYHToCssGridRowStart(gridRowStart, rowSpan);
  const gridRow =
    cssRowStart != null ? `${cssRowStart} / span 1` : 'span 1';

  const style: WidgetGridItemStyle = {
    gridColumn,
    gridRow,
    alignSelf: 'start',
    height: 'auto',
  };
  if (minPx > 0) {
    style.minHeight = minPx;
    style['--widget-min-h'] = `${minPx}px`;
  }
  return style;
}

// ─── 그리드 배치 검증 ─────────────────────────────────────────────────────────

export interface GridPlacedWidget {
  key: string;
  colStart: number; // 1-based
  colEnd: number;   // exclusive (colStart + colSpan)
  rowStart: number; // 1-based
  rowEnd: number;   // exclusive (rowStart + rowSpan)
}

/**
 * 활성 위젯 목록에서 CSS grid 배치 충돌(겹침) 쌍을 반환.
 * gridColumnStart / gridRowStart 가 undefined 인 위젯은 auto-flow 이므로
 * 명시적 배치 위젯과의 비교에서 제외.
 * 빈 배열이면 충돌 없음.
 */
export function detectGridOverlaps(
  widgets: readonly WidgetConfigDraft[],
  columnCount: number,
  isLandscape = false,
): Array<[string, string]> {
  const placed: GridPlacedWidget[] = [];

  for (const cfg of widgets) {
    const { colSpan, rowSpan, gridColumnStart, gridRowStart } =
      resolveWidgetGridPlacement(cfg, columnCount, isLandscape);
    if (gridColumnStart == null || gridRowStart == null) continue;

    let rowStart = gridRowStart;
    let rowEnd = gridRowStart + rowSpan;
    if (cfg.widget_key !== 'tasks') {
      const cssRowStart = layoutYHToCssGridRowStart(gridRowStart, rowSpan);
      if (cssRowStart != null) {
        rowStart = cssRowStart;
        rowEnd = cssRowStart + 1;
      }
    }

    placed.push({
      key: cfg.widget_key,
      colStart: gridColumnStart,
      colEnd: gridColumnStart + colSpan,
      rowStart,
      rowEnd,
    });
  }

  const overlaps: Array<[string, string]> = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      const colOverlap = a.colStart < b.colEnd && a.colEnd > b.colStart;
      const rowOverlap = a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;
      if (colOverlap && rowOverlap) {
        overlaps.push([a.key, b.key]);
      }
    }
  }
  return overlaps;
}
