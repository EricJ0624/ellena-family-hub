'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
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
import { WIDGET_PREVIEW_MAP } from './WidgetPreviewComponents';

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


// ─── types ───────────────────────────────────────────────────────────────────

/** 1 = 모바일 세로(<640px), 2 = 태블릿/가로, 4 = 데스크톱 */
type PreviewCols = 1 | 2 | 4;

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
  const { colSpan, rowSpan, gridColumnStart } = resolveWidgetGridPlacement(displayCfg, previewCols);
  const meta = WIDGET_CARD_META[cfg.widget_key];
  const Icon = meta.icon;
  const PreviewContent = WIDGET_PREVIEW_MAP[cfg.widget_key];

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
        // 편집 모드: gridColumnStart 제거 → @dnd-kit이 DOM 순서 기반 재정렬 가능
        // (gridColumnStart가 있으면 드래그해도 카드가 열에 고정되어 DnD가 무력화됨)
        // 읽기 전용: layoutX 기반 gridColumnStart 적용해 실제 대시보드 레이아웃 표현
        gridColumn: (!editMode && gridColumnStart)
          ? `${gridColumnStart} / span ${colSpan}`
          : `span ${colSpan}`,
        gridRow: `span ${Math.max(1, rowSpan)}`,
      }}
    >
      {/* 색상 아이콘 배너 — 드래그 핸들 겸용 */}
      <div
        {...(editMode ? { ...listeners, ...attributes } : {})}
        className={[
          'flex shrink-0 items-center gap-2 px-3 py-2 select-none touch-none',
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

      {/* 위젯 미리보기 — 실제 CSS 클래스 사용으로 대시보드와 동일한 외관 (pointer 이벤트 차단) */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden pointer-events-none">
        {PreviewContent()}
      </div>

      {/* 편집 모드 컨트롤 오버레이 — 하단 고정 (리사이즈 핸들 위, z-20) */}
      {editMode && (
        <div className="absolute bottom-5 inset-x-5 z-20 flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 shadow-md border border-slate-200/80 backdrop-blur-sm">
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

      {/* 너비 리사이즈 핸들 — 오른쪽 (1열 모드에서는 가로 리사이즈 의미 없어 숨김) */}
      {editMode && previewCols > 1 && (
        <div
          className="absolute right-0 top-0 z-30 h-full w-5 cursor-ew-resize touch-none rounded-r-xl bg-blue-400/20 hover:bg-blue-500/40 active:bg-blue-600/50 transition-colors flex items-center justify-center"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            e.stopPropagation();
            onResizeHStart(e);
          }}
        >
          <div className="h-8 w-0.5 rounded-full bg-blue-400/60" />
        </div>
      )}

      {/* 높이 리사이즈 핸들 — 아래쪽 (20px 터치 영역, z-10) */}
      {editMode && (
        <div
          className="absolute bottom-0 left-0 z-30 h-5 w-full cursor-ns-resize touch-none rounded-b-xl bg-blue-400/20 hover:bg-blue-500/40 active:bg-blue-600/50 transition-colors flex items-center justify-center"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
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
  /** 드래그 시작(true)/종료(false) 시 호출 — 부모 스크롤 컨테이너 잠금용 */
  onDragStateChange?: (active: boolean) => void;
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
  onDragStateChange,
}: WidgetLayoutEditorProps) {
  const [previewCols, setPreviewCols] = useState<PreviewCols>(1);
  const [liveResize, setLiveResize] = useState<LiveResize | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in pointer event handlers
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  // liveResizeRef: beginResize 내부에서 직접 관리 (state와 별도)
  const liveResizeRef = useRef<LiveResize | null>(null);
  const previewColsRef = useRef(previewCols);
  previewColsRef.current = previewCols;
  const onDraftsChangeRef = useRef(onDraftsChange);
  onDraftsChangeRef.current = onDraftsChange;
  // 컴포넌트 언마운트 시 남은 document 리스너 정리용
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
    // PointerSensor: 마우스·터치·펜 모두 통합 처리. distance:8은 즉시 반응(delay 없음)
    // touch-none이 modal body에 적용돼 있어 스크롤 충돌 없음
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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

  // beginResize: onPointerDown에서 즉시 document 리스너 등록 (useEffect 비동기 지연 없음)
  // 터치 기기에서 첫 pointermove를 놓치지 않음
  const beginResize = useCallback((init: LiveResize) => {
    liveResizeRef.current = init;
    setLiveResize(init);

    const onMove = (e: PointerEvent) => {
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
        const next = { ...rs, currentW: newW };
        liveResizeRef.current = next;
        setLiveResize(next);
      } else if (rs.axis === 'v') {
        const rowPx = 80;
        const newH = Math.min(12, Math.max(1, Math.round(rs.startValue + (e.clientY - rs.startPx) / rowPx)));
        const next = { ...rs, currentH: newH };
        liveResizeRef.current = next;
        setLiveResize(next);
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      resizeCleanupRef.current = null;

      const rs = liveResizeRef.current;
      liveResizeRef.current = null;
      setLiveResize(null);
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
    };

    // 즉시 등록 — 터치/마우스 첫 이벤트를 절대 놓치지 않음
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    resizeCleanupRef.current = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

  // 컴포넌트 언마운트 시 혹시 남은 document 리스너 정리
  useEffect(() => {
    return () => { resizeCleanupRef.current?.(); };
  }, []);

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
        {/* 세로=1열(실제 모바일), 가로=2열(태블릿), 와이드=4열(데스크톱) */}
        <button
          type="button"
          onClick={() => setPreviewCols(1)}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            previewCols === 1
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
          ].join(' ')}
        >
          {t.widgets_preview_portrait}
        </button>
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
          {t.widgets_preview_landscape}
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
          {'Wide'}
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => onDragStateChange?.(true)}
        onDragEnd={(e) => { handleDragEnd(e); onDragStateChange?.(false); }}
        onDragCancel={() => onDragStateChange?.(false)}
      >
        {/* 1열(모바일 세로)에서는 verticalListSortingStrategy가 가변 높이 아이템에 더 정확 */}
        <SortableContext
          items={sortedIds}
          strategy={previewCols === 1 ? verticalListSortingStrategy : rectSortingStrategy}
        >
          <div
            ref={gridRef}
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${previewCols}, minmax(0, 1fr))`,
              gridAutoRows: 'minmax(10rem, auto)',
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
                    beginResize({
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
                    beginResize({
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
