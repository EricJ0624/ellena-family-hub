import type { WidgetConfigDraft } from './types';
import type { DashboardShell } from './layout-shell';
import type { AppPreviewOrientation } from './preview-orientation';

/** PC 웹 세로 미리보기(430px) 안에서는 1열만 사용 */
const WEB_PREVIEW_PORTRAIT_MAX_COLUMNS = 1;

/** 터치 기기 가로 등 — 과도한 다열 방지 (L/XL 배치 가독용) */
const MOBILE_MAX_COLUMNS = 2;

/** 컨테이너 실측 너비 기준 열 수 (모바일·PC 앱·PC 가로 미리보기 공통 breakpoint) */
export function getDashboardColumnCountFromWidth(width: number): number {
  const w = Math.max(0, Math.floor(width));
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 640) return 2;
  return 1;
}

/**
 * 쉘·실측 너비·PC 미리보기 방향으로 그리드 열 수 결정.
 * 뷰포트가 아닌 위젯 그리드 컨테이너 너비를 넘겨야 PC 430px 프레임 버그가 나지 않음.
 */
export function getDashboardColumnCount(
  contentWidth: number,
  shell: DashboardShell,
  previewOrientation: AppPreviewOrientation = 'portrait',
): number {
  let cols = getDashboardColumnCountFromWidth(contentWidth);

  if (shell === 'mobile') {
    cols = Math.min(cols, MOBILE_MAX_COLUMNS);
  }

  if (shell === 'web-preview' && previewOrientation === 'portrait') {
    return Math.min(cols, WEB_PREVIEW_PORTRAIT_MAX_COLUMNS);
  }

  return cols;
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
