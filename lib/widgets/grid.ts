import type { WidgetConfigDraft } from './types';
import type { DashboardShell } from './layout-shell';

/** PC 웹 프리뷰(430px 프레임) 안에서는 모바일과 같이 1열만 사용 */
const WEB_PREVIEW_MAX_COLUMNS = 1;

/** 컨테이너 실측 너비 기준 열 수 (모바일·PC 앱 공통 breakpoint) */
export function getDashboardColumnCountFromWidth(width: number): number {
  const w = Math.max(0, Math.floor(width));
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 640) return 2;
  return 1;
}

/**
 * 쉘·실측 너비로 그리드 열 수 결정.
 * 뷰포트가 아닌 위젯 그리드 컨테이너 너비를 넘겨야 PC 430px 프레임 버그가 나지 않음.
 */
export function getDashboardColumnCount(contentWidth: number, shell: DashboardShell): number {
  const cols = getDashboardColumnCountFromWidth(contentWidth);
  if (shell === 'web-preview') return Math.min(cols, WEB_PREVIEW_MAX_COLUMNS);
  return cols;
}

export function clampGridSpan(span: number, max: number): number {
  const n = Math.floor(Number(span));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, max));
}

/**
 * 저장된 span·size를 현재 열 수에 맞게 보정 (모바일·태블릿에서 L/XL 폭 축소).
 */
export function resolveWidgetGridSpans(
  cfg: WidgetConfigDraft,
  columnCount: number,
): { colSpan: number; rowSpan: number } {
  let col = clampGridSpan(cfg.colSpan, columnCount);
  const row = clampGridSpan(cfg.rowSpan, 6);

  if (columnCount <= 2 && (cfg.size === 'L' || cfg.size === 'XL')) {
    col = Math.min(col, columnCount);
  }
  if (columnCount === 1) {
    col = 1;
  }

  return { colSpan: col, rowSpan: row };
}
