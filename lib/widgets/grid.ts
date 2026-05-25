import type { WidgetConfigDraft } from './types';
import type { DashboardShell } from './layout-shell';
import type { AppPreviewOrientation } from './preview-orientation';

/** PC 웹 세로 미리보기(430px) 안에서는 1열만 사용 */
const WEB_PREVIEW_PORTRAIT_MAX_COLUMNS = 1;

/** 가로 화면 그리드 최대 열 수 */
export const LANDSCAPE_MAX_COLUMNS = 4;

/** 가로 열 추정 시 칸당 최소 너비(px) — 너비에 따라 1~4열 (900px 미리보기 ≈ 3열) */
export const LANDSCAPE_MIN_COLUMN_WIDTH_PX = 280;

/** 세로·좁은 mobile portrait 상한 */
const MOBILE_PORTRAIT_MAX_COLUMNS = 2;

/** 컨테이너 실측 너비 기준 열 수 (desktop·세로 등) */
export function getDashboardColumnCountFromWidth(width: number): number {
  const w = Math.max(0, Math.floor(width));
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 640) return 2;
  return 1;
}

/** 가로: 실측 너비에 비례해 1~4열 (항상 4열 아님) */
export function getLandscapeColumnCountFromWidth(width: number): number {
  const w = Math.max(0, Math.floor(width));
  const estimated = Math.floor(w / LANDSCAPE_MIN_COLUMN_WIDTH_PX);
  return Math.min(LANDSCAPE_MAX_COLUMNS, Math.max(1, estimated));
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

/**
 * 쉘·실측 너비·방향으로 그리드 열 수 결정.
 * 뷰포트가 아닌 위젯 그리드 컨테이너 너비를 넘겨야 PC 430px 프레임 버그가 나지 않음.
 */
export function getDashboardColumnCount(
  contentWidth: number,
  shell: DashboardShell,
  previewOrientation: AppPreviewOrientation = 'portrait',
  deviceOrientationLandscape = false,
): number {
  if (shell === 'web-preview' && previewOrientation === 'portrait') {
    return WEB_PREVIEW_PORTRAIT_MAX_COLUMNS;
  }

  if (isDashboardLandscapeLayout(shell, previewOrientation, deviceOrientationLandscape)) {
    return getLandscapeColumnCountFromWidth(contentWidth);
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
