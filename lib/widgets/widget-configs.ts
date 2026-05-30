'use client';

import { supabase } from '@/lib/supabase';
import {
  DASHBOARD_WIDGET_KEYS,
  DEFAULT_WIDGET_CONFIGS,
  parseWidgetSize,
  type DashboardWidgetKey,
  type WidgetConfigDraft,
  type WidgetConfigRow,
} from './types';

function clampInt(n: number, min: number, max: number): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function clampNumeric(n: number | null | undefined, min: number, max: number): number | null {
  if (n === null || n === undefined) return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}

/** layout_x + layout_w <= maxCols (DB CHECK) — x를 줄여 맞춤 */
function fitLayoutXToWidth(
  x: number | null,
  w: number | null,
  maxCols: number,
): number | null {
  if (x == null || w == null) return x;
  if (x + w <= maxCols) return x;
  return Math.max(0, maxCols - w);
}

/** 저장용: portrait/landscape·공유 layout_* 클램프 및 x+w 제약 만족 */
function sanitizeDraftLayoutForSave(d: WidgetConfigDraft): Pick<
  WidgetConfigDraft,
  | 'layoutX'
  | 'layoutY'
  | 'layoutW'
  | 'layoutH'
  | 'layoutPortraitX'
  | 'layoutPortraitY'
  | 'layoutPortraitW'
  | 'layoutPortraitH'
  | 'layoutLandscapeX'
  | 'layoutLandscapeY'
  | 'layoutLandscapeW'
  | 'layoutLandscapeH'
> {
  const portraitW = clampNumeric(d.layoutPortraitW ?? d.layoutW, 0.001, 12);
  const portraitH = clampNumeric(d.layoutPortraitH ?? d.layoutH, 0.001, 9999);
  let portraitX = clampNumeric(d.layoutPortraitX ?? d.layoutX, 0, 12);
  const portraitY = clampNumeric(d.layoutPortraitY ?? d.layoutY, 0, 9999);
  portraitX = fitLayoutXToWidth(portraitX, portraitW, 12);

  const landscapeW = clampNumeric(d.layoutLandscapeW ?? d.layoutW, 0.001, 24);
  const landscapeH = clampNumeric(d.layoutLandscapeH ?? d.layoutH, 0.001, 9999);
  let landscapeX = clampNumeric(d.layoutLandscapeX ?? d.layoutX, 0, 24);
  const landscapeY = clampNumeric(d.layoutLandscapeY ?? d.layoutY, 0, 9999);
  landscapeX = fitLayoutXToWidth(landscapeX, landscapeW, 24);

  return {
    layoutPortraitX: portraitX,
    layoutPortraitY: portraitY,
    layoutPortraitW: portraitW,
    layoutPortraitH: portraitH,
    layoutLandscapeX: landscapeX,
    layoutLandscapeY: landscapeY,
    layoutLandscapeW: landscapeW,
    layoutLandscapeH: landscapeH,
    layoutX: portraitX,
    layoutY: portraitY,
    layoutW: portraitW,
    layoutH: portraitH,
  };
}

function normalizeRows(rows: WidgetConfigRow[]): WidgetConfigDraft[] {
  const rowMap = new Map<DashboardWidgetKey, WidgetConfigRow>();
  for (const row of rows) rowMap.set(row.widget_key, row);

  return DEFAULT_WIDGET_CONFIGS.map((base) => {
    const found = rowMap.get(base.widget_key);
    if (!found) return { ...base };
    return {
      widget_key: found.widget_key,
      is_enabled: found.is_enabled,
      display_order: found.display_order,
      size: parseWidgetSize(found.size),
      colSpan: clampInt(found.col_span, 1, 4),
      rowSpan: clampInt(found.row_span, 1, 6),
      minW: found.min_w,
      minH: found.min_h,
      priority: clampInt(found.priority, -9999, 9999),
      layoutX: clampNumeric(found.layout_x, 0, 12),
      layoutY: clampNumeric(found.layout_y, 0, 9999),
      layoutW: clampNumeric(found.layout_w, 0.001, 12),
      layoutH: clampNumeric(found.layout_h, 0.001, 9999),
      layoutVersion: clampInt(found.layout_version ?? 1, 1, 9999),
      // portrait (12열 × 24행)
      layoutPortraitX: clampNumeric(found.layout_portrait_x, 0, 12),
      layoutPortraitY: clampNumeric(found.layout_portrait_y, 0, 9999),
      layoutPortraitW: clampNumeric(found.layout_portrait_w, 0.001, 12),
      layoutPortraitH: clampNumeric(found.layout_portrait_h, 0.001, 9999),
      // landscape (24열 × 12행)
      layoutLandscapeX: clampNumeric(found.layout_landscape_x, 0, 24),
      layoutLandscapeY: clampNumeric(found.layout_landscape_y, 0, 9999),
      layoutLandscapeW: clampNumeric(found.layout_landscape_w, 0.001, 24),
      layoutLandscapeH: clampNumeric(found.layout_landscape_h, 0.001, 9999),
    };
  }).sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return b.priority - a.priority;
  });
}

export async function loadWidgetConfigs(groupId: string): Promise<WidgetConfigDraft[]> {
  const { data, error } = await supabase
    .from('widget_configs')
    .select(
      'id,group_id,widget_key,is_enabled,display_order,size,col_span,row_span,min_w,min_h,priority,layout_x,layout_y,layout_w,layout_h,layout_version,layout_portrait_x,layout_portrait_y,layout_portrait_w,layout_portrait_h,layout_landscape_x,layout_landscape_y,layout_landscape_w,layout_landscape_h',
    )
    .eq('group_id', groupId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as WidgetConfigRow[];
  return normalizeRows(rows);
}

export async function ensureWidgetConfigs(groupId: string, canWrite: boolean): Promise<WidgetConfigDraft[]> {
  const current = await loadWidgetConfigs(groupId);
  const missing = DASHBOARD_WIDGET_KEYS.filter((k) => !current.some((c) => c.widget_key === k));

  if (missing.length === 0 || !canWrite) return current;

  const missingRows = DEFAULT_WIDGET_CONFIGS.filter((c) => missing.includes(c.widget_key)).map((c) => ({
    group_id: groupId,
    widget_key: c.widget_key,
    is_enabled: c.is_enabled,
    display_order: c.display_order,
    size: c.size,
    col_span: c.colSpan,
    row_span: c.rowSpan,
    min_w: c.minW,
    min_h: c.minH,
    priority: c.priority,
    layout_x: c.layoutX,
    layout_y: c.layoutY,
    layout_w: c.layoutW,
    layout_h: c.layoutH,
    layout_version: c.layoutVersion,
    layout_portrait_x: c.layoutPortraitX,
    layout_portrait_y: c.layoutPortraitY,
    layout_portrait_w: c.layoutPortraitW,
    layout_portrait_h: c.layoutPortraitH,
    layout_landscape_x: c.layoutLandscapeX,
    layout_landscape_y: c.layoutLandscapeY,
    layout_landscape_w: c.layoutLandscapeW,
    layout_landscape_h: c.layoutLandscapeH,
  }));

  const { error } = await supabase.from('widget_configs').upsert(missingRows, {
    onConflict: 'group_id,widget_key',
    ignoreDuplicates: true,
  });

  if (error) throw error;
  return loadWidgetConfigs(groupId);
}

export async function saveWidgetConfigs(groupId: string, drafts: WidgetConfigDraft[]): Promise<void> {
  const normalized = drafts
    .filter((d) => DASHBOARD_WIDGET_KEYS.includes(d.widget_key))
    .map((d, idx) => {
      const layout = sanitizeDraftLayoutForSave(d);
      return {
        group_id: groupId,
        widget_key: d.widget_key,
        is_enabled: d.is_enabled,
        display_order: d.display_order ?? (idx + 1) * 10,
        size: d.size,
        col_span: clampInt(d.colSpan, 1, 4),
        row_span: clampInt(d.rowSpan, 1, 6),
        min_w: d.minW,
        min_h: d.minH,
        priority: clampInt(d.priority, -9999, 9999),
        layout_version: d.layoutVersion,
        layout_x: layout.layoutX,
        layout_y: layout.layoutY,
        layout_w: layout.layoutW,
        layout_h: layout.layoutH,
        layout_portrait_x: layout.layoutPortraitX,
        layout_portrait_y: layout.layoutPortraitY,
        layout_portrait_w: layout.layoutPortraitW,
        layout_portrait_h: layout.layoutPortraitH,
        layout_landscape_x: layout.layoutLandscapeX,
        layout_landscape_y: layout.layoutLandscapeY,
        layout_landscape_w: layout.layoutLandscapeW,
        layout_landscape_h: layout.layoutLandscapeH,
      };
    });

  const { error } = await supabase.from('widget_configs').upsert(normalized, {
    onConflict: 'group_id,widget_key',
  });
  if (error) throw error;
}
