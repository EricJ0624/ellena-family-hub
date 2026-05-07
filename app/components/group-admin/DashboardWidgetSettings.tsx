'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getCommonTranslation } from '@/lib/translations/common';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getTravelTranslation } from '@/lib/translations/travel';
import { getGroupAdminTranslation } from '@/lib/translations/groupAdmin';
import type { CommonTranslations } from '@/lib/translations/common';
import type { DashboardTranslations } from '@/lib/translations/dashboard';
import type { TravelTranslations } from '@/lib/translations/travel';
import type { GroupAdminTranslations } from '@/lib/translations/groupAdmin';
import {
  type DashboardWidgetKey,
  type WidgetConfigDraft,
  type WidgetSize,
  WIDGET_SIZE_PRESETS,
} from '@/lib/widgets/types';
import { ensureWidgetConfigs, saveWidgetConfigs } from '@/lib/widgets/widget-configs';

interface DashboardWidgetSettingsProps {
  groupId: string | null;
  isOwner: boolean;
}

const SIZE_OPTIONS: WidgetSize[] = ['S', 'M', 'L', 'XL'];

export function DashboardWidgetSettings({ groupId, isOwner }: DashboardWidgetSettingsProps) {
  const { lang } = useLanguage();
  const ct = (key: keyof CommonTranslations) => getCommonTranslation(lang, key);
  const dt = (key: keyof DashboardTranslations) => getDashboardTranslation(lang, key);
  const tt = (key: keyof TravelTranslations) => getTravelTranslation(lang, key);
  const gat = (key: keyof GroupAdminTranslations) => getGroupAdminTranslation(lang, key);

  const [configs, setConfigs] = useState<WidgetConfigDraft[]>([]);
  const [drafts, setDrafts] = useState<WidgetConfigDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAdvancedLayout, setShowAdvancedLayout] = useState(false);

  const widgetLabels: Record<DashboardWidgetKey, string> = useMemo(
    () => ({
      tasks: dt('todo_section_title'),
      calendar: dt('section_title_calendar'),
      chat: dt('section_title_chat'),
      location: dt('section_title_location'),
      album: dt('section_title_memories'),
      travel: tt('title'),
      piggy: dt('piggy_section_admin_title'),
    }),
    [lang]
  );

  const sizeOptionLabel = useCallback(
    (size: WidgetSize): string => {
      switch (size) {
        case 'S':
          return gat('widgets_size_S');
        case 'M':
          return gat('widgets_size_M');
        case 'L':
          return gat('widgets_size_L');
        case 'XL':
          return gat('widgets_size_XL');
        default:
          return size;
      }
    },
    [lang]
  );

  const reload = useCallback(async () => {
    if (!groupId) {
      setConfigs([]);
      setDrafts([]);
      setEditMode(false);
      return;
    }
    try {
      setLoading(true);
      const next = await ensureWidgetConfigs(groupId, isOwner);
      setConfigs(next);
      setDrafts(next);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('widget configs load', e);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, isOwner]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggle = (key: DashboardWidgetKey) => {
    setDrafts((prev) =>
      prev.map((c) => (c.widget_key === key ? { ...c, is_enabled: !c.is_enabled } : c))
    );
  };

  const move = (key: DashboardWidgetKey, dir: 'up' | 'down') => {
    setDrafts((prev) => {
      const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
      const idx = sorted.findIndex((x) => x.widget_key === key);
      if (idx < 0) return prev;
      const n = dir === 'up' ? idx - 1 : idx + 1;
      if (n < 0 || n >= sorted.length) return prev;
      const t = sorted[idx];
      sorted[idx] = sorted[n];
      sorted[n] = t;
      return sorted.map((c, i) => ({ ...c, display_order: (i + 1) * 10 }));
    });
  };

  const applySizePreset = (key: DashboardWidgetKey, size: WidgetSize) => {
    const preset = WIDGET_SIZE_PRESETS[size];
    setDrafts((prev) =>
      prev.map((c) =>
        c.widget_key === key ? { ...c, size, colSpan: preset.colSpan, rowSpan: preset.rowSpan } : c
      )
    );
  };

  const setNumericSpan = (key: DashboardWidgetKey, field: 'colSpan' | 'rowSpan', raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const max = field === 'colSpan' ? 4 : 6;
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(1, parsed)) : 1;
    setDrafts((prev) => prev.map((c) => (c.widget_key === key ? { ...c, [field]: next } : c)));
  };

  const handleSave = async () => {
    if (!groupId) return;
    if (!drafts.some((x) => x.is_enabled)) {
      alert(gat('widgets_alert_min_one'));
      return;
    }
    try {
      setSaving(true);
      await saveWidgetConfigs(groupId, drafts);
      setConfigs(drafts);
      setEditMode(false);
      setShowAdvancedLayout(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : gat('widgets_error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDrafts(configs);
    setEditMode(false);
    setShowAdvancedLayout(false);
  };

  if (!groupId) {
    return <p className="text-sm text-slate-500">{gat('widgets_no_group')}</p>;
  }

  if (!isOwner) {
    return <p className="text-sm text-slate-500">{gat('widgets_owner_only')}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-slate-800">{gat('widgets_panel_title')}</h2>
        <p className="text-sm text-slate-500">{gat('widgets_panel_hint')}</p>
        {editMode ? (
          <p className="mt-2 text-xs text-slate-400">{gat('widgets_size_hint')}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!editMode ? (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {gat('widgets_edit_start')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {ct('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? ct('loading') : ct('save')}
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedLayout((v) => !v)}
              className="rounded-lg border border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {gat('widgets_advanced_layout')}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{ct('loading')}</p>
      ) : (
        <div className="grid max-w-2xl gap-2">
          {drafts
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((cfg, idx, arr) => (
              <div
                key={cfg.widget_key}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={cfg.is_enabled}
                      onChange={() => toggle(cfg.widget_key)}
                      disabled={!editMode || saving}
                      className="shrink-0"
                    />
                    <span className="truncate text-sm font-medium text-slate-800">
                      {widgetLabels[cfg.widget_key]}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-40"
                      onClick={() => move(cfg.widget_key, 'up')}
                      disabled={!editMode || idx === 0 || saving}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-40"
                      onClick={() => move(cfg.widget_key, 'down')}
                      disabled={!editMode || idx === arr.length - 1 || saving}
                    >
                      ▼
                    </button>
                  </div>
                </div>

                {editMode ? (
                  <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold text-slate-600">
                      {gat('widgets_size_label')}
                      <select
                        value={cfg.size}
                        disabled={saving}
                        onChange={(e) =>
                          applySizePreset(cfg.widget_key, e.target.value as WidgetSize)
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-800"
                      >
                        {SIZE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {sizeOptionLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {showAdvancedLayout ? (
                      <div className="flex flex-wrap gap-3">
                        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                          {gat('widgets_col_span')}
                          <input
                            type="number"
                            min={1}
                            max={4}
                            value={cfg.colSpan}
                            disabled={saving}
                            onChange={(e) =>
                              setNumericSpan(cfg.widget_key, 'colSpan', e.target.value)
                            }
                            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-800"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                          {gat('widgets_row_span')}
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={cfg.rowSpan}
                            disabled={saving}
                            onChange={(e) =>
                              setNumericSpan(cfg.widget_key, 'rowSpan', e.target.value)
                            }
                            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-800"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
