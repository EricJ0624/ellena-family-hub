import type { WidgetConfigDraft } from './types';
import type { DashboardShell } from './layout-shell';
import type { AppPreviewOrientation } from './preview-orientation';

/** PC 웹 세로 미리보기(430px) 안에서는 1열만 사용 */
const WEB_PREVIEW_PORTRAIT_MAX_COLUMNS = 1;

/** 가로 화면 그리드 최대 열 수 */
export const LANDSCAPE_MAX_COLUMNS = 4;

/** PC 가로 미리보기 프레임 CSS 상한 (globals.css와 동기) */
export const LANDSCAPE_REFERENCE_MAX_WIDTH_PX = 900;

const WEB_PREVIEW_LANDSCAPE_VW_RATIO = 0.92;
const DESKTOP_MAX_FRAME_PX = 72 * 16;
/** .main-content 좌우 padding (md+: spacing-lg × 2) */
const MAIN_CONTENT_PADDING_X_PX = 48;

/** 세로·좁은 mobile portrait 상한 */
const MOBILE_PORTRAIT_MAX_COLUMNS = 2;

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

/** 컨테이너 실측 너비 기준 열 수 (mobile 세로 등)
 *  320px+ 부터 2열 허용 → 모바일 세로 화면도 편집기 세로 2열 미리보기와 일치
 */
export function getDashboardColumnCountFromWidth(width: number): number {
  const w = Math.max(0, Math.floor(width));
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 320) return 2;
  return 1;
}

/**
 * 가로·desktop: 기기 최대 usable 너비 → 4열 단위, 현재 실측으로 1~4열 축소.
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
 * 위젯 span 반영: 최대 가로에서 4열까지, L/XL 등으로 한 줄 4칸 불가 시 span에 맞게 축소.
 */
export function getLandscapeColumnCountForWidgets(
  contentWidth: number,
  widgets: readonly WidgetConfigDraft[],
  params: LandscapeGridLayoutParams,
): number {
  const viewportCap = getLandscapeColumnCountFromWidth(contentWidth, params);
  const enabled = widgets.filter((w) => w.is_enabled);
  if (enabled.length === 0) return viewportCap;

  const maxSpan = Math.max(
    1,
    ...enabled.map((w) => resolveWidgetGridSpans(w, viewportCap).colSpan),
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
 * 저장된 span·size를 현재 열 수에 맞게 보정.
 * 2열 이상일 때만 L/XL 가로 span이 눈에 띄게 적용됨.
 */
export function resolveWidgetGridSpans(
  cfg: WidgetConfigDraft,
  columnCount: number,
): { colSpan: number; rowSpan: number } {
  let col = clampGridSpan(cfg.colSpan, columnCount);
  const row = clampGridSpan(cfg.rowSpan, 6);

  if (columnCount >= 2 && (cfg.size === 'L' || cfg.size === 'XL')) {
    col = Math.min(Math.max(col, 2), columnCount);
  } else if (columnCount === 1) {
    col = 1;
  }

  return { colSpan: col, rowSpan: row };
}

/** 12열 정규화 그리드의 기준 열 수 */
const LAYOUT_BASE_COLS = 12;

export interface WidgetGridPlacement {
  colSpan: number;
  rowSpan: number;
  /**
   * CSS grid-column-start (1-based).
   * undefined이면 auto-flow(기존 동작) 유지.
   */
  gridColumnStart?: number;
}

/**
 * layout_* 우선으로 CSS grid placement를 결정.
 * layoutW/H/X가 null이면 resolveWidgetGridSpans 폴백 — 기존 동작 보장.
 *
 * 변환 공식:
 *   actualColSpan  = clamp(round(layoutW * columnCount / 12), 1, columnCount)
 *   actualRowSpan  = clamp(round(layoutH), 1, 6)
 *   gridColumnStart = round(layoutX * columnCount / 12) + 1  (범위 초과 시 무시)
 */
export function resolveWidgetGridPlacement(
  cfg: WidgetConfigDraft,
  columnCount: number,
): WidgetGridPlacement {
  // layoutW가 없으면 기존 resolveWidgetGridSpans 폴백
  if (cfg.layoutW == null) {
    return resolveWidgetGridSpans(cfg, columnCount);
  }

  // layoutW → colSpan
  const rawCol = Math.round((cfg.layoutW * columnCount) / LAYOUT_BASE_COLS);
  const colSpan = Math.min(columnCount, Math.max(1, rawCol));

  // layoutH → rowSpan (h는 abstract unit → 정수 근사)
  const rowSpan =
    cfg.layoutH != null
      ? Math.min(6, Math.max(1, Math.round(cfg.layoutH)))
      : clampGridSpan(cfg.rowSpan, 6);

  // layoutX → gridColumnStart (1-based)
  let gridColumnStart: number | undefined;
  if (cfg.layoutX != null) {
    const rawStart = Math.round((cfg.layoutX * columnCount) / LAYOUT_BASE_COLS) + 1;
    const clamped = Math.min(columnCount, Math.max(1, rawStart));
    // start + span이 열 범위를 초과하면 gridColumnStart는 무시하고 auto-flow에 맡김
    if (clamped + colSpan - 1 <= columnCount) {
      gridColumnStart = clamped;
    }
  }

  return { colSpan, rowSpan, gridColumnStart };
}
