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
import { detectGridOverlaps, PORTRAIT_COLS, LANDSCAPE_COLS } from './grid';

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

/** orientation별 유효 x (같은 열 판정) */
function effectiveLayoutX(
  d: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
): number | null {
  return orientation === 'portrait'
    ? (d.layoutPortraitX ?? d.layoutX)
    : (d.layoutLandscapeX ?? d.layoutX);
}

function effectiveLayoutY(
  d: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
): number {
  const y = orientation === 'portrait'
    ? (d.layoutPortraitY ?? d.layoutY)
    : (d.layoutLandscapeY ?? d.layoutY);
  return y ?? 0;
}

function effectiveLayoutH(
  d: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
): number {
  const h = orientation === 'portrait'
    ? (d.layoutPortraitH ?? d.layoutH)
    : (d.layoutLandscapeH ?? d.layoutH);
  if (h != null && h > 0) return h;
  const preset = getPresetLayout(d.widget_key, d.size);
  return preset.h;
}

function effectiveLayoutW(
  d: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
): number {
  const w = orientation === 'portrait'
    ? (d.layoutPortraitW ?? d.layoutW)
    : (d.layoutLandscapeW ?? d.layoutW);
  if (w != null && w > 0) return w;
  const preset = getPresetLayout(d.widget_key, d.size);
  return orientation === 'landscape' ? preset.w * 2 : preset.w;
}

interface LayoutRect {
  key: DashboardWidgetKey;
  x: number;
  y: number;
  w: number;
  h: number;
}

function layoutRectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function applyOrientationWH(
  d: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
  w: number,
  h: number,
): WidgetConfigDraft {
  if (orientation === 'portrait') {
    return {
      ...d,
      layoutPortraitW: w,
      layoutPortraitH: h,
      layoutW: w,
      layoutH: h,
    };
  }
  return {
    ...d,
    layoutLandscapeW: w,
    layoutLandscapeH: h,
  };
}

/** x+w가 열 수를 넘지 않도록 layout 좌표 보정 (저장·로드 정규화) */
function clampWidgetLayoutExtents(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const maxCols = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  return widgets.map((d) => {
    if (!d.is_enabled) return d;
    let w = effectiveLayoutW(d, orientation);
    let x = effectiveLayoutX(d, orientation) ?? 0;
    const h = effectiveLayoutH(d, orientation);
    if (w > maxCols) w = maxCols;
    if (x < 0) x = 0;
    if (x + w > maxCols) x = Math.max(0, maxCols - w);
    let next = applyOrientationXY(d, orientation, x, effectiveLayoutY(d, orientation));
    next = applyOrientationWH(next, orientation, w, h);
    return next;
  });
}

function applyOrientationXY(
  d: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
  x: number,
  y: number,
): WidgetConfigDraft {
  if (orientation === 'portrait') {
    return {
      ...d,
      layoutPortraitX: x,
      layoutPortraitY: y,
      layoutX: x,
      layoutY: y,
    };
  }
  return {
    ...d,
    layoutLandscapeX: x,
    layoutLandscapeY: y,
  };
}

/**
 * display_order 순으로 배치 사각형 겹침을 해소 (w/h 유지, x·y만 조정).
 * 같은 행(y 대역)에서는 오른쪽으로 밀고, 너비 초과 시 아래 행으로 내린다.
 */
export function resolveOrientationLayoutOverlaps(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const maxCols = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  const sorted = [...widgets]
    .filter((w) => w.is_enabled)
    .sort((a, b) =>
      a.display_order !== b.display_order
        ? a.display_order - b.display_order
        : b.priority - a.priority,
    );

  const placed: LayoutRect[] = [];
  const xyByKey = new Map<DashboardWidgetKey, { x: number; y: number }>();

  for (const w of sorted) {
    const anchorX = effectiveLayoutX(w, orientation) ?? 0;
    let x = anchorX;
    let y = effectiveLayoutY(w, orientation);
    const ww = effectiveLayoutW(w, orientation);
    const wh = effectiveLayoutH(w, orientation);

    for (let attempt = 0; attempt < 64; attempt++) {
      const rect: LayoutRect = { key: w.widget_key, x, y, w: ww, h: wh };
      const conflicts = placed.filter((p) => layoutRectsOverlap(rect, p));
      if (conflicts.length === 0) {
        placed.push(rect);
        xyByKey.set(w.widget_key, { x, y });
        break;
      }
      const pushX = Math.max(...conflicts.map((c) => c.x + c.w));
      if (pushX + ww <= maxCols) {
        x = pushX;
        continue;
      }
      y = Math.max(y, ...conflicts.map((c) => c.y + c.h));
      x = anchorX;
    }
  }

  return widgets.map((d) => {
    const xy = xyByKey.get(d.widget_key);
    if (!xy) return d;
    return applyOrientationXY(d, orientation, xy.x, xy.y);
  });
}

/** detectGridOverlaps 기준 충돌 없을 때까지 resolve → 필요 시 packOrientationLayouts(x,y만) */
function ensureOrientationNoGridOverlaps(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const columnCount = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  const isLandscape = orientation === 'landscape';

  let result = resolveOrientationLayoutOverlaps(widgets, orientation);
  result = compactOrientationLayoutY(result, orientation);

  if (detectGridOverlaps(result, columnCount, isLandscape).length === 0) {
    return result;
  }

  const packed = packOrientationLayouts(result, orientation);
  result = result.map((d) => {
    if (!d.is_enabled) return d;
    const coords = packed.get(d.widget_key);
    if (!coords) return d;
    return applyOrientationXY(d, orientation, coords.x, coords.y);
  });
  return compactOrientationLayoutY(result, orientation);
}

/**
 * 같은 열(x 동일) 안에서 y를 연속으로 압축 — 빈 grid row 제거.
 * 위젯 간 간격은 CSS grid gap만 사용 (layout Y에 gap 행 단위 추가 없음).
 */
export function compactOrientationLayoutY(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const yByKey = new Map<DashboardWidgetKey, number>();
  const byColumn = new Map<number, WidgetConfigDraft[]>();

  for (const w of widgets) {
    if (!w.is_enabled) continue;
    const x = effectiveLayoutX(w, orientation);
    if (x == null) continue;
    const col = Math.round(x);
    const list = byColumn.get(col) ?? [];
    list.push(w);
    byColumn.set(col, list);
  }

  for (const list of byColumn.values()) {
    list.sort((a, b) => {
      const dy = effectiveLayoutY(a, orientation) - effectiveLayoutY(b, orientation);
      if (dy !== 0) return dy;
      return a.display_order - b.display_order;
    });
    let cy = 0;
    for (const w of list) {
      yByKey.set(w.widget_key, cy);
      cy += effectiveLayoutH(w, orientation);
    }
  }

  return widgets.map((d) => {
    const ny = yByKey.get(d.widget_key);
    if (ny === undefined) return d;
    if (orientation === 'portrait') {
      return { ...d, layoutPortraitY: ny, layoutY: ny };
    }
    return { ...d, layoutLandscapeY: ny };
  });
}

/** portrait/landscape Y 압축 후 공유 layout_x/y 동기화 */
function syncSharedLayoutFromPortrait(d: WidgetConfigDraft): WidgetConfigDraft {
  const portraitX = d.layoutPortraitX ?? d.layoutX;
  const portraitY = d.layoutPortraitY ?? d.layoutY;
  const portraitW = d.layoutPortraitW ?? d.layoutW;
  const portraitH = d.layoutPortraitH ?? d.layoutH;
  return {
    ...d,
    layoutX: portraitX,
    layoutY: portraitY,
    layoutW: portraitW,
    layoutH: portraitH,
  };
}

/** 같은 열(동일 layoutX) 여부 — 세로 스택 드롭 판정 */
export function layoutSameColumn(
  a: WidgetConfigDraft,
  b: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
): boolean {
  const ax = effectiveLayoutX(a, orientation);
  const bx = effectiveLayoutX(b, orientation);
  if (ax == null || bx == null) return false;
  return Math.round(ax) === Math.round(bx);
}

/**
 * anchor 바로 아래에 draft 배치 (y = anchor.y + anchor.h, x = anchor.x).
 * 간격은 CSS grid gap — layout Y에 gap 행 단위 추가 없음.
 */
export function applyStackBelowDraft(
  draft: WidgetConfigDraft,
  anchor: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft {
  const ax = effectiveLayoutX(anchor, orientation);
  const ay = orientation === 'portrait'
    ? (anchor.layoutPortraitY ?? anchor.layoutY)
    : (anchor.layoutLandscapeY ?? anchor.layoutY);
  const ah = orientation === 'portrait'
    ? (anchor.layoutPortraitH ?? anchor.layoutH)
    : (anchor.layoutLandscapeH ?? anchor.layoutH);
  const nextY = (ay ?? 0) + (ah ?? 0);

  if (orientation === 'portrait') {
    return {
      ...draft,
      layoutPortraitX: ax ?? draft.layoutPortraitX,
      layoutPortraitY: nextY,
      layoutX: ax ?? draft.layoutX,
      layoutY: nextY,
    };
  }
  return {
    ...draft,
    layoutLandscapeX: ax ?? draft.layoutLandscapeX,
    layoutLandscapeY: nextY,
  };
}

/**
 * 저장·로드 직전: X/W/H 유지, 같은 열 Y 연속 압축, 공유 layout_* 동기화.
 * (display_order 2×2 강제 패킹 없음 — 열 스택·다른 높이 보존)
 */
export function packDraftsOrientationCoordinates(
  widgets: readonly WidgetConfigDraft[],
): WidgetConfigDraft[] {
  const synced = widgets.map((d) => {
    const portraitW = d.layoutPortraitW ?? d.layoutW;
    const portraitH = d.layoutPortraitH ?? d.layoutH;
    const portraitX = d.layoutPortraitX ?? d.layoutX;
    const portraitY = d.layoutPortraitY ?? d.layoutY;
    const landscapeW = d.layoutLandscapeW ?? d.layoutW;
    const landscapeH = d.layoutLandscapeH ?? d.layoutH;
    const landscapeX = d.layoutLandscapeX ?? d.layoutX;
    const landscapeY = d.layoutLandscapeY ?? d.layoutY;

    return {
      ...d,
      layoutPortraitX: portraitX,
      layoutPortraitY: portraitY,
      layoutPortraitW: portraitW,
      layoutPortraitH: portraitH,
      layoutLandscapeX: landscapeX,
      layoutLandscapeY: landscapeY,
      layoutLandscapeW: landscapeW,
      layoutLandscapeH: landscapeH,
    };
  });

  const clampedP = clampWidgetLayoutExtents(synced, 'portrait');
  const compactedP = compactOrientationLayoutY(clampedP, 'portrait');
  const noOverlapP = ensureOrientationNoGridOverlaps(compactedP, 'portrait');
  const clampedPL = clampWidgetLayoutExtents(noOverlapP, 'landscape');
  const compactedPL = compactOrientationLayoutY(clampedPL, 'landscape');
  const noOverlapPL = ensureOrientationNoGridOverlaps(compactedPL, 'landscape');
  return noOverlapPL.map(syncSharedLayoutFromPortrait);
}

/** DB 로드 후 normalizeRows 결과에 Y 압축 적용 */
export function compactDraftsLayoutCoordinates(
  widgets: readonly WidgetConfigDraft[],
): WidgetConfigDraft[] {
  return packDraftsOrientationCoordinates(widgets);
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
