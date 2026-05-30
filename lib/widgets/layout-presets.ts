/**
 * 위젯 레이아웃 프리셋 헬퍼 (Phase 1, Phase B, Phase D)
 *
 * - getPresetLayout: size에 맞는 portrait 12열 기준 w/h 반환
 * - packLayoutsFromOrder: display_order 순 top-left 패킹 → layout_x/y 계산
 * - packOrientationLayouts: orientation별 portrait/landscape 독립 패킹 (Phase D)
 * - applyPresetToWidget: 단일 위젯 복구
 * - resetAllLayouts: 전체 위젯 복구
 *
 * BASE_COLS = 12 (portrait 기준). landscape는 LANDSCAPE_COLS=24.
 * 모든 함수는 순수 함수 — Supabase 호출 없음.
 */

import {
  WIDGET_LAYOUT_PRESETS,
  WIDGET_DEFAULT_SIZE,
  WIDGET_DEFAULT_ORDER,
  WIDGET_SIZE_PRESETS,
  type DashboardWidgetKey,
  type WidgetConfigDraft,
  type WidgetSize,
} from './types';
import { PORTRAIT_COLS, LANDSCAPE_COLS } from './grid';

export const BASE_COLS = 12;    // portrait 레이아웃 저장 단위 (PORTRAIT_COLS 와 동일)
export const LANDSCAPE_BASE_COLS = 24; // landscape 레이아웃 저장 단위 (LANDSCAPE_COLS 와 동일)

export interface LayoutCoords {
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
  layoutVersion: number;
  /** col_span/row_span 동기화 — actualCols 없으면 null */
  colSpan: number | null;
  rowSpan: number | null;
}

/**
 * size → 12열 기준 w/h 반환.
 * 위젯별 override가 필요하면 두 번째 인수로 전달 가능.
 */
export function getPresetLayout(
  _key: DashboardWidgetKey,
  size: WidgetSize,
): { w: number; h: number } {
  return { ...WIDGET_LAYOUT_PRESETS[size] };
}

/**
 * 12열 정규화 w → actualCols 그리드의 colSpan (반올림, clamp).
 * 렌더 시 resolveWidgetGridPlacement에서도 동일 공식 사용.
 */
export function toActualColSpan(layoutW: number, actualCols: number): number {
  const raw = Math.round((layoutW * actualCols) / BASE_COLS);
  return Math.min(actualCols, Math.max(1, raw));
}

/**
 * display_order 순으로 정렬 후 top-left 패킹.
 * 겹침 없이 layout_x/y를 결정한다.
 *
 * 반환값: widget_key → LayoutCoords (col_span/row_span은 null — actualCols 미결정)
 */
export function packLayoutsFromOrder(
  widgets: readonly WidgetConfigDraft[],
): Map<DashboardWidgetKey, LayoutCoords> {
  const sorted = [...widgets]
    .filter((w) => w.is_enabled)
    .sort((a, b) =>
      a.display_order !== b.display_order
        ? a.display_order - b.display_order
        : b.priority - a.priority,
    );

  const result = new Map<DashboardWidgetKey, LayoutCoords>();
  let cx = 0;
  let cy = 0;
  let rowMaxH = 0;

  for (const w of sorted) {
    const preset = getPresetLayout(w.widget_key, w.size);
    const ww = w.layoutW ?? preset.w;
    const wh = w.layoutH ?? preset.h;

    if (cx + ww > BASE_COLS) {
      cy += rowMaxH;
      cx = 0;
      rowMaxH = 0;
    }

    result.set(w.widget_key, {
      layoutX: cx,
      layoutY: cy,
      layoutW: ww,
      layoutH: wh,
      layoutVersion: w.layoutVersion,
      colSpan: null,
      rowSpan: null,
    });

    cx += ww;
    rowMaxH = Math.max(rowMaxH, wh);
  }

  return result;
}

/**
 * Phase D: orientation별 독립 패킹.
 * portrait → layoutPortraitX/Y 설정, landscape → layoutLandscapeX/Y 설정.
 * 각 orientation의 w/h를 사용해 겹침 없이 배치한다.
 */
export function packOrientationLayouts(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): Map<DashboardWidgetKey, { x: number; y: number }> {
  const isLandscape = orientation === 'landscape';
  const maxCols = isLandscape ? LANDSCAPE_COLS : PORTRAIT_COLS;

  const sorted = [...widgets]
    .filter((w) => w.is_enabled)
    .sort((a, b) =>
      a.display_order !== b.display_order
        ? a.display_order - b.display_order
        : b.priority - a.priority,
    );

  const result = new Map<DashboardWidgetKey, { x: number; y: number }>();
  let cx = 0;
  let cy = 0;
  let rowMaxH = 0;

  for (const w of sorted) {
    const preset = getPresetLayout(w.widget_key, w.size);
    const ww = isLandscape
      ? (w.layoutLandscapeW ?? w.layoutW ?? preset.w * 2)  // landscape: 24열 기준
      : (w.layoutPortraitW ?? w.layoutW ?? preset.w);       // portrait: 12열 기준
    const wh = isLandscape
      ? (w.layoutLandscapeH ?? w.layoutH ?? preset.h)
      : (w.layoutPortraitH ?? w.layoutH ?? preset.h);

    if (cx + ww > maxCols) {
      cy += rowMaxH;
      cx = 0;
      rowMaxH = 0;
    }

    result.set(w.widget_key, { x: cx, y: cy });
    cx += ww;
    rowMaxH = Math.max(rowMaxH, wh);
  }

  return result;
}

/**
 * 단일 위젯을 size 프리셋으로 복구한 새 draft 반환.
 * layoutX/Y는 packLayoutsFromOrder 결과로 덮어쓰는 것을 권장.
 * size를 명시하지 않으면 WIDGET_DEFAULT_SIZE를 사용.
 */
/**
 * 사이즈별 landscape 기본 너비 (24열 기준).
 * S=6 (25%, 4열), M=12 (50%, 2열), L/XL=24 (100%, 1열).
 */
const LANDSCAPE_DEFAULT_W: Record<WidgetSize, number> = {
  S: 6,
  M: 12,
  L: 24,
  XL: 24,
};

export function applyPresetToWidget(
  draft: WidgetConfigDraft,
  size?: WidgetSize,
): WidgetConfigDraft {
  const targetSize = size ?? WIDGET_DEFAULT_SIZE[draft.widget_key];
  const preset12 = getPresetLayout(draft.widget_key, targetSize);
  const spanPreset = WIDGET_SIZE_PRESETS[targetSize];
  const landscapeW = LANDSCAPE_DEFAULT_W[targetSize] ?? 12;

  return {
    ...draft,
    size: targetSize,
    colSpan: spanPreset.colSpan,
    rowSpan: spanPreset.rowSpan,
    layoutW: preset12.w,
    layoutH: preset12.h,
    // Phase D: portrait/landscape 전용 값도 기본값으로 복구
    layoutPortraitW: preset12.w,
    layoutPortraitH: preset12.h,
    layoutLandscapeW: landscapeW,  // S→6(25%), M→12(50%), L→24(100%)
    layoutLandscapeH: preset12.h,
    layoutVersion: draft.layoutVersion,
  };
}

/**
 * 전체 위젯을 기본 size와 순서로 복구하고 portrait/landscape 양쪽 위치를 재패킹한 drafts 반환.
 * Phase D: portrait와 landscape를 독립으로 패킹해 layoutPortraitXY/layoutLandscapeXY 설정.
 * 비활성 위젯은 size만 복구하고 layout 좌표는 null 유지.
 * display_order도 WIDGET_DEFAULT_ORDER 기준으로 초기화.
 */
export function resetAllLayouts(drafts: readonly WidgetConfigDraft[]): WidgetConfigDraft[] {
  const resetted = drafts.map((d) =>
    d.is_enabled
      ? {
          ...applyPresetToWidget(d),
          display_order: WIDGET_DEFAULT_ORDER[d.widget_key] ?? d.display_order,
        }
      : {
          ...d,
          display_order: WIDGET_DEFAULT_ORDER[d.widget_key] ?? d.display_order,
          layoutX: null, layoutY: null,
          layoutPortraitX: null, layoutPortraitY: null,
          layoutLandscapeX: null, layoutLandscapeY: null,
        },
  );

  const packedPortrait = packOrientationLayouts(resetted, 'portrait');
  const packedLandscape = packOrientationLayouts(resetted, 'landscape');

  return resetted.map((d) => {
    const pCoords = packedPortrait.get(d.widget_key);
    const lCoords = packedLandscape.get(d.widget_key);
    return {
      ...d,
      // 공유 layout(폴백용)도 portrait 기준으로 업데이트
      layoutX: pCoords?.x ?? d.layoutX,
      layoutY: pCoords?.y ?? d.layoutY,
      layoutPortraitX: pCoords?.x ?? null,
      layoutPortraitY: pCoords?.y ?? null,
      layoutLandscapeX: lCoords?.x ?? null,
      layoutLandscapeY: lCoords?.y ?? null,
    };
  });
}
