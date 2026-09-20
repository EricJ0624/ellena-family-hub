'use client';

import { supabase } from '@/lib/supabase';
import { packDraftsOrientationCoordinates } from './layout-presets';
import {
  DASHBOARD_WIDGET_KEYS,
  parseWidgetSize,
  type DashboardWidgetKey,
  type WidgetConfigDraft,
} from './types';

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function clampNumeric(n: unknown, min: number, max: number): number | null {
  if (n === null || n === undefined) return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}

function isWidgetKey(k: unknown): k is DashboardWidgetKey {
  return typeof k === 'string' && (DASHBOARD_WIDGET_KEYS as readonly string[]).includes(k);
}

/** DB jsonb → 유효한 스냅샷만 남김 */
export function parseWidgetLayoutDefaults(raw: unknown): WidgetConfigDraft[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: WidgetConfigDraft[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (!isWidgetKey(r.widget_key)) continue;
    out.push({
      widget_key: r.widget_key,
      is_enabled: Boolean(r.is_enabled),
      display_order: clampInt(r.display_order, 1, 9999, 10),
      size: parseWidgetSize(typeof r.size === 'string' ? r.size : 'M'),
      colSpan: clampInt(r.colSpan ?? r.col_span, 1, 4, 4),
      rowSpan: clampInt(r.rowSpan ?? r.row_span, 1, 6, 2),
      minW: clampNumeric(r.minW ?? r.min_w, 1, 4),
      minH: clampNumeric(r.minH ?? r.min_h, 1, 6),
      priority: clampInt(r.priority, -9999, 9999, 0),
      layoutX: clampNumeric(r.layoutX ?? r.layout_x, 0, 12),
      layoutY: clampNumeric(r.layoutY ?? r.layout_y, 0, 9999),
      layoutW: clampNumeric(r.layoutW ?? r.layout_w, 0.001, 12),
      layoutH: clampNumeric(r.layoutH ?? r.layout_h, 0.001, 9999),
      layoutVersion: clampInt(r.layoutVersion ?? r.layout_version, 1, 9999, 1),
      layoutPortraitX: clampNumeric(r.layoutPortraitX ?? r.layout_portrait_x, 0, 12),
      layoutPortraitY: clampNumeric(r.layoutPortraitY ?? r.layout_portrait_y, 0, 9999),
      layoutPortraitW: clampNumeric(r.layoutPortraitW ?? r.layout_portrait_w, 0.001, 12),
      layoutPortraitH: clampNumeric(r.layoutPortraitH ?? r.layout_portrait_h, 0.001, 9999),
      layoutLandscapeX: clampNumeric(r.layoutLandscapeX ?? r.layout_landscape_x, 0, 24),
      layoutLandscapeY: clampNumeric(r.layoutLandscapeY ?? r.layout_landscape_y, 0, 9999),
      layoutLandscapeW: clampNumeric(r.layoutLandscapeW ?? r.layout_landscape_w, 0.001, 24),
      layoutLandscapeH: clampNumeric(r.layoutLandscapeH ?? r.layout_landscape_h, 0.001, 9999),
    });
  }
  return out.length > 0 ? out : null;
}

export async function loadGroupWidgetLayoutDefaults(
  groupId: string,
): Promise<WidgetConfigDraft[] | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('widget_layout_defaults')
    .eq('id', groupId)
    .maybeSingle();
  if (error) throw error;
  return parseWidgetLayoutDefaults(data?.widget_layout_defaults);
}

export async function saveGroupWidgetLayoutDefaults(
  groupId: string,
  drafts: readonly WidgetConfigDraft[],
): Promise<void> {
  const packed = packDraftsOrientationCoordinates([...drafts]);
  const { error } = await supabase
    .from('groups')
    .update({ widget_layout_defaults: packed })
    .eq('id', groupId);
  if (error) throw error;
}

/** 저장된 그룹 기본값으로 drafts 교체. 스냅샷에 없는 키는 유지. */
export function applyWidgetLayoutDefaults(
  current: readonly WidgetConfigDraft[],
  snapshot: readonly WidgetConfigDraft[],
): WidgetConfigDraft[] {
  const map = new Map(snapshot.map((s) => [s.widget_key, s]));
  const merged = current.map((c) => {
    const s = map.get(c.widget_key);
    if (!s) return c;
    return { ...s, widget_key: c.widget_key };
  });
  return packDraftsOrientationCoordinates(merged);
}
