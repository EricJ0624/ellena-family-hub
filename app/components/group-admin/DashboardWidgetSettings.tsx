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
} from '@/lib/widgets/types';
import { ensureWidgetConfigs, saveWidgetConfigs } from '@/lib/widgets/widget-configs';

interface DashboardWidgetSettingsProps {
  groupId: string | null;
  isOwner: boolean;
}

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
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : gat('widgets_error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDrafts(configs);
    setEditMode(false);
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
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={cfg.is_enabled}
                    onChange={() => toggle(cfg.widget_key)}
                    disabled={!editMode || saving}
                  />
                  <span className="text-sm font-medium text-slate-800">
                    {widgetLabels[cfg.widget_key]}
                  </span>
                </div>
                <div className="flex gap-1">
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
            ))}
        </div>
      )}
    </div>
  );
}
