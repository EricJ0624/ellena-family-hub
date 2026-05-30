'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
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
import { resolveWidgetGridPlacement, PORTRAIT_COLS, LANDSCAPE_COLS } from '@/lib/widgets/grid';
import { BASE_COLS, toActualColSpan, packOrientationLayouts } from '@/lib/widgets/layout-presets';

/** previewMode 별 내부 CSS 그리드 기준 열 수 (BASE_COLS 단위) */
const PREVIEW_MODE_BASE_COLS: Record<0 | 1 | 2, number> = {
  0: PORTRAIT_COLS,   // 세로 12열 grid 기준
  1: LANDSCAPE_COLS,  // 가로 24열 grid 기준
  2: LANDSCAPE_COLS,  // PC 24열 grid 기준
};
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

/** 2 = 모바일 세로(2열), 4 = 가로/PC(4열) — CSS 그리드 열 수(시각적 열 수) */
type PreviewCols = 2 | 4;
/** 0=세로(2열), 1=가로(4열), 2=PC(4열) — 가로/PC는 동일 열 수지만 버튼 구분용 */
type PreviewMode = 0 | 1 | 2;
const PREVIEW_MODE_COLS: Record<PreviewMode, PreviewCols> = { 0: 2, 1: 4, 2: 4 };

type EditorOrientation = 'portrait' | 'landscape';

/**
 * Phase D: orientation별 유효 layout 값을 가져오는 순수 헬퍼.
 * portrait 편집 → layoutPortrait*, landscape 편집 → layoutLandscape* 우선 사용.
 */
function getOrientationLayout(
  cfg: WidgetConfigDraft,
  orientation: EditorOrientation,
): { layoutW: number | null; layoutH: number | null; layoutX: number | null; layoutY: number | null } {
  if (orientation === 'portrait') {
    return {
      layoutW: cfg.layoutPortraitW ?? cfg.layoutW,
      layoutH: cfg.layoutPortraitH ?? cfg.layoutH,
      layoutX: cfg.layoutPortraitX ?? cfg.layoutX,
      layoutY: cfg.layoutPortraitY ?? cfg.layoutY,
    };
  }
  return {
    layoutW: cfg.layoutLandscapeW ?? cfg.layoutW,
    layoutH: cfg.layoutLandscapeH ?? cfg.layoutH,
    layoutX: cfg.layoutLandscapeX ?? cfg.layoutX,
    layoutY: cfg.layoutLandscapeY ?? cfg.layoutY,
  };
}

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
  /** 가로(landscape) 탭 여부 — resolveWidgetGridPlacement에 전달해 portrait/landscape 값을 올바르게 선택 */
  isLandscape: boolean;
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
  isLandscape,
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
  // isLandscape 전달 — 없으면 portrait 경로(layoutPortraitW)를 사용해 세로 편집이 가로에도 반영되는 버그 발생
  const { colSpan, rowSpan, gridColumnStart, gridRowStart } = resolveWidgetGridPlacement(displayCfg, previewCols, isLandscape);
  const meta = WIDGET_CARD_META[cfg.widget_key];
  const Icon = meta.icon;
  const PreviewContent = WIDGET_PREVIEW_MAP[cfg.widget_key];

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
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
        // 편집 모드: gridColumnStart/gridRowStart 제거 → @dnd-kit이 DOM 순서 기반 재정렬 가능
        // (명시적 grid 위치가 있으면 드래그해도 카드가 셀에 고정되어 DnD가 무력화됨)
        // 읽기 전용: layoutX/Y 기반 explicit 배치로 실제 대시보드 레이아웃 표현
        gridColumn: (!editMode && gridColumnStart)
          ? `${gridColumnStart} / span ${colSpan}`
          : `span ${colSpan}`,
        gridRow: (!editMode && gridRowStart)
          ? `${gridRowStart} / span ${Math.max(1, rowSpan)}`
          : `span ${Math.max(1, rowSpan)}`,
      }}
    >
      {/* 색상 아이콘 배너 — 드래그 핸들 겸용
           setActivatorNodeRef: @dnd-kit이 이 요소를 정식 드래그 핸들로 인식하도록 등록 */}
      <div
        ref={editMode ? setActivatorNodeRef : undefined}
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
      {editMode && (
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
    | 'widgets_preview_desktop'
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
  const [previewMode, setPreviewMode] = useState<PreviewMode>(0);
  const previewCols: PreviewCols = PREVIEW_MODE_COLS[previewMode];
  // Phase D: orientation — portrait(0) / landscape(1,2)
  const orientation: EditorOrientation = previewMode === 0 ? 'portrait' : 'landscape';
  const [liveResize, setLiveResize] = useState<LiveResize | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Phase C: 그리드 컨테이너 실측 너비 (정사각형 셀 rowHeight 계산용)
  const [gridContainerWidth, setGridContainerWidth] = useState(0);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setGridContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setGridContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Refs to avoid stale closures in pointer event handlers
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  // liveResizeRef: beginResize 내부에서 직접 관리 (state와 별도)
  const liveResizeRef = useRef<LiveResize | null>(null);
  const previewColsRef = useRef(previewCols);
  previewColsRef.current = previewCols;
  const previewModeRef = useRef(previewMode);
  previewModeRef.current = previewMode;
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;
  const gridContainerWidthRef = useRef(gridContainerWidth);
  gridContainerWidthRef.current = gridContainerWidth;
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
    // PointerSensor: activationConstraint 없음 → pointermove 첫 이벤트에 즉시 드래그 시작
    // 배너가 전용 드래그 핸들이므로 즉시 반응이 가장 신뢰성 높음 (@dnd-kit 공식 예제 방식)
    useSensor(PointerSensor),
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

      const orient = orientationRef.current;
      const updated = drafts.map((d) =>
        orderMap.has(d.widget_key) ? { ...d, display_order: orderMap.get(d.widget_key)! } : d,
      );

      // Phase D: orientation별 독립 좌표 패킹
      const packed = packOrientationLayouts(updated, orient);
      const final = updated.map((d) => {
        const coords = packed.get(d.widget_key);
        if (!coords) return d;
        if (orient === 'portrait') {
          return { ...d, layoutPortraitX: coords.x, layoutPortraitY: coords.y };
        }
        return { ...d, layoutLandscapeX: coords.x, layoutLandscapeY: coords.y };
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
      const containerWidth = gridContainerWidthRef.current || (gridRef.current?.getBoundingClientRect().width ?? 0);
      const baseCols = PREVIEW_MODE_BASE_COLS[previewModeRef.current];

      if (rs.axis === 'h' && containerWidth > 0) {
        // Phase D fix: orientation별 baseCols 사용 (portrait=12, landscape=24)
        const colUnitPx = containerWidth / baseCols;
        const rawW = rs.startValue + (e.clientX - rs.startPx) / colUnitPx;
        const newW = Math.min(baseCols, Math.max(0.5, rawW));
        const next = { ...rs, currentW: newW };
        liveResizeRef.current = next;
        setLiveResize(next);
      } else if (rs.axis === 'v' && containerWidth > 0) {
        // 정사각형 셀 높이 (containerWidth / baseCols), 소수점 단위
        const rowPx = containerWidth / baseCols;
        const maxRows = baseCols === PORTRAIT_COLS ? 24 : 12;
        const rawH = rs.startValue + (e.clientY - rs.startPx) / rowPx;
        const newH = Math.min(maxRows, Math.max(0.5, rawH));
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
      const orient = orientationRef.current;
      const baseCols = PREVIEW_MODE_BASE_COLS[previewModeRef.current];
      const maxRows = baseCols === PORTRAIT_COLS ? 24 : 12;

      const updated = allDrafts.map((d) => {
        if (d.widget_key !== rs.key) return d;
        // Phase D: orientation별 현재 유효값을 startValue로 사용
        const effLayout = getOrientationLayout(d, orient);
        const newW = rs.axis === 'h'
          ? rs.currentW
          : (effLayout.layoutW ?? (d.colSpan * baseCols) / cols);
        const newH = rs.axis === 'v'
          ? rs.currentH
          : (effLayout.layoutH ?? d.rowSpan);

        if (orient === 'portrait') {
          return {
            ...d,
            layoutPortraitW: newW,
            layoutPortraitH: newH,
            // colSpan/rowSpan(CSS 폴백) — portrait 기준으로만 업데이트
            colSpan: toActualColSpan(newW, cols),
            rowSpan: Math.min(maxRows, Math.max(1, Math.round(newH))),
          };
        }
        return {
          ...d,
          layoutLandscapeW: newW,
          layoutLandscapeH: newH,
          // landscape 편집 시 colSpan/rowSpan은 portrait 기준 유지 (변경 없음)
        };
      });

      // Phase D: orientation별 독립 좌표 패킹
      const packed = packOrientationLayouts(updated, orient);
      const final = updated.map((d) => {
        const coords = packed.get(d.widget_key);
        if (!coords) return d;
        if (orient === 'portrait') {
          return { ...d, layoutPortraitX: coords.x, layoutPortraitY: coords.y };
        }
        return { ...d, layoutLandscapeX: coords.x, layoutLandscapeY: coords.y };
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
        {/* 세로=2열(모바일 세로), 가로=4열(모바일 가로), PC=4열(데스크톱) */}
        {([0, 1, 2] as PreviewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPreviewMode(mode)}
            className={[
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              previewMode === mode
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {mode === 0
              ? t.widgets_preview_portrait
              : mode === 1
                ? t.widgets_preview_landscape
                : t.widgets_preview_desktop}
          </button>
        ))}
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
        onDragEnd={(e) => {
          // try-finally: handleDragEnd 에러 시에도 isDragging 해제 보장
          // isDragging stuck 시 모달 body가 touch-none이 되어 복구 버튼 등 모든 클릭이 차단됨
          try { handleDragEnd(e); } finally { onDragStateChange?.(false); }
        }}
        onDragCancel={() => onDragStateChange?.(false)}
      >
        {/* 2열/4열 모두 rectSortingStrategy 사용 */}
        <SortableContext
          items={sortedIds}
          strategy={rectSortingStrategy}
        >
          <div
            ref={gridRef}
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${previewCols}, minmax(0, 1fr))`,
              // Phase C: 정사각형 셀 — rowHeight = containerWidth / baseCols
              // portrait(12열): containerWidth/12, landscape(24열): containerWidth/24
              gridAutoRows: gridContainerWidth > 0
                ? `${gridContainerWidth / PREVIEW_MODE_BASE_COLS[previewMode]}px`
                : (previewMode === 0 ? '32px' : '16px'),
            }}
          >
            {sortedEnabled.map((cfg) => {
              const { liveW, liveH } = getLiveOverride(cfg.widget_key);
              // Phase D: orientation별 유효 layout 값을 layoutW/H/X/Y에 주입
              // SortableCard 내부는 항상 layoutW/H를 사용하므로 변경 없이 독립 편집 가능
              const effCfg = { ...cfg, ...getOrientationLayout(cfg, orientation) };
              const baseCols = PREVIEW_MODE_BASE_COLS[previewMode];
              return (
                <SortableCard
                  key={cfg.widget_key}
                  cfg={effCfg}
                  label={widgetLabels[cfg.widget_key]}
                  previewCols={previewCols}
                  isLandscape={orientation === 'landscape'}
                  editMode={editMode}
                  saving={saving}
                  liveW={liveW}
                  liveH={liveH}
                  restoreLabel={t.widgets_restore_defaults}
                  onToggle={() => onToggle(cfg.widget_key)}
                  onRestoreOne={() => onRestoreOne(cfg.widget_key)}
                  onResizeHStart={(e) => {
                    const startW = effCfg.layoutW ?? (cfg.colSpan * baseCols) / previewCols;
                    beginResize({
                      key: cfg.widget_key,
                      axis: 'h',
                      startPx: e.clientX,
                      startValue: startW,
                      currentW: startW,
                      currentH: effCfg.layoutH ?? cfg.rowSpan,
                    });
                  }}
                  onResizeVStart={(e) => {
                    const startH = effCfg.layoutH ?? cfg.rowSpan;
                    beginResize({
                      key: cfg.widget_key,
                      axis: 'v',
                      startPx: e.clientY,
                      startValue: startH,
                      currentW: effCfg.layoutW ?? (cfg.colSpan * baseCols) / previewCols,
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
