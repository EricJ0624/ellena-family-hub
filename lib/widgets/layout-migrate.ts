/**
 * layout-migrate.ts — 위젯 레이아웃 마이그레이션 헬퍼 (Phase 6)
 *
 * 목적:
 *  - 기존 `col_span / row_span / display_order` 기반 데이터를
 *    12열 정규화 좌표(`layout_x/y/w/h`)로 변환한다.
 *  - DB 백필 SQL 생성 및 런타임 마이그레이션 모두에 사용.
 *
 * 설계 원칙:
 *  - 순수 함수 — Supabase 호출 없음.
 *  - `layout_w/h`가 이미 설정된 위젯은 건드리지 않는다 (멱등).
 *  - 변환 기준: `col_span/row_span` → WIDGET_SIZE_PRESETS의 scale로 12열 매핑.
 *  - 위치(`layout_x/y`): `packLayoutsFromOrder` 결과를 그대로 사용.
 */

import {
  WIDGET_SIZE_PRESETS,
  WIDGET_LAYOUT_PRESETS,
  WIDGET_DEFAULT_SIZE,
  type DashboardWidgetKey,
  type WidgetConfigDraft,
  type WidgetSize,
} from './types';
import { BASE_COLS, packLayoutsFromOrder } from './layout-presets';

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * col_span(1~4) + size → 12열 기준 layoutW 추정.
 *
 * 로직:
 *  1. size가 있으면 WIDGET_LAYOUT_PRESETS[size].w 우선 사용.
 *  2. size가 없거나 WIDGET_SIZE_PRESETS의 colSpan과 저장된 colSpan이 다르면
 *     colSpan × (BASE_COLS / 4) 로 선형 스케일링.
 */
function inferLayoutW(colSpan: number, size: WidgetSize): number {
  const preset = WIDGET_LAYOUT_PRESETS[size];
  const defaultColSpan = WIDGET_SIZE_PRESETS[size].colSpan;

  if (colSpan === defaultColSpan) {
    return preset.w;
  }
  // 사용자가 span을 직접 조정한 경우 — 비율로 스케일
  const raw = Math.round((colSpan * BASE_COLS) / 4);
  return Math.min(BASE_COLS, Math.max(1, raw));
}

/**
 * row_span(1~6) + size → 12열 기준 layoutH 추정.
 */
function inferLayoutH(rowSpan: number, size: WidgetSize): number {
  const preset = WIDGET_LAYOUT_PRESETS[size];
  const defaultRowSpan = WIDGET_SIZE_PRESETS[size].rowSpan;

  if (rowSpan === defaultRowSpan) {
    return preset.h;
  }
  // 직접 조정된 경우 — 비율로 스케일 (row는 1~12 범위)
  const raw = Math.round((rowSpan * preset.h) / Math.max(1, defaultRowSpan));
  return Math.min(12, Math.max(1, raw));
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 단일 WidgetConfigDraft를 layout_* 있는 형태로 변환.
 *
 * - `layoutW`가 이미 null이 아닌 경우 → 그대로 반환 (멱등).
 * - `layoutX/Y`는 packLayoutsFromOrder 결과를 별도로 덮어쓰는 것을 권장.
 *   이 함수는 w/h만 설정하며 x/y는 null 유지 (pack 후 채워짐).
 */
export function migrateWidgetLayoutWH(draft: WidgetConfigDraft): WidgetConfigDraft {
  if (draft.layoutW != null) return draft;

  const size = draft.size in WIDGET_LAYOUT_PRESETS
    ? (draft.size as WidgetSize)
    : (WIDGET_DEFAULT_SIZE[draft.widget_key] as WidgetSize);

  return {
    ...draft,
    layoutW: inferLayoutW(draft.colSpan, size),
    layoutH: inferLayoutH(draft.rowSpan, size),
  };
}

/**
 * 배열 전체를 마이그레이션: layout_* 없는 위젯만 변환 후 packLayoutsFromOrder.
 *
 * 반환값: 모든 위젯이 layoutX/Y/W/H를 갖는 WidgetConfigDraft[]
 */
export function migrateAllLayouts(drafts: readonly WidgetConfigDraft[]): WidgetConfigDraft[] {
  const withWH = drafts.map(migrateWidgetLayoutWH);
  const packed = packLayoutsFromOrder(withWH);

  return withWH.map((d) => {
    if (!d.is_enabled) return d;
    const coords = packed.get(d.widget_key);
    if (!coords) return d;
    return {
      ...d,
      layoutX: d.layoutX ?? coords.layoutX,
      layoutY: d.layoutY ?? coords.layoutY,
    };
  });
}

/**
 * UPDATE SQL 생성 — 백필 대상 행에 대한 SET 절 반환.
 *
 * 사용 예:
 *   const sql = buildBackfillSql(migratedDrafts, groupId);
 *   await supabase.rpc('exec_sql', { query: sql });
 *
 * @returns UPDATE SQL 문자열 (세미콜론 포함)
 */
export function buildBackfillSql(
  migrated: readonly WidgetConfigDraft[],
  groupId: string,
): string {
  const rows = migrated.filter(
    (d) =>
      d.layoutX != null &&
      d.layoutY != null &&
      d.layoutW != null &&
      d.layoutH != null,
  );

  if (rows.length === 0) return '-- No rows to backfill';

  const caseX = rows
    .map((d) => `    WHEN widget_key = '${d.widget_key}' THEN ${d.layoutX!.toFixed(3)}`)
    .join('\n');
  const caseY = rows
    .map((d) => `    WHEN widget_key = '${d.widget_key}' THEN ${d.layoutY!.toFixed(3)}`)
    .join('\n');
  const caseW = rows
    .map((d) => `    WHEN widget_key = '${d.widget_key}' THEN ${d.layoutW!.toFixed(3)}`)
    .join('\n');
  const caseH = rows
    .map((d) => `    WHEN widget_key = '${d.widget_key}' THEN ${d.layoutH!.toFixed(3)}`)
    .join('\n');
  const keys = rows.map((d) => `'${d.widget_key}'`).join(', ');

  return `
UPDATE public.widget_configs
SET
  layout_x = CASE\n${caseX}\n  END,
  layout_y = CASE\n${caseY}\n  END,
  layout_w = CASE\n${caseW}\n  END,
  layout_h = CASE\n${caseH}\n  END,
  layout_version = 1
WHERE
  group_id = '${groupId}'
  AND widget_key IN (${keys})
  AND layout_w IS NULL;
`.trim();
}
