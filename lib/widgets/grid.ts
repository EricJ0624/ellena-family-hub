import type { WidgetConfigDraft } from './types';
import type { DashboardShell } from './layout-shell';
import type { AppPreviewOrientation } from './preview-orientation';

/** PC 웹 세로 미리보기(430px) 안에서는 1열만 사용 */
const WEB_PREVIEW_PORTRAIT_MAX_COLUMNS = 1;

/** 가로 화면 그리드 최대 열 수 */
export const LANDSCAPE_MAX_COLUMNS = 4;

/** PC 가로 미리보기 프레임 상한 — 이 너비에서 4열이 되도록 min 칸 너비 산정 */
export const LANDSCAPE_REFERENCE_MAX_WIDTH_PX = 900;

/** 가로·desktop: 실측 너비÷이 값으로 1~4열 (900px → 4열) */
export const LANDSCAPE_MIN_COLUMN_WIDTH_PX = Math.ceil(
  LANDSCAPE_REFERENCE_MAX_WIDTH_PX / LANDSCAPE_MAX_COLUMNS,
);

/** 세로·좁은 mobile portrait 상한 */
const MOBILE_PORTRAIT_MAX_COLUMNS = 2;

/** 컨테이너 실측 너비 기준 열 수 (mobile 세로 등) */
export function getDashboardColumnCountFromWidth(width: number): number {
  const w = Math.max(0, Math.floor(width));
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 640) return 2;
  return 1;
}

/** 가로·desktop: 실측 너비만으로 1~4열 상한 */
export function getLandscapeColumnCountFromWidth(width: number): number {
  const w = Math.max(0, Math.floor(width));
  const estimated = Math.floor(w / LANDSCAPE_MIN_COLUMN_WIDTH_PX);
  return Math.min(LANDSCAPE_MAX_COLUMNS, Math.max(1, estimated));
}

/**
 * 위젯 span을 반영한 가로·desktop 열 수.
 * 최대 가로에서 4열까지 가능하되, L/XL 등으로 한 줄에 4칸이 안 맞으면 들어가는 열 수로 축소.
 */
export function getLandscapeColumnCountForWidgets(
  contentWidth: number,
  widgets: readonly WidgetConfigDraft[],
): number {
  const viewportCap = getLandscapeColumnCountFromWidth(contentWidth);
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

  if (shell === 'desktop') {
    return getLandscapeColumnCountForWidgets(contentWidth, widgets);
  }

  if (isDashboardLandscapeLayout(shell, previewOrientation, deviceOrientationLandscape)) {
    return getLandscapeColumnCountForWidgets(contentWidth, widgets);
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
