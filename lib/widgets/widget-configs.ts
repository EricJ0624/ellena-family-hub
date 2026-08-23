'use client';

import { compactDraftsLayoutCoordinates, layoutWHToLegacySpans } from './layout-presets';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import {
  DASHBOARD_WIDGET_KEYS,
  DEFAULT_WIDGET_CONFIGS,
  TRAVEL_M_LAYOUT_H,
  WIDGET_LAYOUT_PRESETS,
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

/** 예전 전역 M 높이(8)로 저장된 travel만 새 기본 높이로 맞춘다. 커스텀 높이는 유지. */
function adoptTravelDefaultHeight(h: number | null): number | null {
  return h === WIDGET_LAYOUT_PRESETS.M.h ? TRAVEL_M_LAYOUT_H : h;
}

function normalizeRows(rows: WidgetConfigRow[]): WidgetConfigDraft[] {
  const rowMap = new Map<DashboardWidgetKey, WidgetConfigRow>();
  for (const row of rows) rowMap.set(row.widget_key, row);

  const sorted = DEFAULT_WIDGET_CONFIGS.map((base) => {
    const found = rowMap.get(base.widget_key);
    if (!found) return { ...base };
    const isTravel = found.widget_key === 'travel';
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
      layoutH: isTravel
        ? adoptTravelDefaultHeight(clampNumeric(found.layout_h, 0.001, 9999))
        : clampNumeric(found.layout_h, 0.001, 9999),
      layoutVersion: clampInt(found.layout_version ?? 1, 1, 9999),
      // portrait (12열 × 24행)
      layoutPortraitX: clampNumeric(found.layout_portrait_x, 0, 12),
      layoutPortraitY: clampNumeric(found.layout_portrait_y, 0, 9999),
      layoutPortraitW: clampNumeric(found.layout_portrait_w, 0.001, 12),
      layoutPortraitH: isTravel
        ? adoptTravelDefaultHeight(clampNumeric(found.layout_portrait_h, 0.001, 9999))
        : clampNumeric(found.layout_portrait_h, 0.001, 9999),
      // landscape (24열 × 12행)
      layoutLandscapeX: clampNumeric(found.layout_landscape_x, 0, 24),
      layoutLandscapeY: clampNumeric(found.layout_landscape_y, 0, 9999),
      layoutLandscapeW: clampNumeric(found.layout_landscape_w, 0.001, 24),
      layoutLandscapeH: isTravel
        ? adoptTravelDefaultHeight(clampNumeric(found.layout_landscape_h, 0.001, 9999))
        : clampNumeric(found.layout_landscape_h, 0.001, 9999),
    };
  }).sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return b.priority - a.priority;
  });

  return compactDraftsLayoutCoordinates(sorted);
}

const WIDGET_CONFIG_CACHE_PREFIX = 'SFH_WIDGET_CONFIGS_v3_';

export function readWidgetConfigCache(groupId: string): WidgetConfigDraft[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${WIDGET_CONFIG_CACHE_PREFIX}${groupId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WidgetConfigDraft[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeWidgetConfigCache(groupId: string, configs: WidgetConfigDraft[]): void {
  if (typeof window === 'undefined' || configs.length === 0) return;
  try {
    sessionStorage.setItem(`${WIDGET_CONFIG_CACHE_PREFIX}${groupId}`, JSON.stringify(configs));
  } catch {
    // ignore quota / private mode
  }
}

export async function loadWidgetConfigs(groupId: string): Promise<WidgetConfigDraft[]> {
  const session = await waitForSupabaseSession(supabase);
  if (!session?.access_token) {
    throw new Error('WIDGET_CONFIGS_NO_SESSION');
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 350 * attempt));
    }

    const { data, error } = await supabase
      .from('widget_configs')
      .select(
        'id,group_id,widget_key,is_enabled,display_order,size,col_span,row_span,min_w,min_h,priority,layout_x,layout_y,layout_w,layout_h,layout_version,layout_portrait_x,layout_portrait_y,layout_portrait_w,layout_portrait_h,layout_landscape_x,layout_landscape_y,layout_landscape_w,layout_landscape_h',
      )
      .eq('group_id', groupId)
      .order('display_order', { ascending: true });

    if (error) {
      lastError = error;
      continue;
    }

    const rows = (data ?? []) as WidgetConfigRow[];
    // JWT/RLS 레이스로 0건 → DEFAULT(travel_diary=false)로 보이면 다른 위젯만 나오는 것처럼 보임
    if (rows.length === 0) {
      lastError = new Error('WIDGET_CONFIGS_EMPTY_ROWS');
      continue;
    }

    const normalized = normalizeRows(rows);
    writeWidgetConfigCache(groupId, normalized);
    return normalized;
  }

  throw lastError ?? new Error('WIDGET_CONFIGS_LOAD_FAILED');
}

export async function ensureWidgetConfigs(groupId: string, canWrite: boolean): Promise<WidgetConfigDraft[]> {
  let current: WidgetConfigDraft[];
  try {
    current = await loadWidgetConfigs(groupId);
  } catch (error) {
    const cached = readWidgetConfigCache(groupId);
    if (cached) {
      console.warn('[widget-configs] load failed, using cache:', error);
      return cached;
    }

    // 신규 그룹(행 없음) + owner만 시드. DEFAULT를 화면에 바로 쓰지 않는다(travel_diary 기본 off).
    const isEmpty =
      error instanceof Error &&
      (error.message === 'WIDGET_CONFIGS_EMPTY_ROWS' || error.message.includes('EMPTY_ROWS'));
    if (!canWrite || !isEmpty) {
      console.warn('[widget-configs] load failed, no cache:', error);
      throw error;
    }

    const seedRows = DEFAULT_WIDGET_CONFIGS.map((c) => ({
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
    const { error: seedError } = await supabase.from('widget_configs').upsert(seedRows, {
      onConflict: 'group_id,widget_key',
      ignoreDuplicates: true,
    });
    if (seedError) throw seedError;
    current = await loadWidgetConfigs(groupId);
  }

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

  if (error) {
    console.warn('[widget-configs] seed upsert failed, returning loaded rows:', error);
    return current;
  }

  try {
    return await loadWidgetConfigs(groupId);
  } catch (reloadError) {
    console.warn('[widget-configs] reload after seed failed:', reloadError);
    return current;
  }
}

export async function saveWidgetConfigs(groupId: string, drafts: WidgetConfigDraft[]): Promise<void> {
  const normalized = drafts
    .filter((d) => DASHBOARD_WIDGET_KEYS.includes(d.widget_key))
    .map((d, idx) => {
      const layout = sanitizeDraftLayoutForSave(d);
      const legacySpan = layoutWHToLegacySpans(
        layout.layoutPortraitW ?? layout.layoutW ?? 12,
        layout.layoutPortraitH ?? layout.layoutH ?? 8,
      );
      return {
        group_id: groupId,
        widget_key: d.widget_key,
        is_enabled: d.is_enabled,
        display_order: d.display_order ?? (idx + 1) * 10,
        size: d.size,
        col_span: legacySpan.colSpan,
        row_span: legacySpan.rowSpan,
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
