import type { WidgetConfigDraft } from './types';

/** Tailwind 그리드와 동일: 기본 1열 · sm 2 · lg 3 · xl 4 */
export function getDashboardColumnCount(width: number): number {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
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
