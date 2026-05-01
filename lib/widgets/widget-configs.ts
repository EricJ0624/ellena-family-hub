'use client';

import { supabase } from '@/lib/supabase';
import {
  DASHBOARD_WIDGET_KEYS,
  DEFAULT_WIDGET_CONFIGS,
  type DashboardWidgetKey,
  type WidgetConfigDraft,
  type WidgetConfigRow,
} from './types';

function normalizeRows(rows: WidgetConfigRow[]): WidgetConfigDraft[] {
  const rowMap = new Map<DashboardWidgetKey, WidgetConfigRow>();
  for (const row of rows) rowMap.set(row.widget_key, row);

  return DEFAULT_WIDGET_CONFIGS.map((base) => {
    const found = rowMap.get(base.widget_key);
    return found
      ? {
          widget_key: found.widget_key,
          is_enabled: found.is_enabled,
          display_order: found.display_order,
        }
      : base;
  }).sort((a, b) => a.display_order - b.display_order);
}

export async function loadWidgetConfigs(groupId: string): Promise<WidgetConfigDraft[]> {
  const { data, error } = await supabase
    .from('widget_configs')
    .select('id,group_id,widget_key,is_enabled,display_order')
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
    .map((d, idx) => ({
      group_id: groupId,
      widget_key: d.widget_key,
      is_enabled: d.is_enabled,
      display_order: (idx + 1) * 10,
    }));

  const { error } = await supabase.from('widget_configs').upsert(normalized, {
    onConflict: 'group_id,widget_key',
  });
  if (error) throw error;
}

