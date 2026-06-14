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

/** layout w/h 스냅 — 0.5 그리드 단위 (12열 6+6 등 경계 배치 안정화) */
export function snapLayoutCoord(value: number): number {
  return Math.round(value * 2) / 2;
}

/** DB CHECK(col_span 1~4, row_span 1~6)용 — layout_w/h(12열)에서 역산 */
export function layoutWHToLegacySpans(
  layoutW: number,
  layoutH: number,
): { colSpan: number; rowSpan: number } {
  return {
    colSpan: Math.min(4, Math.max(1, Math.round((layoutW / BASE_COLS) * 4))),
    rowSpan: Math.min(6, Math.max(1, Math.round(layoutH))),
  };
}

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

/** x+w가 열 수를 넘지 않도록 layout 좌표 보정 (저장·로드·편집기 리사이즈) */
export function clampWidgetLayoutExtents(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const maxCols = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  return widgets.map((d) => {
    if (!d.is_enabled) return d;
    let w = effectiveLayoutW(d, orientation);
    let x = effectiveLayoutX(d, orientation) ?? 0;
    let h = effectiveLayoutH(d, orientation);
    w = snapLayoutCoord(w);
    h = snapLayoutCoord(h);
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

  const maxRows = orientation === 'landscape' ? 12 : 24;

  for (const w of sorted) {
    const anchorX = effectiveLayoutX(w, orientation) ?? 0;
    const anchorY = effectiveLayoutY(w, orientation);
    const ww = effectiveLayoutW(w, orientation);
    const wh = effectiveLayoutH(w, orientation);
    const snappedAnchorX = snapLayoutXForWidgetWidth(anchorX, ww, maxCols);
    let x = snappedAnchorX;
    let y = snapLayoutYForWidgetHeight(anchorY, wh, maxRows);

    for (let attempt = 0; attempt < 64; attempt++) {
      const rect: LayoutRect = { key: w.widget_key, x, y, w: ww, h: wh };
      const conflicts = placed.filter((p) => layoutRectsOverlap(rect, p));
      if (conflicts.length === 0) {
        placed.push(rect);
        xyByKey.set(w.widget_key, { x, y });
        break;
      }
      const pushX = snapLayoutCoord(Math.max(...conflicts.map((c) => c.x + c.w)));
      if (pushX + ww <= maxCols + 1e-9) {
        x = snapLayoutXForWidgetWidth(pushX, ww, maxCols);
        continue;
      }
      y = snapLayoutCoord(Math.max(y, ...conflicts.map((c) => c.y + c.h)));
      x = snappedAnchorX;
    }
  }

  return widgets.map((d) => {
    const xy = xyByKey.get(d.widget_key);
    if (!xy) return d;
    return applyOrientationXY(d, orientation, xy.x, xy.y);
  });
}

/**
 * layout_x/y/w/h(12·24열 좌표) 기준 겹침 쌍 — 편집 미리보기·저장 전 검증용.
 * detectGridOverlaps(CSS 행 슬롯)와 별도: minHeight·span 1 배치와 좌표 불일치를 잡는다.
 */
export function detectLayoutCoordinateOverlaps(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): Array<[string, string]> {
  const sorted = [...widgets]
    .filter((w) => w.is_enabled)
    .sort((a, b) =>
      a.display_order !== b.display_order
        ? a.display_order - b.display_order
        : b.priority - a.priority,
    );

  const rects: LayoutRect[] = sorted.map((w) => ({
    key: w.widget_key,
    x: effectiveLayoutX(w, orientation) ?? 0,
    y: effectiveLayoutY(w, orientation),
    w: effectiveLayoutW(w, orientation),
    h: effectiveLayoutH(w, orientation),
  }));

  const overlaps: Array<[string, string]> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (layoutRectsOverlap(rects[i], rects[j])) {
        overlaps.push([rects[i].key, rects[j].key]);
      }
    }
  }
  return overlaps;
}

/** 편집기 자동 보정 루프 방지 — orientation별 layout 좌표·(portrait) span 동등 비교 */
export function draftsOrientationLayoutsEqual(
  a: readonly WidgetConfigDraft[],
  b: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): boolean {
  if (a.length !== b.length) return false;
  for (const da of a) {
    const db = b.find((x) => x.widget_key === da.widget_key);
    if (!db) return false;
    if (da.is_enabled !== db.is_enabled) return false;
    if (!da.is_enabled) continue;
    const ax = effectiveLayoutX(da, orientation) ?? -1;
    const bx = effectiveLayoutX(db, orientation) ?? -1;
    if (ax !== bx) return false;
    if (effectiveLayoutY(da, orientation) !== effectiveLayoutY(db, orientation)) return false;
    if (effectiveLayoutW(da, orientation) !== effectiveLayoutW(db, orientation)) return false;
    if (effectiveLayoutH(da, orientation) !== effectiveLayoutH(db, orientation)) return false;
    if (orientation === 'portrait' && (da.colSpan !== db.colSpan || da.rowSpan !== db.rowSpan)) {
      return false;
    }
  }
  return true;
}

/** detectGridOverlaps·layout 좌표 겹침 없을 때까지 resolve → 필요 시 packOrientationLayouts(x,y만) */
export function ensureOrientationNoGridOverlaps(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const columnCount = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  const isLandscape = orientation === 'landscape';

  let result = resolveOrientationLayoutOverlaps(widgets, orientation);
  result = compactOrientationLayoutY(result, orientation);

  const hasCssOverlap = detectGridOverlaps(result, columnCount, isLandscape).length > 0;
  const hasCoordOverlap = detectLayoutCoordinateOverlaps(result, orientation).length > 0;
  if (!hasCssOverlap && !hasCoordOverlap) {
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

/** portrait·landscape layout 좌표 겹침 해소 (편집기 미리보기·탭 전환용) */
export function ensureDraftsBothOrientationsNoOverlap(
  widgets: readonly WidgetConfigDraft[],
): WidgetConfigDraft[] {
  let result = ensureOrientationNoGridOverlaps(widgets, 'portrait');
  result = ensureOrientationNoGridOverlaps(result, 'landscape');
  result = ensureOrientationNoGridOverlaps(result, 'portrait');
  return result;
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
      if (Math.abs(dy) > 1e-9) return dy;
      return a.display_order - b.display_order;
    });
    let cy = 0;
    for (const w of list) {
      const intendedY = effectiveLayoutY(w, orientation);
      // 같은 열·의도한 행(y) 유지 — 아래 위젯만 y≥cy 로 밀어 올림 방지
      const nextY = intendedY >= cy - 1e-9 ? intendedY : cy;
      yByKey.set(w.widget_key, nextY);
      cy = nextY + effectiveLayoutH(w, orientation);
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

export type DropPlacementMode = 'below' | 'beside';

/** 드롭 포인터·앵커 카드 rect → 옆(beside) / 아래(below) */
export function inferDropPlacementMode(
  pointer: { x: number; y: number } | null,
  overRect: { left: number; top: number; width: number; height: number } | null,
  sameColumn: boolean,
): DropPlacementMode {
  if (!pointer || !overRect) {
    return sameColumn ? 'below' : 'beside';
  }
  const relX = pointer.x - overRect.left;
  const relY = pointer.y - overRect.top;
  if (relY > overRect.height / 2) return 'below';
  if (relX > overRect.width / 2) return 'beside';
  return 'below';
}

/**
 * anchor 오른쪽에 draft 배치 (x = anchor.x + anchor.w, y = anchor.y).
 * 너비 초과 시 anchor 왼쪽, 그래도 안 되면 x만 clamp.
 */
export function applyStackBesideDraft(
  draft: WidgetConfigDraft,
  anchor: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft {
  const maxCols = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  const ax = effectiveLayoutX(anchor, orientation) ?? 0;
  const ay = effectiveLayoutY(anchor, orientation);
  const aw = effectiveLayoutW(anchor, orientation);
  const dw = effectiveLayoutW(draft, orientation);
  let nextX = ax + aw;
  if (nextX + dw > maxCols + 1e-9) {
    nextX = ax - dw;
  }
  nextX = snapLayoutXForWidgetWidth(
    Math.max(0, Math.min(nextX, maxCols - dw)),
    dw,
    maxCols,
  );
  return applyOrientationXY(draft, orientation, nextX, ay);
}

export function applyDropPlacementDraft(
  draft: WidgetConfigDraft,
  anchor: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
  mode: DropPlacementMode,
): WidgetConfigDraft {
  return mode === 'beside'
    ? applyStackBesideDraft(draft, anchor, orientation)
    : applyStackBelowDraft(draft, anchor, orientation);
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

/** display_order 순 top-left 패킹으로 x/y만 갱신 (w/h 유지) */
export function applyDisplayOrderPacking(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const packed = packOrientationLayouts(widgets, orientation);
  const placed = widgets.map((d) => {
    if (!d.is_enabled) return d;
    const c = packed.get(d.widget_key);
    if (!c) return d;
    return applyOrientationXY(d, orientation, c.x, c.y);
  });
  return compactOrientationLayoutY(placed, orientation);
}

/** 포인터 위치 → layout x/y (그리드 컨테이너 기준, 0.5 스냅) */
export function layoutCoordsFromGridPointer(
  pointer: { x: number; y: number },
  gridRect: { left: number; top: number; width: number },
  baseCols: number,
): { x: number; y: number } {
  const unitPx = gridRect.width / baseCols;
  if (unitPx <= 0) return { x: 0, y: 0 };
  return {
    x: snapLayoutCoord((pointer.x - gridRect.left) / unitPx),
    y: snapLayoutCoord((pointer.y - gridRect.top) / unitPx),
  };
}

/** w가 maxCols를 균등 분할할 때 0,w,2w… 슬롯, 아니면 0.5칸 단위 후보 */
export function layoutColumnSlots(w: number, maxCols: number): number[] {
  const slots: number[] = [];
  if (w <= 0 || maxCols <= 0) return [0];
  if (Math.abs(maxCols % w) < 1e-9 || w >= maxCols - 1e-9) {
    for (let x = 0; x + w <= maxCols + 1e-9; x = snapLayoutCoord(x + w)) {
      slots.push(snapLayoutCoord(x));
    }
    return slots.length ? slots : [0];
  }
  for (let x = 0; x + w <= maxCols + 1e-9; x = snapLayoutCoord(x + 0.5)) {
    slots.push(snapLayoutCoord(x));
  }
  return slots.length ? slots : [0];
}

function layoutRowSlots(h: number, maxRows: number): number[] {
  const slots: number[] = [];
  if (h <= 0 || maxRows <= 0) return [0];
  if (Math.abs(maxRows % h) < 1e-9 || h >= maxRows - 1e-9) {
    for (let y = 0; y + h <= maxRows + 1e-9; y = snapLayoutCoord(y + h)) {
      slots.push(snapLayoutCoord(y));
    }
    return slots.length ? slots : [0];
  }
  for (let y = 0; y + h <= maxRows + 1e-9; y = snapLayoutCoord(y + 0.5)) {
    slots.push(snapLayoutCoord(y));
  }
  return slots.length ? slots : [0];
}

function nearestLayoutSlot(value: number, slots: readonly number[]): number {
  let best = slots[0] ?? 0;
  let bestDist = Math.abs(value - best);
  for (const s of slots) {
    const d = Math.abs(value - s);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** 위젯 너비에 맞는 열 슬롯(6+6 → x=0|6 등)으로 x 스냅 */
export function snapLayoutXForWidgetWidth(
  rawX: number,
  w: number,
  maxCols: number,
): number {
  const clamped = snapLayoutCoord(Math.max(0, Math.min(rawX, maxCols - w)));
  return nearestLayoutSlot(clamped, layoutColumnSlots(w, maxCols));
}

/** 위젯 높이에 맞는 행 슬롯으로 y 스냅 */
export function snapLayoutYForWidgetHeight(
  rawY: number,
  h: number,
  maxRows: number,
): number {
  const clamped = snapLayoutCoord(Math.max(0, Math.min(rawY, maxRows - h)));
  return nearestLayoutSlot(clamped, layoutRowSlots(h, maxRows));
}

function draftOverlapsOthers(
  widgets: readonly WidgetConfigDraft[],
  key: DashboardWidgetKey,
  orientation: 'portrait' | 'landscape',
): boolean {
  const target = widgets.find((w) => w.widget_key === key && w.is_enabled);
  if (!target) return false;
  const tx = effectiveLayoutX(target, orientation) ?? 0;
  const ty = effectiveLayoutY(target, orientation);
  const tw = effectiveLayoutW(target, orientation);
  const th = effectiveLayoutH(target, orientation);
  const rect: LayoutRect = { key, x: tx, y: ty, w: tw, h: th };
  for (const w of widgets) {
    if (!w.is_enabled || w.widget_key === key) continue;
    const other: LayoutRect = {
      key: w.widget_key,
      x: effectiveLayoutX(w, orientation) ?? 0,
      y: effectiveLayoutY(w, orientation),
      w: effectiveLayoutW(w, orientation),
      h: effectiveLayoutH(w, orientation),
    };
    if (layoutRectsOverlap(rect, other)) return true;
  }
  return false;
}

/**
 * 편집기 드롭: 포인터 근처 → 열·행 슬롯 스냅, 겹치면 가까운 빈 슬롯 탐색.
 */
export function placeEditorDropFromPointer(
  widgets: readonly WidgetConfigDraft[],
  movedKey: DashboardWidgetKey,
  pointer: { x: number; y: number },
  gridRect: { left: number; top: number; width: number },
  baseCols: number,
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const moved = widgets.find((w) => w.widget_key === movedKey);
  if (!moved) return [...widgets];

  const maxCols = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  const maxRows = orientation === 'landscape' ? 12 : 24;
  const w = effectiveLayoutW(moved, orientation);
  const h = effectiveLayoutH(moved, orientation);
  const raw = layoutCoordsFromGridPointer(pointer, gridRect, baseCols);
  const primaryX = snapLayoutXForWidgetWidth(raw.x, w, maxCols);
  const primaryY = snapLayoutYForWidgetHeight(raw.y, h, maxRows);

  const candidates: Array<{ x: number; y: number; dist: number; sameRow: number }> = [];
  for (const y of layoutRowSlots(h, maxRows)) {
    for (const x of layoutColumnSlots(w, maxCols)) {
      candidates.push({
        x,
        y,
        dist: Math.abs(x - primaryX) + Math.abs(y - primaryY),
        sameRow: Math.abs(y - primaryY) < 1e-9 ? 0 : 1,
      });
    }
  }
  candidates.sort((a, b) =>
    a.sameRow !== b.sameRow ? a.sameRow - b.sameRow : a.dist - b.dist,
  );

  for (const { x, y } of candidates) {
    const trial = widgets.map((d) =>
      d.widget_key === movedKey ? applyOrientationXY(d, orientation, x, y) : d,
    );
    if (!draftOverlapsOthers(trial, movedKey, orientation)) {
      return trial;
    }
  }

  // 같은 행 빈 열 슬롯 (0→w→2w…) — 포인터 스냅 실패 시 3열 등 가로 배치
  for (const x of layoutColumnSlots(w, maxCols)) {
    const trial = widgets.map((d) =>
      d.widget_key === movedKey
        ? applyOrientationXY(d, orientation, x, primaryY)
        : d,
    );
    if (!draftOverlapsOthers(trial, movedKey, orientation)) {
      return trial;
    }
  }

  return widgets.map((d) =>
    d.widget_key === movedKey
      ? applyOrientationXY(d, orientation, primaryX, primaryY)
      : d,
  );
}

/** 드래그 드롭·그리드 스냅 배치 — x/y를 범위 내로 clamp 후 orientation 필드 갱신 */
export function placeDraftAtOrientationCoords(
  draft: WidgetConfigDraft,
  orientation: 'portrait' | 'landscape',
  x: number,
  y: number,
): WidgetConfigDraft {
  const maxCols = orientation === 'landscape' ? LANDSCAPE_COLS : PORTRAIT_COLS;
  const maxRows = orientation === 'landscape' ? 12 : 24;
  const w = effectiveLayoutW(draft, orientation);
  const h = effectiveLayoutH(draft, orientation);
  const clampedX = snapLayoutXForWidgetWidth(x, w, maxCols);
  const clampedY = snapLayoutYForWidgetHeight(y, h, maxRows);
  return applyOrientationXY(draft, orientation, clampedX, clampedY);
}

function syncPortraitLegacySpans(
  widgets: readonly WidgetConfigDraft[],
): WidgetConfigDraft[] {
  return widgets.map((d) => {
    if (!d.is_enabled) return d;
    const w = effectiveLayoutW(d, 'portrait');
    const h = effectiveLayoutH(d, 'portrait');
    const legacy = layoutWHToLegacySpans(w, h);
    return {
      ...d,
      colSpan: legacy.colSpan,
      rowSpan: legacy.rowSpan,
    };
  });
}

/**
 * 편집기 드래그·리사이즈 후: resolve+compact — layout 좌표 겹침이 남을 때만 full repack (드롭 위치 보존).
 */
export function finalizeEditorDraftsLayoutForOrientation(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const clamped = clampWidgetLayoutExtents(widgets, orientation);
  let result = resolveOrientationLayoutOverlaps(clamped, orientation);
  result = compactOrientationLayoutY(result, orientation);

  if (detectLayoutCoordinateOverlaps(result, orientation).length > 0) {
    result = ensureOrientationNoGridOverlaps(result, orientation);
  }

  if (orientation === 'portrait') {
    return syncPortraitLegacySpans(result);
  }
  return result;
}

/** 편집기 드래그·리사이즈 후: 겹침 해소 → colSpan/rowSpan 동기화 (저장 전 미리보기와 동일 파이프) */
export function finalizeDraftsLayoutForOrientation(
  widgets: readonly WidgetConfigDraft[],
  orientation: 'portrait' | 'landscape',
): WidgetConfigDraft[] {
  const resolved = ensureOrientationNoGridOverlaps(widgets, orientation);
  if (orientation !== 'portrait') {
    return resolved;
  }
  return syncPortraitLegacySpans(resolved);
}

/**
 * 단일 위젯을 size 프리셋으로 복구한 새 draft 반환.
 * layoutX/Y는 packLayoutsFromOrder 결과로 덮어쓰는 것을 권장.
 * size를 명시하지 않으면 WIDGET_DEFAULT_SIZE를 사용.
 */
export function applyPresetToWidget(
  draft: WidgetConfigDraft,
  size?: WidgetSize,
): WidgetConfigDraft {
  const targetSize = size ?? WIDGET_DEFAULT_SIZE[draft.widget_key];
  const preset12 = getPresetLayout(draft.widget_key, targetSize);
  const spanPreset = WIDGET_SIZE_PRESETS[targetSize];

  return {
    ...draft,
    size: targetSize,
    colSpan: spanPreset.colSpan,
    rowSpan: spanPreset.rowSpan,
    layoutW: preset12.w,
    layoutH: preset12.h,
    // Phase D: portrait/landscape — landscape w = portrait×2 (세로·가로 동일 비율)
    layoutPortraitW: preset12.w,
    layoutPortraitH: preset12.h,
    layoutLandscapeW: preset12.w * 2,
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

  const withCoords = resetted.map((d) => {
    const pCoords = packedPortrait.get(d.widget_key);
    const lCoords = packedLandscape.get(d.widget_key);
    return {
      ...d,
      layoutX: pCoords?.x ?? d.layoutX,
      layoutY: pCoords?.y ?? d.layoutY,
      layoutPortraitX: pCoords?.x ?? null,
      layoutPortraitY: pCoords?.y ?? null,
      layoutLandscapeX: lCoords?.x ?? null,
      layoutLandscapeY: lCoords?.y ?? null,
    };
  });

  return packDraftsOrientationCoordinates(withCoords);
}
