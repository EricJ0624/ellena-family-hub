'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getCommonTranslation } from '@/lib/translations/common';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getTravelTranslation } from '@/lib/translations/travel';
import { getGamesTranslation } from '@/lib/translations/games';
import { getGroupAdminTranslation } from '@/lib/translations/groupAdmin';
import type { CommonTranslations } from '@/lib/translations/common';
import type { DashboardTranslations } from '@/lib/translations/dashboard';
import type { TravelTranslations } from '@/lib/translations/travel';
import type { GamesTranslations } from '@/lib/translations/games';
import type { GroupAdminTranslations } from '@/lib/translations/groupAdmin';
import {
  type DashboardWidgetKey,
  type WidgetConfigDraft,
  type WidgetSize,
} from '@/lib/widgets/types';
import { ensureWidgetConfigs, saveWidgetConfigs } from '@/lib/widgets/widget-configs';
import {
  applyPresetToWidget,
  packDraftsOrientationCoordinates,
  packOrientationLayouts,
  resetAllLayouts,
} from '@/lib/widgets/layout-presets';
import { WidgetLayoutEditor } from './WidgetLayoutEditor';
import { dispatchWidgetConfigsUpdated } from '@/lib/widgets/widget-config-events';

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
  const gt = (key: keyof GamesTranslations) => getGamesTranslation(lang, key);
  const gat = (key: keyof GroupAdminTranslations) => getGroupAdminTranslation(lang, key);

  const [configs, setConfigs] = useState<WidgetConfigDraft[]>([]);
  const [drafts, setDrafts] = useState<WidgetConfigDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showAdvancedLayout, setShowAdvancedLayout] = useState(false);
  /** DnD 드래그 중 모달 스크롤 잠금 — 스크롤 컨테이너가 포인터 이벤트를 가로채는 것을 방지 */
  const [isDragging, setIsDragging] = useState(false);

  const widgetLabels: Record<DashboardWidgetKey, string> = useMemo(
    () => ({
      tasks: dt('todo_section_title'),
      calendar: dt('section_title_calendar'),
      chat: dt('section_title_chat'),
      location: dt('section_title_location'),
      album: dt('section_title_memories'),
      travel: tt('title'),
      piggy: dt('piggy_section_admin_title'),
      games: gt('section_title'),
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
    setDrafts((prev) => {
      const updated = prev.map((c) =>
        c.widget_key === key ? applyPresetToWidget(c, size) : c,
      );
      const packedP = packOrientationLayouts(updated, 'portrait');
      const packedL = packOrientationLayouts(updated, 'landscape');
      return updated.map((d) => {
        const pCoords = packedP.get(d.widget_key);
        const lCoords = packedL.get(d.widget_key);
        return {
          ...d,
          layoutPortraitX: pCoords?.x ?? d.layoutPortraitX,
          layoutPortraitY: pCoords?.y ?? d.layoutPortraitY,
          layoutLandscapeX: lCoords?.x ?? d.layoutLandscapeX,
          layoutLandscapeY: lCoords?.y ?? d.layoutLandscapeY,
          layoutX: pCoords?.x ?? d.layoutX,
          layoutY: pCoords?.y ?? d.layoutY,
        };
      });
    });
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
      const toSave = packDraftsOrientationCoordinates(drafts);
      await saveWidgetConfigs(groupId, toSave);
      setConfigs(toSave);
      setDrafts(toSave);
      setEditMode(false);
      setIsEditorOpen(false);
      setShowAdvancedLayout(false);
      dispatchWidgetConfigsUpdated();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message)
            : gat('widgets_error_save');
      if (process.env.NODE_ENV === 'development') {
        console.warn('saveWidgetConfigs', e);
      }
      alert(msg || gat('widgets_error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDrafts(configs);
    setEditMode(false);
    setIsEditorOpen(false);
    setShowAdvancedLayout(false);
  };

  const handleOpenEditor = () => {
    setEditMode(true);
    setIsEditorOpen(true);
  };

  /** 단일 위젯을 기본 크기·위치로 복구 (Phase D: portrait + landscape 양쪽 복구) */
  const restoreOne = useCallback(
    (key: DashboardWidgetKey) => {
      setDrafts((prev) => {
        const updated = prev.map((d) => (d.widget_key === key ? applyPresetToWidget(d) : d));
        const packedP = packOrientationLayouts(updated, 'portrait');
        const packedL = packOrientationLayouts(updated, 'landscape');
        return updated.map((d) => {
          const pCoords = packedP.get(d.widget_key);
          const lCoords = packedL.get(d.widget_key);
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
      });
    },
    [],
  );

  /** 전체 위젯을 기본 크기·위치로 복구 */
  const restoreAll = useCallback(() => {
    setDrafts((prev) => resetAllLayouts(prev));
  }, []);

  if (!groupId) {
    return <p className="text-sm text-slate-500">{gat('widgets_no_group')}</p>;
  }

  if (!isOwner) {
    return <p className="text-sm text-slate-500">{gat('widgets_owner_only')}</p>;
  }

  const editorProps = {
    drafts,
    editMode,
    saving,
    widgetLabels,
    t: {
      widgets_restore_defaults: gat('widgets_restore_defaults'),
      widgets_restore_all: gat('widgets_restore_all'),
      widgets_layout_edit_hint: gat('widgets_layout_edit_hint'),
      widgets_preview_portrait: gat('widgets_preview_portrait'),
      widgets_preview_landscape: gat('widgets_preview_landscape'),
      widgets_preview_desktop: gat('widgets_preview_desktop'),
      widgets_disabled_section: gat('widgets_disabled_section'),
    },
    onDraftsChange: setDrafts,
    onToggle: toggle,
    onRestoreOne: restoreOne,
    onRestoreAll: restoreAll,
    onDragStateChange: setIsDragging,
  };

  const advancedPanel = editMode && showAdvancedLayout && (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      {drafts
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((cfg) => (
          <div key={cfg.widget_key} className="flex flex-wrap items-center gap-3">
            <span className="w-24 truncate text-xs font-medium text-slate-600">
              {widgetLabels[cfg.widget_key]}
            </span>
            <label className="flex items-center gap-1 text-xs text-slate-500">
              {gat('widgets_col_span')}
              <input
                type="number"
                min={1}
                max={4}
                value={cfg.colSpan}
                disabled={saving}
                onChange={(e) => setNumericSpan(cfg.widget_key, 'colSpan', e.target.value)}
                className="ml-1 w-14 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-500">
              {gat('widgets_row_span')}
              <input
                type="number"
                min={1}
                max={6}
                value={cfg.rowSpan}
                disabled={saving}
                onChange={(e) => setNumericSpan(cfg.widget_key, 'rowSpan', e.target.value)}
                className="ml-1 w-14 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
            </label>
          </div>
        ))}
    </div>
  );

  return (
    <>
      {/* ── 인라인 요약 뷰 (모달 닫힌 상태) ── */}
      <div className="space-y-4">
        <div>
          <h2 className="mb-1 text-xl font-semibold text-slate-800">{gat('widgets_panel_title')}</h2>
          <p className="text-sm text-slate-500">{gat('widgets_panel_hint')}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">{ct('loading')}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleOpenEditor}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
            >
              {gat('widgets_edit_start')}
            </button>

            {/* 현재 레이아웃 미리보기 (모달 닫혔을 때만, 읽기 전용) */}
            {!isEditorOpen && (
              <WidgetLayoutEditor {...editorProps} editMode={false} />
            )}
          </>
        )}
      </div>

      {/* ── 전체화면 편집 모달 ──
           createPortal로 document.body에 직접 마운트:
           glass-panel의 backdrop-filter가 fixed 좌표계를 깨는 문제를 근본 해결 */}
      {isEditorOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-white overflow-hidden">
          {/* 모달 헤더 */}
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <h2 className="min-w-0 flex-1 truncate text-base font-bold text-slate-800">
              {gat('widgets_panel_title')}
            </h2>
            <button
              type="button"
              onClick={() => setShowAdvancedLayout((v) => !v)}
              className="rounded-lg border border-dashed border-slate-400 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {gat('widgets_advanced_layout')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {ct('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? ct('loading') : ct('save')}
            </button>
          </div>

          {/* 모달 본문 — 드래그 중에는 overflow-hidden으로 스크롤 위치 고정
               touch-none은 제거: 전체 영역에 적용 시 복구 버튼 등 터치 이벤트도 차단됨.
               DnD 핸들 자체에 touch-none이 있어 드래그는 정상 동작. */}
          <div className={`flex-1 p-4 space-y-4 ${isDragging ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <WidgetLayoutEditor {...editorProps} />
            {advancedPanel}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
