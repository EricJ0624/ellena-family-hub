'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ClipboardList,
  Calendar,
  MessageCircle,
  MapPin,
  ImageIcon,
  Plane,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardWidgetKey, WidgetConfigDraft } from '@/lib/widgets/types';
import { resolveWidgetGridPlacement } from '@/lib/widgets/grid';
import { BASE_COLS, toActualColSpan, packLayoutsFromOrder } from '@/lib/widgets/layout-presets';
import type { GroupAdminTranslations } from '@/lib/translations/groupAdmin';

// ─── 위젯별 시각 메타 ────────────────────────────────────────────────────────

interface WidgetCardMeta {
  icon: LucideIcon | null;
  emoji?: string;
  /** Tailwind bg 클래스 */
  bg: string;
  /** Tailwind text 클래스 */
  fg: string;
}

const WIDGET_CARD_META: Record<DashboardWidgetKey, WidgetCardMeta> = {
  tasks:    { icon: ClipboardList,  bg: 'bg-green-900',   fg: 'text-green-100' },
  calendar: { icon: Calendar,       bg: 'bg-violet-500',  fg: 'text-white' },
  chat:     { icon: MessageCircle,  bg: 'bg-blue-500',    fg: 'text-white' },
  location: { icon: MapPin,         bg: 'bg-emerald-500', fg: 'text-white' },
  album:    { icon: ImageIcon,      bg: 'bg-pink-500',    fg: 'text-white' },
  travel:   { icon: Plane,          bg: 'bg-sky-500',     fg: 'text-white' },
  piggy:    { icon: null, emoji: '🐷', bg: 'bg-red-500',  fg: 'text-white' },
};

// ─── 위젯별 디자인 스켈레톤 (실제 데이터 없이 위젯 시각 구조만 표현) ─────────

const WIDGET_SKELETONS: Record<DashboardWidgetKey, () => React.ReactNode> = {
  tasks: () => (
    <div className="flex-1 bg-green-900 p-3 space-y-2.5 overflow-hidden min-h-0">
      {(['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2'] as const).map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-4 w-4 shrink-0 rounded border border-green-500/50 ${i === 1 ? 'bg-green-500/40' : ''}`} />
          <div className={`h-2 ${w} rounded-full bg-green-600/40`} />
        </div>
      ))}
    </div>
  ),
  calendar: () => (
    <div className="flex-1 p-2 overflow-hidden min-h-0">
      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[8px] font-semibold text-violet-400">{d}</div>
        ))}
      </div>
      <div className="space-y-0.5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-7 gap-0.5">
            {[0, 1, 2, 3, 4, 5, 6].map((col) => (
              <div
                key={col}
                className={`h-4 rounded-sm ${row === 1 && col === 3 ? 'bg-violet-500' : 'bg-slate-100'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  ),
  chat: () => (
    <div className="flex-1 p-2.5 space-y-2 overflow-hidden min-h-0 bg-slate-50">
      <div className="flex gap-2 items-end">
        <div className="h-6 w-6 shrink-0 rounded-full bg-blue-200" />
        <div className="h-8 w-3/5 rounded-2xl rounded-bl-none bg-slate-200" />
      </div>
      <div className="flex gap-2 items-end justify-end">
        <div className="h-8 w-2/5 rounded-2xl rounded-br-none bg-blue-100" />
        <div className="h-6 w-6 shrink-0 rounded-full bg-blue-200" />
      </div>
      <div className="flex gap-2 items-end">
        <div className="h-6 w-6 shrink-0 rounded-full bg-blue-200" />
        <div className="h-6 w-1/2 rounded-2xl rounded-bl-none bg-slate-200" />
      </div>
    </div>
  ),
  location: () => (
    <div className="flex-1 bg-emerald-50 overflow-hidden min-h-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 opacity-60">
        <span className="text-4xl">🗺️</span>
        <div className="flex gap-1.5">
          <div className="h-1.5 w-10 rounded-full bg-emerald-300" />
          <div className="h-1.5 w-6 rounded-full bg-emerald-200" />
        </div>
      </div>
    </div>
  ),
  album: () => (
    <div className="flex-1 p-2 grid grid-cols-2 gap-1.5 overflow-hidden min-h-0">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg bg-pink-100 flex items-center justify-center min-h-[2.5rem]">
          <span className="text-lg opacity-50">🖼️</span>
        </div>
      ))}
    </div>
  ),
  travel: () => (
    <div className="flex-1 p-2.5 space-y-2 overflow-hidden min-h-0">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border border-sky-200 bg-sky-50 p-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">✈️</span>
            <div className="h-2.5 w-3/5 rounded-full bg-sky-200" />
          </div>
          <div className="h-1.5 w-2/5 rounded-full bg-sky-100" />
        </div>
      ))}
    </div>
  ),
  piggy: () => (
    <div className="flex-1 p-3 overflow-hidden min-h-0">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">🐷</span>
        <div className="space-y-1 flex-1">
          <div className="h-2.5 w-3/5 rounded-full bg-red-200" />
          <div className="h-4 w-4/5 rounded bg-red-200/60" />
        </div>
      </div>
      <div className="space-y-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1.5">
            <div className="h-5 w-5 rounded-full bg-red-200 shrink-0" />
            <div className="h-2 flex-1 rounded-full bg-red-200/60" />
            <div className="h-2 w-10 rounded-full bg-red-300/60 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  ),
};

// ─── types ───────────────────────────────────────────────────────────────────

type PreviewCols = 2 | 4;

interface LiveResize {
  key: DashboardWidgetKey;
  axis: 'h' | 'v';
  startPx: number;
  startValue: number;
  currentW: number;
  currentH: number;
}

// ─── SortableCard ─────────────────────────────────────────────────────────────

interface SortableCardProps {
  cfg: WidgetConfigDraft;
  label: string;
  previewCols: PreviewCols;
  editMode: boolean;
  saving: boolean;
  liveW: number | null;
  liveH: number | null;
  restoreLabel: string;
  onToggle: () => void;
  onRestoreOne: () => void;
  onResizeHStart: (e: React.PointerEvent) => void;
  onResizeVStart: (e: React.PointerEvent) => void;
}

function SortableCard({
  cfg,
  label,
  previewCols,
  editMode,
  saving,
  liveW,
  liveH,
  restoreLabel,
  onToggle,
  onRestoreOne,
  onResizeHStart,
  onResizeVStart,
}: SortableCardProps) {
  const displayCfg = useMemo(
    () => ({ ...cfg, layoutW: liveW ?? cfg.layoutW, layoutH: liveH ?? cfg.layoutH }),
    [cfg, liveW, liveH],
  );
  const { colSpan, rowSpan } = resolveWidgetGridPlacement(displayCfg, previewCols);
  const meta = WIDGET_CARD_META[cfg.widget_key];
  const Icon = meta.icon;
  const SkeletonContent = WIDGET_SKELETONS[cfg.widget_key];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cfg.widget_key,
    disabled: !editMode,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'relative rounded-xl border overflow-hidden flex flex-col',
        isDragging
          ? 'z-10 border-blue-400 opacity-70 shadow-xl'
          : 'border-slate-200 shadow-sm',
        !cfg.is_enabled ? 'opacity-40' : '',
      ].join(' ')}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${Math.max(1, rowSpan)}`,
      }}
    >
      {/* 색상 아이콘 배너 — 드래그 핸들 겸용 */}
      <div
        {...(editMode ? { ...listeners, ...attributes } : {})}
        className={[
          'flex shrink-0 items-center gap-2 px-3 py-2 select-none',
          meta.bg, meta.fg,
          editMode ? 'cursor-grab active:cursor-grabbing' : '',
        ].join(' ')}
      >
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden="true" />
        ) : meta.emoji ? (
          <span className="text-base leading-none">{meta.emoji}</span>
        ) : null}

        <span className="min-w-0 flex-1 truncate text-xs font-bold tracking-wide">
          {label}
        </span>

        <span className="shrink-0 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
          {colSpan}×{rowSpan}
        </span>

        {editMode && (
          <svg
            className="h-3.5 w-3.5 shrink-0 opacity-60"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="3.5" cy="2.5" r="1.2" />
            <circle cx="3.5" cy="6" r="1.2" />
            <circle cx="3.5" cy="9.5" r="1.2" />
            <circle cx="8.5" cy="2.5" r="1.2" />
            <circle cx="8.5" cy="6" r="1.2" />
            <circle cx="8.5" cy="9.5" r="1.2" />
          </svg>
        )}
      </div>

      {/* 위젯 디자인 스켈레톤 — 실제 대시보드 시각 구조 표현 */}
      {SkeletonContent()}

      {/* 편집 모드 컨트롤 오버레이 — 하단 고정 (리사이즈 핸들 위) */}
      {editMode && (
        <div className="absolute bottom-5 inset-x-5 flex items-center gap-2 rounded-lg bg-white/92 px-2.5 py-1.5 shadow-md border border-slate-200/80 backdrop-blur-sm">
          <input
            type="checkbox"
            checked={cfg.is_enabled}
            onChange={onToggle}
            disabled={saving}
            className="shrink-0 h-3.5 w-3.5 cursor-pointer"
          />
          <span className="text-[11px] font-medium text-slate-600">
            {cfg.is_enabled ? 'ON' : 'OFF'}
          </span>
          <button
            type="button"
            title={restoreLabel}
            onClick={onRestoreOne}
            disabled={saving}
            className="ml-auto rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700 disabled:opacity-40 transition-colors"
          >
            ↩
          </button>
        </div>
      )}

      {/* 너비 리사이즈 핸들 — 오른쪽 (20px 터치 영역) */}
      {editMode && (
        <div
          className="absolute right-0 top-0 h-full w-5 cursor-ew-resize rounded-r-xl bg-blue-400/20 hover:bg-blue-500/40 active:bg-blue-600/50 transition-colors flex items-center justify-center"
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeHStart(e);
          }}
        >
          <div className="h-8 w-0.5 rounded-full bg-blue-400/60" />
        </div>
      )}

      {/* 높이 리사이즈 핸들 — 아래쪽 (20px 터치 영역) */}
      {editMode && (
        <div
          className="absolute bottom-0 left-0 h-5 w-full cursor-ns-resize rounded-b-xl bg-blue-400/20 hover:bg-blue-500/40 active:bg-blue-600/50 transition-colors flex items-center justify-center"
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeVStart(e);
          }}
        >
          <div className="h-0.5 w-8 rounded-full bg-blue-400/60" />
        </div>
      )}
    </div>
  );
}

// ─── WidgetLayoutEditor ───────────────────────────────────────────────────────

export interface WidgetLayoutEditorProps {
  drafts: WidgetConfigDraft[];
  editMode: boolean;
  saving: boolean;
  widgetLabels: Record<DashboardWidgetKey, string>;
  t: Pick<
    GroupAdminTranslations,
    | 'widgets_restore_defaults'
    | 'widgets_restore_all'
    | 'widgets_layout_edit_hint'
    | 'widgets_preview_portrait'
    | 'widgets_preview_landscape'
    | 'widgets_disabled_section'
  >;
  onDraftsChange: (d: WidgetConfigDraft[]) => void;
  onToggle: (key: DashboardWidgetKey) => void;
  onRestoreOne: (key: DashboardWidgetKey) => void;
  onRestoreAll: () => void;
}

export function WidgetLayoutEditor({
  drafts,
  editMode,
  saving,
  widgetLabels,
  t,
  onDraftsChange,
  onToggle,
  onRestoreOne,
  onRestoreAll,
}: WidgetLayoutEditorProps) {
  const [previewCols, setPreviewCols] = useState<PreviewCols>(2);
  const [liveResize, setLiveResize] = useState<LiveResize | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in pointer event handlers
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const liveResizeRef = useRef(liveResize);
  liveResizeRef.current = liveResize;
  const previewColsRef = useRef(previewCols);
  previewColsRef.current = previewCols;
  const onDraftsChangeRef = useRef(onDraftsChange);
  onDraftsChangeRef.current = onDraftsChange;

  const sortedEnabled = useMemo(
    () =>
      [...drafts].filter((d) => d.is_enabled).sort((a, b) => a.display_order - b.display_order),
    [drafts],
  );
  const sortedDisabled = useMemo(
    () =>
      [...drafts].filter((d) => !d.is_enabled).sort((a, b) => a.display_order - b.display_order),
    [drafts],
  );
  const sortedIds = useMemo(() => sortedEnabled.map((d) => d.widget_key), [sortedEnabled]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedEnabled.findIndex((d) => d.widget_key === active.id);
      const newIndex = sortedEnabled.findIndex((d) => d.widget_key === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortedEnabled, oldIndex, newIndex);
      const orderMap = new Map(reordered.map((d, i) => [d.widget_key, (i + 1) * 10]));

      const updated = drafts.map((d) =>
        orderMap.has(d.widget_key) ? { ...d, display_order: orderMap.get(d.widget_key)! } : d,
      );
      const packed = packLayoutsFromOrder(updated);
      const final = updated.map((d) => {
        const coords = packed.get(d.widget_key);
        if (!coords) return d;
        return { ...d, layoutX: coords.layoutX, layoutY: coords.layoutY };
      });

      onDraftsChange(final);
    },
    [sortedEnabled, drafts, onDraftsChange],
  );

  // Pointer-based resize — attach handlers to document while active
  useEffect(() => {
    if (!liveResize) return;

    const handleMove = (e: PointerEvent) => {
      const rs = liveResizeRef.current;
      if (!rs) return;
      const cols = previewColsRef.current;
      const containerWidth = gridRef.current?.getBoundingClientRect().width ?? 0;

      if (rs.axis === 'h' && containerWidth > 0) {
        const colPx = containerWidth / cols;
        const snapUnit = BASE_COLS / cols;
        const rawW = rs.startValue + ((e.clientX - rs.startPx) / colPx) * snapUnit;
        const snapped = Math.round(rawW / snapUnit) * snapUnit;
        const newW = Math.min(BASE_COLS, Math.max(snapUnit, snapped));
        setLiveResize((prev) => (prev ? { ...prev, currentW: newW } : null));
      } else if (rs.axis === 'v') {
        const rowPx = 80;
        const newH = Math.min(12, Math.max(1, Math.round(rs.startValue + (e.clientY - rs.startPx) / rowPx)));
        setLiveResize((prev) => (prev ? { ...prev, currentH: newH } : null));
      }
    };

    const handleUp = () => {
      const rs = liveResizeRef.current;
      if (!rs) return;
      const allDrafts = draftsRef.current;
      const cols = previewColsRef.current;

      const updated = allDrafts.map((d) => {
        if (d.widget_key !== rs.key) return d;
        const newW = rs.axis === 'h' ? rs.currentW : (d.layoutW ?? (d.colSpan * BASE_COLS) / cols);
        const newH = rs.axis === 'v' ? rs.currentH : (d.layoutH ?? d.rowSpan);
        return {
          ...d,
          layoutW: newW,
          layoutH: newH,
          colSpan: toActualColSpan(newW, cols),
          rowSpan: Math.min(6, Math.max(1, Math.round(newH))),
        };
      });

      const packed = packLayoutsFromOrder(updated);
      const final = updated.map((d) => {
        const coords = packed.get(d.widget_key);
        if (!coords) return d;
        return { ...d, layoutX: coords.layoutX, layoutY: coords.layoutY };
      });

      onDraftsChangeRef.current(final);
      setLiveResize(null);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [liveResize]);

  const getLiveOverride = useCallback(
    (key: DashboardWidgetKey) => {
      if (!liveResize || liveResize.key !== key) return { liveW: null, liveH: null };
      return {
        liveW: liveResize.axis === 'h' ? liveResize.currentW : null,
        liveH: liveResize.axis === 'v' ? liveResize.currentH : null,
      };
    },
    [liveResize],
  );

  return (
    <div className="space-y-4">
      {/* Toolbar: orientation toggle + restore-all */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPreviewCols(2)}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            previewCols === 2
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
          ].join(' ')}
        >
          {t.widgets_preview_portrait}
        </button>
        <button
          type="button"
          onClick={() => setPreviewCols(4)}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            previewCols === 4
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
          ].join(' ')}
        >
          {t.widgets_preview_landscape}
        </button>
        {editMode && (
          <button
            type="button"
            onClick={onRestoreAll}
            disabled={saving}
            className="ml-auto rounded-lg border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {t.widgets_restore_all}
          </button>
        )}
      </div>

      {editMode && (
        <p className="text-[11px] text-slate-400">{t.widgets_layout_edit_hint}</p>
      )}

      {/* Sortable DnD grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
          <div
            ref={gridRef}
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${previewCols}, minmax(0, 1fr))`,
              gridAutoRows: '10rem',
            }}
          >
            {sortedEnabled.map((cfg) => {
              const { liveW, liveH } = getLiveOverride(cfg.widget_key);
              return (
                <SortableCard
                  key={cfg.widget_key}
                  cfg={cfg}
                  label={widgetLabels[cfg.widget_key]}
                  previewCols={previewCols}
                  editMode={editMode}
                  saving={saving}
                  liveW={liveW}
                  liveH={liveH}
                  restoreLabel={t.widgets_restore_defaults}
                  onToggle={() => onToggle(cfg.widget_key)}
                  onRestoreOne={() => onRestoreOne(cfg.widget_key)}
                  onResizeHStart={(e) => {
                    const startW = cfg.layoutW ?? (cfg.colSpan * BASE_COLS) / previewCols;
                    setLiveResize({
                      key: cfg.widget_key,
                      axis: 'h',
                      startPx: e.clientX,
                      startValue: startW,
                      currentW: startW,
                      currentH: cfg.layoutH ?? cfg.rowSpan,
                    });
                  }}
                  onResizeVStart={(e) => {
                    const startH = cfg.layoutH ?? cfg.rowSpan;
                    setLiveResize({
                      key: cfg.widget_key,
                      axis: 'v',
                      startPx: e.clientY,
                      startValue: startH,
                      currentW: cfg.layoutW ?? (cfg.colSpan * BASE_COLS) / previewCols,
                      currentH: startH,
                    });
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Disabled widgets */}
      {sortedDisabled.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">{t.widgets_disabled_section}</p>
          <div className="flex flex-wrap gap-2">
            {sortedDisabled.map((cfg) => (
              <div
                key={cfg.widget_key}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => onToggle(cfg.widget_key)}
                  disabled={!editMode || saving}
                  className="cursor-pointer"
                />
                <span>{widgetLabels[cfg.widget_key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
