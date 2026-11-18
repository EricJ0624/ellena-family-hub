'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type {
  BabyPhoto,
  BabyPrintAlbum,
  BabyPrintPhotoEdit,
  BabyPrintPhotoSize,
} from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { exportPrintAlbumPdf, printPrintAlbum } from '../utils/export-print-album-pdf';
import { shareResult } from '@/lib/share/share-result';
import {
  FRAME_SCALE_MIN,
  FRAME_SCALE_X_MAX,
  FRAME_SCALE_Y_MAX,
  PRINT_PHOTO_SIZES,
  PRINT_PHOTO_SIZE_KEYS,
  chunkPhotos,
  pageSizeFor,
} from '../utils/print-frame-box';
import {
  PRINT_BG_CUTE_KEYS,
  PRINT_BG_PREMIUM_KEYS,
  PRINT_BG_RECIPES,
  isPrintBgKey,
  printBgPreviewStyle,
  printBgThumbStyle,
  type PrintBgGroup,
  type PrintBgKey,
} from '../utils/print-album-bg';

type DragZone = 'album' | 'pool';
type PrintDragData = { photoId: string; zone: DragZone };

/** 포인터 위치 우선 — hero처럼 큰 카드는 closestCenter만 쓰면 대기열에 안 닿음 */
const printCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const pool = pointerHits.find((c) => c.id === 'drop-pool');
    if (pool) return [pool];
    const poolThumb = pointerHits.find((c) => String(c.id).startsWith('pool-'));
    if (poolThumb) return [poolThumb];
    const photos = pointerHits.filter(
      (c) => c.id !== 'drop-album' && c.id !== 'drop-pool' && !String(c.id).startsWith('pool-'),
    );
    if (photos.length > 0) return photos;
    return pointerHits;
  }
  return closestCenter(args);
};

type PrintLayout = BabyPrintAlbum['layout'];
type PrintFrame = BabyPrintPhotoEdit['frame'];
type PhotoEdit = BabyPrintPhotoEdit;
type FlashTarget = 'family' | null;

function isPhotoSize(v: unknown): v is BabyPrintPhotoSize {
  return typeof v === 'string' && PRINT_PHOTO_SIZE_KEYS.includes(v as BabyPrintPhotoSize);
}

/** 각진 하트 — 적은 점의 polygon */
const HEART_ANGULAR_CLIP =
  'polygon(50% 100%, 12% 53.85%, 8% 23.08%, 22% 0%, 40% 2.56%, 50% 23.08%, 60% 2.56%, 78% 0%, 92% 23.08%, 88% 53.85%)';

/**
 * 부드러운 하트 — objectBoundingBox(0~1) cubic path.
 * CSS `path()`는 픽셀 좌표라 SVG clipPath를 쓴다.
 */
const HEART_SOFT_PATH =
  'M0.5 1 C0.5 1 0.02 0.614 0.02 0.318 C0.02 0.114 0.16 0 0.31 0 C0.4 0 0.46 0.057 0.5 0.136 C0.54 0.057 0.6 0 0.69 0 C0.84 0 0.98 0.114 0.98 0.318 C0.98 0.614 0.5 1 0.5 1 Z';

const FRAME_CLIP: Record<PrintFrame, string> = {
  rect: 'none',
  round: 'ellipse(50% 50% at 50% 50%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  heart: HEART_ANGULAR_CLIP,
  heart_soft: `url(#print-heart-soft-clip)`,
  hex: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
};

const FRAME_KEYS: PrintFrame[] = ['rect', 'round', 'diamond', 'heart', 'heart_soft', 'hex'];

function FrameShapeIcon({ frame, className }: { frame: PrintFrame; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className: className ?? 'h-4 w-4',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    'aria-hidden': true as const,
  };
  switch (frame) {
    case 'rect':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="1.5" />
        </svg>
      );
    case 'round':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z" />
        </svg>
      );
    case 'heart':
      // 각진 하트 — 직선 세그먼트
      return (
        <svg {...common}>
          <path d="M12 19.5 L4.5 12.2 L3.8 8.2 L7.2 4.8 L10.5 5.2 L12 8.2 L13.5 5.2 L16.8 4.8 L20.2 8.2 L19.5 12.2 Z" />
        </svg>
      );
    case 'heart_soft':
      // 부드러운 하트
      return (
        <svg {...common}>
          <path
            d="M12 20.2 C12 20.2 3.2 14.2 3.2 8.8 C3.2 5.9 5.4 4 7.9 4 C9.6 4 11 5 12 6.4 C13 5 14.4 4 16.1 4 C18.6 4 20.8 5.9 20.8 8.8 C20.8 14.2 12 20.2 12 20.2 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'hex':
      return (
        <svg {...common}>
          <path d="M12 3.2 L19.2 7.2 L19.2 16.8 L12 20.8 L4.8 16.8 L4.8 7.2 Z" />
        </svg>
      );
    default:
      return null;
  }
}

const ROTATE_STEP = 15;
/** 축소 하한 — 인물 맞춤(프레임보다 작게). 빈 칸은 같은 사진 블러로 채움 */
const ZOOM_MIN = 0.35;
/** cover(프레임 채움) 기준점 */
const ZOOM_COVER = 1;
/** 확대 상한 */
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.08;

function normDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function editZoom(edit: PhotoEdit): number {
  return clampNum(edit.zoom ?? 1, ZOOM_MIN, ZOOM_MAX);
}

function editFocusX(edit: PhotoEdit): number {
  return clampNum(edit.focusX ?? 50, 0, 100);
}

function editFocusY(edit: PhotoEdit): number {
  return clampNum(edit.focusY ?? 50, 0, 100);
}

function editFrameRotation(edit: PhotoEdit): number {
  return typeof edit.frameRotation === 'number' && Number.isFinite(edit.frameRotation)
    ? normDeg(edit.frameRotation)
    : 0;
}

function editFrameScaleX(edit: PhotoEdit): number {
  return clampNum(edit.frameScaleX ?? 1, FRAME_SCALE_MIN, FRAME_SCALE_X_MAX);
}

function editFrameScaleY(edit: PhotoEdit): number {
  return clampNum(edit.frameScaleY ?? 1, FRAME_SCALE_MIN, FRAME_SCALE_Y_MAX);
}

/** 프레임 마스크 — 사진은 움직이고 창(하트 등)은 고정 */
function frameMaskStyle(frame: PrintFrame): React.CSSProperties {
  const clip =
    frame === 'heart_soft' ? 'url(#print-heart-soft-clip)' : FRAME_CLIP[frame];
  return clip === 'none' ? {} : { clipPath: clip };
}

/**
 * zoom >= 1은 기존 min 크기 그대로.
 * zoom < 1은 그 배치를 유지한 채 scale만 줄인다.
 * min-width/min-height는 원본 픽셀보다 작게 만들지 못한다.
 */
function photoFitScale(zoom: number): { size: string; transform: string } {
  const layoutZoom = zoom < 1 ? 1 : zoom;
  return {
    size: `${layoutZoom * 100}%`,
    transform:
      zoom < 1 ? `translate(-50%, -50%) scale(${zoom})` : 'translate(-50%, -50%)',
  };
}

/**
 * 팬/줌 — zoom 1은 프레임 cover.
 * zoom이 1보다 작으면 cover보다 줄어 잘렸던 원본이 보이고, 빈 칸만 블러.
 */
function photoFitStyle(edit: PhotoEdit): React.CSSProperties {
  const zoom = editZoom(edit);
  const fx = editFocusX(edit);
  const fy = editFocusY(edit);
  const fit = photoFitScale(zoom);
  return {
    position: 'absolute',
    zIndex: 1,
    left: `${fx}%`,
    top: `${fy}%`,
    width: 'auto',
    height: 'auto',
    minWidth: fit.size,
    minHeight: fit.size,
    maxWidth: 'none',
    maxHeight: 'none',
    transform: fit.transform,
    willChange: 'left, top, min-width, min-height',
  };
}

/** 드롭 시 프레임 cover 기본 맞춤 */
function coverFitPatch(): Pick<PhotoEdit, 'zoom' | 'focusX' | 'focusY'> {
  return { zoom: ZOOM_COVER, focusX: 50, focusY: 50 };
}

function defaultEdit(): PhotoEdit {
  // 새 사진은 대기열 — 드래그로 인쇄 앨범에 넣음
  return {
    included: false,
    frame: 'rect',
    rotation: 0,
    frameRotation: 0,
    frameScaleX: 1,
    frameScaleY: 1,
    ...coverFitPatch(),
  };
}

function isIncluded(edits: Record<string, PhotoEdit>, id: string): boolean {
  return (edits[id] ?? defaultEdit()).included;
}

/** included 항목들만 상대 순서를 바꾼 뒤 전체 order에 반영 */
function reorderIncludedIds(
  order: string[],
  edits: Record<string, PhotoEdit>,
  activeId: string,
  overId: string,
): string[] {
  const included = order.filter((id) => isIncluded(edits, id));
  const oldIndex = included.indexOf(activeId);
  const newIndex = included.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return order;
  const nextIncluded = arrayMove(included, oldIndex, newIndex);
  let i = 0;
  return order.map((id) => (isIncluded(edits, id) ? nextIncluded[i++]! : id));
}

function placeIncludedBefore(
  order: string[],
  photoId: string,
  beforeId: string | null,
): string[] {
  const without = order.filter((id) => id !== photoId);
  if (!beforeId) return [...without, photoId];
  const idx = without.indexOf(beforeId);
  if (idx < 0) return [...without, photoId];
  return [...without.slice(0, idx), photoId, ...without.slice(idx)];
}

function parsePhotoEdit(raw: unknown): PhotoEdit {
  if (!raw || typeof raw !== 'object') return defaultEdit();
  const e = raw as Record<string, unknown>;
  const frame = FRAME_KEYS.includes(e.frame as PrintFrame) ? (e.frame as PrintFrame) : 'rect';
  const rotation =
    typeof e.rotation === 'number' && Number.isFinite(e.rotation) ? normDeg(e.rotation) : 0;
  const frameRotation =
    typeof e.frameRotation === 'number' && Number.isFinite(e.frameRotation)
      ? normDeg(e.frameRotation)
      : 0;
  const frameScaleX =
    typeof e.frameScaleX === 'number' && Number.isFinite(e.frameScaleX)
      ? clampNum(e.frameScaleX, FRAME_SCALE_MIN, FRAME_SCALE_X_MAX)
      : 1;
  const frameScaleY =
    typeof e.frameScaleY === 'number' && Number.isFinite(e.frameScaleY)
      ? clampNum(e.frameScaleY, FRAME_SCALE_MIN, FRAME_SCALE_Y_MAX)
      : 1;
  const zoom =
    typeof e.zoom === 'number' && Number.isFinite(e.zoom)
      ? clampNum(e.zoom, ZOOM_MIN, ZOOM_MAX)
      : 1;
  const focusX =
    typeof e.focusX === 'number' && Number.isFinite(e.focusX) ? clampNum(e.focusX, 0, 100) : 50;
  const focusY =
    typeof e.focusY === 'number' && Number.isFinite(e.focusY) ? clampNum(e.focusY, 0, 100) : 50;
  return {
    included: e.included !== false,
    frame,
    rotation,
    frameRotation,
    frameScaleX,
    frameScaleY,
    zoom,
    focusX,
    focusY,
  };
}

function photosKey(photos: BabyPhoto[]): string {
  return photos.map((p) => p.id).join('|');
}

function mergePhotoState(
  photos: BabyPhoto[],
  order: string[],
  edits: Record<string, PhotoEdit>,
): { order: string[]; edits: Record<string, PhotoEdit> } {
  const ids = new Set(photos.map((p) => p.id));
  const nextOrder = [
    ...order.filter((id) => ids.has(id)),
    ...photos.map((p) => p.id).filter((id) => !order.includes(id)),
  ];
  const nextEdits: Record<string, PhotoEdit> = {};
  for (const p of photos) {
    nextEdits[p.id] = edits[p.id] ?? defaultEdit();
  }
  return { order: nextOrder, edits: nextEdits };
}

type PrintItem = BabyPhoto & { edit: PhotoEdit };

function SoftHeartClipDefs() {
  return (
    <svg width={0} height={0} className="absolute" aria-hidden>
      <defs>
        <clipPath id="print-heart-soft-clip" clipPathUnits="objectBoundingBox">
          <path d={HEART_SOFT_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}

function FramedPhoto({
  photo,
  edit,
  selected,
  fill,
}: {
  photo: BabyPhoto;
  edit: PhotoEdit;
  selected?: boolean;
  /** 미리보기 그리드 셀을 채움 (aspect-square 대신) */
  fill?: boolean;
}) {
  const frameRot = editFrameRotation(edit);
  const scaleX = editFrameScaleX(edit);
  const scaleY = editFrameScaleY(edit);
  const zoom = editZoom(edit);
  const shrunk = zoom < 1;
  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${
        fill ? 'absolute inset-0' : 'relative aspect-square'
      }`}
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-white/70 shadow-sm ${
          edit.frame === 'rect' ? 'rounded-xl' : ''
        } ${selected ? 'ring-2 ring-inset ring-amber-500' : 'border border-white/80'}`}
        style={{
          width: `${scaleX * 100}%`,
          transform: `rotate(${frameRot}deg)`,
          ...frameMaskStyle(edit.frame),
        }}
      >
        <div style={{ paddingTop: `${(scaleY / Math.max(scaleX, 0.01)) * 100}%` }} />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ transform: `rotate(${edit.rotation}deg)` }}
        >
          {/* zoom 1 미만일 때만 여백 블러. PDF drawCover와 같게, 기본은 프레임을 채운다. */}
          {shrunk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.thumbnailUrl ?? photo.imageUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 h-full w-full max-w-none object-cover select-none"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={
                {
                  filter: 'blur(18px)',
                  transform: 'scale(1.2)',
                  WebkitUserDrag: 'none',
                  userSelect: 'none',
                } as React.CSSProperties
              }
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbnailUrl ?? photo.imageUrl}
            alt=""
            className="pointer-events-none select-none"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            style={
              (shrunk
                ? {
                    ...photoFitStyle(edit),
                    WebkitUserDrag: 'none',
                    userSelect: 'none',
                  }
                : {
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    maxWidth: 'none',
                    objectFit: 'cover',
                    objectPosition: `${editFocusX(edit)}% ${editFocusY(edit)}%`,
                    transform: zoom === 1 ? undefined : `scale(${zoom})`,
                    transformOrigin: `${editFocusX(edit)}% ${editFocusY(edit)}%`,
                    WebkitUserDrag: 'none',
                    userSelect: 'none',
                  }) as React.CSSProperties
            }
          />
        </div>
      </div>
    </div>
  );
}

/** 대기열 — 편집 프레임 없이 원본 썸네일만 */
function PlainPhotoThumb({
  photo,
  selected,
}: {
  photo: BabyPhoto;
  selected?: boolean;
}) {
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-xl bg-slate-100 shadow-sm ${
        selected ? 'ring-2 ring-amber-500' : 'border border-slate-200'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnailUrl ?? photo.imageUrl}
        alt=""
        className="pointer-events-none h-full w-full object-cover select-none"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{ WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties}
      />
    </div>
  );
}

function SortableAlbumThumb({
  photo,
  edit,
  selected,
  showCaption,
  caption,
  hero,
  frameEditMode,
  onSelect,
  onFitChange,
  onFrameSlot,
}: {
  photo: BabyPhoto;
  edit: PhotoEdit;
  selected: boolean;
  showCaption: boolean;
  caption: string | null;
  hero?: boolean;
  /** true: 팬/줌만 / false: DnD 정렬 */
  frameEditMode: boolean;
  onSelect: () => void;
  onFitChange: (patch: Partial<PhotoEdit>) => void;
  onFrameSlot?: (width: number, height: number) => void;
}) {
  const data: PrintDragData = { photoId: photo.id, zone: 'album' };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    data,
    disabled: frameEditMode,
  });

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panLast = useRef<{ x: number; y: number } | null>(null);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  /** 제스처 중 focus/zoom 즉시 누적 (리렌더 전 stale state 방지) */
  const liveFit = useRef({
    zoom: editZoom(edit),
    focusX: editFocusX(edit),
    focusY: editFocusY(edit),
  });

  useEffect(() => {
    const el = slotRef.current;
    if (!el || !selected || !onFrameSlot) return;
    const update = () => {
      onFrameSlot(el.clientWidth, el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selected, onFrameSlot]);

  useEffect(() => {
    if (pointers.current.size > 0) return;
    liveFit.current = {
      zoom: editZoom(edit),
      focusX: editFocusX(edit),
      focusY: editFocusY(edit),
    };
  }, [edit.zoom, edit.focusX, edit.focusY]);

  // 편집 모드에서만 휠 줌
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !frameEditMode) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -ZOOM_STEP * 2 : ZOOM_STEP * 2;
      liveFit.current.zoom = clampNum(liveFit.current.zoom + delta, ZOOM_MIN, ZOOM_MAX);
      onFitChange({ zoom: liveFit.current.zoom });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [frameEditMode, onFitChange]);

  const pointerDistance = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    const a = pts[0]!;
    const b = pts[1]!;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!frameEditMode) return;
    if (!selected) onSelect();
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      panLast.current = null;
      pinchStart.current = {
        dist: pointerDistance(),
        zoom: liveFit.current.zoom,
      };
    } else {
      pinchStart.current = null;
      panLast.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!frameEditMode || !pointers.current.has(e.pointerId)) return;
    e.preventDefault();
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const dist = pointerDistance();
      if (dist > 0 && pinchStart.current.dist > 0) {
        const ratio = dist / pinchStart.current.dist;
        liveFit.current.zoom = clampNum(
          pinchStart.current.zoom * ratio,
          ZOOM_MIN,
          ZOOM_MAX,
        );
        onFitChange({ zoom: liveFit.current.zoom });
      }
      return;
    }

    if (!panLast.current) return;
    const dx = e.clientX - panLast.current.x;
    const dy = e.clientY - panLast.current.y;
    panLast.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    // 손가락 따라 사진 박스 이동 (left/top %)
    liveFit.current.focusX = clampNum(
      liveFit.current.focusX + (dx / w) * 100,
      0,
      100,
    );
    liveFit.current.focusY = clampNum(
      liveFit.current.focusY + (dy / h) * 100,
      0,
      100,
    );
    onFitChange({
      focusX: liveFit.current.focusX,
      focusY: liveFit.current.focusY,
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!frameEditMode) return;
    pointers.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 1) {
      const only = [...pointers.current.values()][0]!;
      panLast.current = { x: only.x, y: only.y };
    } else {
      panLast.current = null;
    }
  };

  const blockNativeDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={`m-0 flex h-full min-h-0 min-w-0 flex-col gap-1 ${hero ? 'col-span-2' : ''}`}
    >
      <div ref={slotRef} className="relative min-h-0 flex-1">
        <div
          ref={surfaceRef}
          role="presentation"
          draggable={false}
          onDragStart={blockNativeDrag}
          onClick={() => onSelect()}
          onPointerDown={frameEditMode ? onPointerDown : undefined}
          onPointerMove={frameEditMode ? onPointerMove : undefined}
          onPointerUp={frameEditMode ? onPointerUp : undefined}
          onPointerCancel={frameEditMode ? onPointerUp : undefined}
          className={`absolute inset-0 touch-none select-none ${
            frameEditMode
              ? selected
                ? 'cursor-grab active:cursor-grabbing'
                : 'cursor-pointer'
              : 'cursor-grab active:cursor-grabbing'
          }`}
          style={{ WebkitUserDrag: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
          {...(frameEditMode ? {} : { ...attributes, ...listeners })}
        >
          <FramedPhoto photo={photo} edit={edit} selected={selected} fill />
        </div>
      </div>
      {showCaption && caption ? (
        <span className="shrink-0 text-center text-[10px] font-semibold text-[#8a7355]">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

function PoolThumb({
  photo,
  selected,
  disabled,
  onSelect,
}: {
  photo: BabyPhoto;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const data: PrintDragData = { photoId: photo.id, zone: 'pool' };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-${photo.id}`,
    data,
    disabled: Boolean(disabled),
  });
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : disabled ? 0.55 : 1,
      }}
      className={`border-0 bg-transparent p-0 ${
        disabled ? 'cursor-default' : 'touch-none cursor-grab active:cursor-grabbing'
      }`}
      onClick={onSelect}
      {...attributes}
      {...(disabled ? {} : listeners)}
    >
      <PlainPhotoThumb photo={photo} selected={selected} />
    </button>
  );
}

function DropZone({
  id,
  className,
  disabled,
  children,
  boxRef,
}: {
  id: 'drop-album' | 'drop-pool';
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
  boxRef?: React.Ref<HTMLDivElement>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: Boolean(disabled) });
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (!boxRef) return;
    if (typeof boxRef === 'function') boxRef(node);
    else boxRef.current = node;
  };
  return (
    <div
      ref={setRefs}
      className={`${className ?? ''} ${
        !disabled && isOver ? 'ring-2 ring-pink-400 ring-offset-2' : ''
      }`}
    >
      {children}
    </div>
  );
}

function applyDraftToState(
  draft: {
    title?: string;
    bg?: string;
    layout?: string;
    photoSize?: string;
    showCaptions?: boolean;
    order?: string[];
    edits?: Record<string, unknown>;
  },
  photos: BabyPhoto[],
  defaultTitle: string,
  setters: {
    setTitle: (v: string) => void;
    setBg: (v: PrintBgKey) => void;
    setLayout: (v: PrintLayout) => void;
    setPhotoSize: (v: BabyPrintPhotoSize) => void;
    setShowCaptions: (v: boolean) => void;
    setOrder: (v: string[]) => void;
    setEdits: (v: Record<string, PhotoEdit>) => void;
    setActiveId: (v: string | null) => void;
  },
) {
  setters.setTitle(typeof draft.title === 'string' ? draft.title : defaultTitle);
  if (isPrintBgKey(draft.bg)) {
    setters.setBg(draft.bg);
  }
  if (
    draft.layout === 'grid1' ||
    draft.layout === 'grid2' ||
    draft.layout === 'grid3' ||
    draft.layout === 'hero'
  ) {
    setters.setLayout(draft.layout);
  }
  if (isPhotoSize(draft.photoSize)) {
    setters.setPhotoSize(draft.photoSize);
  }
  setters.setShowCaptions(Boolean(draft.showCaptions));
  const parsedEdits: Record<string, PhotoEdit> = {};
  for (const p of photos) {
    parsedEdits[p.id] = parsePhotoEdit(draft.edits?.[p.id]);
  }
  const merged = mergePhotoState(photos, Array.isArray(draft.order) ? draft.order : [], parsedEdits);
  setters.setOrder(merged.order);
  setters.setEdits(merged.edits);
  setters.setActiveId(merged.order[0] ?? null);
}

export function BabyPrintAlbumEditor({
  open,
  onClose,
  babyId,
  currentGroupId,
  photos,
  defaultTitle,
  t,
}: {
  open: boolean;
  onClose: () => void;
  babyId: string;
  currentGroupId: string | null;
  photos: BabyPhoto[];
  defaultTitle: string;
  t: BabyGrowthTranslations;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [bg, setBg] = useState<PrintBgKey>('cream');
  const [bgTab, setBgTab] = useState<PrintBgGroup>('premium');
  useEffect(() => {
    setBgTab(PRINT_BG_RECIPES[bg].group);
  }, [bg]);
  const [layout, setLayout] = useState<PrintLayout>('grid2');
  /** true: 프레임 안 맞춤 / false: 넣고 빼기·순서 */
  const [frameEditMode, setFrameEditMode] = useState(false);
  const [photoSize, setPhotoSize] = useState<BabyPrintPhotoSize>('std_4x6');
  const [showCaptions, setShowCaptions] = useState(true);
  const [order, setOrder] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, PhotoEdit>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flashTarget, setFlashTarget] = useState<FlashTarget>(null);
  const [familyAlbums, setFamilyAlbums] = useState<BabyPrintAlbum[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const wasOpenRef = useRef(false);
  const albumBoxRef = useRef<HTMLDivElement | null>(null);
  const [pageFitEl, setPageFitEl] = useState<HTMLDivElement | null>(null);
  const [albumBoxH, setAlbumBoxH] = useState(0);
  const [albumBoxW, setAlbumBoxW] = useState(0);
  const [frameSlotRatio, setFrameSlotRatio] = useState(1);
  const onFrameSlot = useCallback((width: number, height: number) => {
    if (width < 8 || height < 8) return;
    const next = Math.ceil((height / width) * 100) / 100;
    setFrameSlotRatio((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  }, []);
  const photosRef = useRef(photos);
  const orderRef = useRef(order);
  const editsRef = useRef(edits);
  photosRef.current = photos;
  orderRef.current = order;
  editsRef.current = edits;
  const photoIdsKey = photosKey(photos);
  const flashTimerRef = useRef<number | null>(null);

  const photoMap = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const ownsAlbum = useCallback(
    (album: Pick<BabyPrintAlbum, 'created_by'> | null | undefined) =>
      Boolean(currentUserId && album?.created_by && album.created_by === currentUserId),
    [currentUserId],
  );

  const activeAlbum = useMemo(
    () => familyAlbums.find((a) => a.id === activeAlbumId) ?? null,
    [familyAlbums, activeAlbumId],
  );

  const flash = useCallback((target: FlashTarget) => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlashTarget(target);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashTarget(null);
      flashTimerRef.current = null;
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  // 페이지는 앨범 칸 안에 두고, 가로는 그 칸의 max-w-2xl 너비까지만 잰다.
  useEffect(() => {
    if (!open) return;
    const el = albumBoxRef.current;
    if (!el) return;
    const update = () => {
      const style = getComputedStyle(el);
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const next = Math.max(0, Math.round(el.clientHeight - pad));
      setAlbumBoxH((prev) => (Math.abs(prev - next) < 2 ? prev : next));
      if (!pageFitEl) return;
      const nextW = Math.round(pageFitEl.clientWidth);
      setAlbumBoxW((prev) => (Math.abs(prev - nextW) < 2 ? prev : nextW));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (pageFitEl) ro.observe(pageFitEl);
    return () => ro.disconnect();
  }, [open, frameEditMode, listOpen, pageFitEl]);

  const loadFamilyAlbums = useCallback(async () => {
    if (!currentGroupId || !babyId) {
      setFamilyAlbums([]);
      return;
    }
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return;
    setCurrentUserId(session.user.id);
    const { data, error } = await supabase
      .from('baby_print_albums')
      .select(
        'id, group_id, baby_id, created_by, title, bg, layout, photo_size, show_captions, photo_order, photo_edits, created_at, updated_at',
      )
      .eq('group_id', currentGroupId)
      .eq('baby_id', babyId)
      .order('updated_at', { ascending: false })
      .limit(40);
    if (error) {
      console.error('[BabyPrintAlbumEditor] list:', error);
      return;
    }
    const rows = (data ?? []).map((row) => ({
      ...row,
      photo_order: Array.isArray(row.photo_order) ? row.photo_order.map(String) : [],
      photo_edits:
        row.photo_edits && typeof row.photo_edits === 'object' && !Array.isArray(row.photo_edits)
          ? (row.photo_edits as Record<string, BabyPrintPhotoEdit>)
          : {},
    })) as BabyPrintAlbum[];
    setFamilyAlbums(rows);
  }, [babyId, currentGroupId]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    const currentPhotos = photosRef.current;

    if (justOpened) {
      setTitle(defaultTitle);
      setBg('cream');
      setLayout('grid2');
      setPhotoSize('std_4x6');
      setShowCaptions(true);
      const initial = mergePhotoState(currentPhotos, currentPhotos.map((p) => p.id), {});
      setOrder(initial.order);
      setEdits(initial.edits);
      setActiveId(initial.order[0] ?? null);
      setActiveAlbumId(null);
      setListOpen(false);
      setOutputError(null);
      setFlashTarget(null);
      void loadFamilyAlbums();
      return;
    }

    const merged = mergePhotoState(currentPhotos, orderRef.current, editsRef.current);
    setOrder(merged.order);
    setEdits(merged.edits);
    setActiveId((prev) => {
      if (prev && currentPhotos.some((p) => p.id === prev)) return prev;
      return merged.order[0] ?? null;
    });
  }, [open, babyId, photoIdsKey, defaultTitle, loadFamilyAlbums]);

  const monthLabel = (n: number) => t.album_month_label.replace('{n}', String(n));

  const orderedPhotos = useMemo(() => {
    return order
      .map((id) => photoMap.get(id))
      .filter((p): p is BabyPhoto => Boolean(p));
  }, [order, photoMap]);

  const selectedItems: PrintItem[] = useMemo(() => {
    return orderedPhotos
      .map((p) => ({ ...p, edit: edits[p.id] ?? defaultEdit() }))
      .filter((p) => p.edit.included);
  }, [orderedPhotos, edits]);

  const printPages = chunkPhotos(selectedItems, pageSizeFor(layout));
  const paper = PRINT_PHOTO_SIZES[photoSize];
  const paperRatio = paper.wMm / paper.hMm;
  let pageW = 0;
  let pageH = 0;
  if (albumBoxH > 0 && albumBoxW > 0) {
    const widthFromHeight = albumBoxH * paperRatio;
    if (widthFromHeight <= albumBoxW) {
      pageH = albumBoxH;
      pageW = widthFromHeight;
    } else {
      pageW = albumBoxW;
      pageH = albumBoxW / paperRatio;
    }
  }
  const gridClass =
    layout === 'grid1' ? 'grid-cols-1' : layout === 'grid3' ? 'grid-cols-3' : 'grid-cols-2';

  const photoSizeLabel = (key: BabyPrintPhotoSize) => {
    if (key === 'mini_2x3') return t.album_print_size_mini;
    if (key === 'small_3_5x5') return t.album_print_size_small;
    if (key === 'large_5x7') return t.album_print_size_large;
    if (key === 'xl_8x10') return t.album_print_size_xl;
    return t.album_print_size_std;
  };

  const patchEdit = (id: string, patch: Partial<PhotoEdit>) => {
    setEdits((prev) => {
      const base = prev[id] ?? defaultEdit();
      const next = { ...base, ...patch };
      if (typeof next.rotation === 'number') next.rotation = normDeg(next.rotation);
      if (typeof next.frameRotation === 'number') next.frameRotation = normDeg(next.frameRotation);
      if (typeof next.frameScaleX === 'number') {
        next.frameScaleX = clampNum(next.frameScaleX, FRAME_SCALE_MIN, FRAME_SCALE_X_MAX);
      }
      if (typeof next.frameScaleY === 'number') {
        next.frameScaleY = clampNum(next.frameScaleY, FRAME_SCALE_MIN, FRAME_SCALE_Y_MAX);
      }
      if (typeof next.zoom === 'number') next.zoom = clampNum(next.zoom, ZOOM_MIN, ZOOM_MAX);
      if (typeof next.focusX === 'number') next.focusX = clampNum(next.focusX, 0, 100);
      if (typeof next.focusY === 'number') next.focusY = clampNum(next.focusY, 0, 100);
      return { ...prev, [id]: next };
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFromPool, setDragFromPool] = useState(false);

  const poolPhotos = useMemo(
    () => orderedPhotos.filter((p) => !isIncluded(edits, p.id)),
    [orderedPhotos, edits],
  );
  const selectedIds = useMemo(
    () => order.filter((id) => isIncluded(edits, id)),
    [order, edits],
  );

  const frameEditModeRef = useRef(frameEditMode);
  frameEditModeRef.current = frameEditMode;

  const onDragStart = useCallback((event: DragStartEvent) => {
    if (frameEditModeRef.current) return;
    const data = event.active.data.current as PrintDragData | undefined;
    setDragId(data?.photoId ?? String(event.active.id).replace(/^pool-/, ''));
    setDragFromPool(data?.zone === 'pool' || String(event.active.id).startsWith('pool-'));
  }, []);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    setDragId(null);
    setDragFromPool(false);
    if (frameEditModeRef.current) return;
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current as PrintDragData | undefined;
    const photoId = data?.photoId ?? String(active.id).replace(/^pool-/, '');
    const fromPool = data?.zone === 'pool' || String(active.id).startsWith('pool-');
    const overRaw = String(over.id);
    const overPool = overRaw === 'drop-pool' || overRaw.startsWith('pool-');

    if (fromPool) {
      if (overPool) return;
      const beforeId = overRaw === 'drop-album' ? null : overRaw;
      // 드롭 시 cover 기본 맞춤(zoom 1·가운데)으로 프레임에 맞춤
      setEdits((prev) => ({
        ...prev,
        [photoId]: {
          ...(prev[photoId] ?? defaultEdit()),
          included: true,
          ...coverFitPatch(),
        },
      }));
      setOrder((prev) => placeIncludedBefore(prev, photoId, beforeId));
      setActiveId(photoId);
      return;
    }

    // 앨범 → 대기(영역 또는 대기 썸네일 위)
    if (overPool) {
      setEdits((prev) => ({
        ...prev,
        [photoId]: { ...(prev[photoId] ?? defaultEdit()), included: false },
      }));
      return;
    }
    if (overRaw === 'drop-album') return;
    if (photoId === overRaw) return;
    setOrder((prev) => reorderIncludedIds(prev, editsRef.current, photoId, overRaw));
  }, []);

  const onDragCancel = useCallback(() => {
    setDragId(null);
    setDragFromPool(false);
  }, []);

  const dragPhoto = dragId ? photoMap.get(dragId) : null;
  const dragEdit = dragId ? edits[dragId] ?? defaultEdit() : null;

  const saveFamily = async () => {
    if (!currentGroupId || busy) return;
    setBusy(true);
    try {
      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) return;
      setCurrentUserId(session.user.id);
      const canUpdate = Boolean(
        activeAlbumId && activeAlbum && activeAlbum.created_by === session.user.id,
      );
      const base = {
        group_id: currentGroupId,
        baby_id: babyId,
        title: title.trim(),
        bg,
        layout,
        photo_size: photoSize,
        show_captions: showCaptions,
        photo_order: order,
        photo_edits: edits,
        updated_at: new Date().toISOString(),
      };
      if (canUpdate && activeAlbumId) {
        const { error } = await supabase
          .from('baby_print_albums')
          .update(base)
          .eq('id', activeAlbumId)
          .eq('group_id', currentGroupId)
          .eq('created_by', session.user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('baby_print_albums')
          .insert({ ...base, created_by: session.user.id })
          .select('id')
          .single();
        if (error) throw error;
        setActiveAlbumId(data.id);
      }
      flash('family');
      await loadFamilyAlbums();
    } catch (err) {
      console.error('[BabyPrintAlbumEditor] family save:', err);
    } finally {
      setBusy(false);
    }
  };

  const openFamilyAlbum = (album: BabyPrintAlbum) => {
    applyDraftToState(
      {
        title: album.title,
        bg: album.bg,
        layout: album.layout,
        photoSize: album.photo_size,
        showCaptions: album.show_captions,
        order: album.photo_order,
        edits: album.photo_edits as Record<string, unknown>,
      },
      photosRef.current,
      defaultTitle,
      { setTitle, setBg, setLayout, setPhotoSize, setShowCaptions, setOrder, setEdits, setActiveId },
    );
    setActiveAlbumId(album.id);
    setListOpen(false);
  };

  const deleteFamilyAlbum = async (album: BabyPrintAlbum) => {
    if (!currentGroupId || busy || !ownsAlbum(album)) return;
    if (!window.confirm(`${t.delete}?`)) return;
    setBusy(true);
    try {
      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) return;
      const { error } = await supabase
        .from('baby_print_albums')
        .delete()
        .eq('id', album.id)
        .eq('group_id', currentGroupId)
        .eq('created_by', session.user.id);
      if (error) throw error;
      if (activeAlbumId === album.id) setActiveAlbumId(null);
      await loadFamilyAlbums();
    } catch (err) {
      console.error('[BabyPrintAlbumEditor] delete:', err);
    } finally {
      setBusy(false);
    }
  };

  const active = activeId ? photoMap.get(activeId) : null;
  const activeEdit = activeId ? edits[activeId] ?? defaultEdit() : null;
  const frameYMax = Math.max(FRAME_SCALE_MIN, frameSlotRatio);
  const frameY = activeEdit ? Math.min(editFrameScaleY(activeEdit), frameYMax) : frameYMax;

  const outputBusy = pdfBusy || printBusy;

  const handlePrint = async () => {
    if (selectedItems.length === 0 || outputBusy) return;
    setPrintBusy(true);
    setOutputError(null);
    try {
      await printPrintAlbum({
        title: title.trim(),
        items: selectedItems,
        bg,
        layout,
        photoSize,
        showCaptions,
        monthLabel,
      });
    } catch (err) {
      console.error('[BabyPrintAlbumEditor] print:', err);
      setOutputError(t.album_print_image_failed);
    } finally {
      setPrintBusy(false);
    }
  };

  const handleSavePdf = async () => {
    if (selectedItems.length === 0 || outputBusy) return;
    setPdfBusy(true);
    setOutputError(null);
    try {
      await exportPrintAlbumPdf({
        title: title.trim(),
        items: selectedItems,
        bg,
        layout,
        photoSize,
        showCaptions,
        monthLabel,
      });
    } catch (err) {
      console.error('[BabyPrintAlbumEditor] pdf:', err);
      setOutputError(t.album_print_image_failed);
    } finally {
      setPdfBusy(false);
    }
  };

  const handleSharePdf = async () => {
    if (selectedItems.length === 0 || outputBusy) return;
    setPdfBusy(true);
    setOutputError(null);
    const albumTitle = title.trim();
    let blob: Blob;
    try {
      blob = await exportPrintAlbumPdf({
        title: albumTitle,
        items: selectedItems,
        bg,
        layout,
        photoSize,
        showCaptions,
        monthLabel,
        save: false,
      });
    } catch (err) {
      console.error('[BabyPrintAlbumEditor] share:', err);
      setOutputError(t.album_print_image_failed);
      setPdfBusy(false);
      return;
    }
    try {
      const safe = albumTitle.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'baby-album';
      const file = new File([blob], `${safe}.pdf`, { type: 'application/pdf' });
      await shareResult({ title: albumTitle, text: albumTitle, files: [file] });
    } catch (err) {
      console.error('[BabyPrintAlbumEditor] share:', err);
    } finally {
      setPdfBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black/50">
      <SoftHeartClipDefs />
      <div className="mx-auto flex h-full w-full max-w-[100rem] flex-col bg-white shadow-2xl sm:my-2 sm:h-[calc(100dvh-1rem)] sm:w-[min(98vw,100rem)] sm:rounded-2xl">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3 className="m-0 shrink-0 whitespace-nowrap text-sm font-bold text-slate-800">{t.album_print}</h3>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
            {currentGroupId ? (
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {t.album_print_load}
                {familyAlbums.length > 0 ? ` (${familyAlbums.length})` : ''}
              </button>
            ) : null}
            {currentGroupId ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void saveFamily();
                }}
                className="rounded-full bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {flashTarget === 'family' ? t.album_print_saved : t.save}
              </button>
            ) : null}
            <button
              type="button"
              disabled={selectedItems.length === 0 || outputBusy}
              onClick={() => {
                void handlePrint();
              }}
              className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {printBusy ? '...' : t.album_print_action}
            </button>
            <button
              type="button"
              disabled={selectedItems.length === 0 || outputBusy}
              onClick={() => {
                void handleSavePdf();
              }}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {pdfBusy ? '...' : t.album_print_download}
            </button>
            <button
              type="button"
              disabled={selectedItems.length === 0 || outputBusy}
              onClick={() => {
                void handleSharePdf();
              }}
              className="rounded-full bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {t.report_share}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {t.close}
            </button>
          </div>
        </div>

        {outputError ? (
          <p className="m-0 shrink-0 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">{outputError}</p>
        ) : null}

        {listOpen ? (
          <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-3">
            {familyAlbums.length === 0 ? (
              <p className="m-0 text-xs text-slate-500">{t.album_print_no_saved}</p>
            ) : (
              <ul className="m-0 flex max-h-36 list-none flex-col gap-1.5 overflow-y-auto p-0">
                {familyAlbums.map((album) => (
                  <li
                    key={album.id}
                    className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => openFamilyAlbum(album)}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                    >
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        {album.title || defaultTitle}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(album.updated_at).toLocaleString()}
                        {activeAlbumId === album.id ? ' · ✓' : ''}
                      </span>
                    </button>
                    {ownsAlbum(album) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void deleteFamilyAlbum(album);
                        }}
                        className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 disabled:opacity-50"
                      >
                        {t.delete}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-[11px] font-semibold text-slate-500">
              {t.album_print_title}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800"
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={showCaptions}
                onChange={(e) => setShowCaptions(e.target.checked)}
              />
              {t.album_print_captions}
            </label>
            <button
              type="button"
              title={t.album_print_edit_mode_hint}
              aria-pressed={frameEditMode}
              onClick={() => setFrameEditMode((v) => !v)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                frameEditMode
                  ? 'bg-pink-500 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.album_print_edit_mode}
              {frameEditMode ? ' ON' : ' OFF'}
            </button>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">{t.album_print_bg}</span>
              <div className="flex gap-1 rounded-full bg-slate-100 p-0.5">
                {(
                  [
                    ['premium', t.album_print_bg_premium],
                    ['cute', t.album_print_bg_cute],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={bgTab === key}
                    onClick={() => setBgTab(key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      bgTab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(bgTab === 'premium' ? PRINT_BG_PREMIUM_KEYS : PRINT_BG_CUTE_KEYS).map((key) => {
                const label = {
                  cream: t.album_print_bg_cream,
                  blush: t.album_print_bg_blush,
                  sage: t.album_print_bg_sage,
                  sky: t.album_print_bg_sky,
                  wash: t.album_print_bg_wash,
                  line: t.album_print_bg_line,
                  floral: t.album_print_bg_floral,
                  vellum: t.album_print_bg_vellum,
                  stars_clouds: t.album_print_bg_stars_clouds,
                  hearts_soft: t.album_print_bg_hearts_soft,
                  moon: t.album_print_bg_moon,
                  animals: t.album_print_bg_animals,
                  rainbow: t.album_print_bg_rainbow,
                  balloons: t.album_print_bg_balloons,
                  footprints: t.album_print_bg_footprints,
                  blocks: t.album_print_bg_blocks,
                }[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    aria-pressed={bg === key}
                    onClick={() => setBg(key)}
                    className={`flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-xl p-1 text-left transition ${
                      bg === key ? 'ring-2 ring-slate-800' : 'ring-1 ring-slate-200'
                    }`}
                  >
                    <span
                      className="relative block aspect-[2/3] w-full overflow-hidden rounded-lg"
                      style={printBgThumbStyle(key)}
                    >
                      <span className="absolute inset-x-[28%] top-[34%] bottom-[34%] rounded-sm bg-white/55" />
                    </span>
                    <span className="w-full truncate text-center text-[10px] font-semibold text-slate-600">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500">{t.album_print_layout}</span>
            <div className="flex gap-1">
              {(
                [
                  ['grid1', t.album_print_layout_1],
                  ['grid2', t.album_print_layout_2],
                  ['grid3', t.album_print_layout_3],
                  ['hero', t.album_print_layout_hero],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLayout(key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    layout === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-semibold text-slate-500">{t.album_print_photo_size}</span>
            <div className="flex flex-wrap gap-1">
              {PRINT_PHOTO_SIZE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPhotoSize(key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    photoSize === key ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {photoSizeLabel(key)}
                </button>
              ))}
            </div>

          </div>

        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {frameEditMode && active && activeEdit?.included ? (
            <aside className="flex max-h-36 shrink-0 flex-col gap-2 overflow-y-auto border-b border-slate-100 bg-slate-50 px-3 py-2 lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r lg:py-3">
              <span className="text-[10px] text-slate-500">{t.album_print_fit_hint}</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">{t.album_print_frame}</span>
                <div className="flex gap-1">
                  {FRAME_KEYS.map((frame) => (
                    <button
                      key={frame}
                      type="button"
                      title={
                        frame === 'heart'
                          ? '각진 하트'
                          : frame === 'heart_soft'
                            ? '부드러운 하트'
                            : frame
                      }
                      aria-label={
                        frame === 'heart'
                          ? '각진 하트'
                          : frame === 'heart_soft'
                            ? '부드러운 하트'
                            : frame
                      }
                      onClick={() => patchEdit(active.id, { frame })}
                      className={`inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-md ${
                        activeEdit.frame === frame
                          ? 'bg-slate-800 text-white'
                          : 'bg-white text-slate-700 ring-1 ring-slate-200'
                      }`}
                    >
                      <FrameShapeIcon frame={frame} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold text-slate-500">
                  {t.album_print_frame_width}
                </span>
                <input
                  type="range"
                  min={FRAME_SCALE_MIN}
                  max={FRAME_SCALE_X_MAX}
                  step={0.01}
                  value={editFrameScaleX(activeEdit)}
                  onChange={(e) =>
                    patchEdit(active.id, { frameScaleX: Number(e.target.value) })
                  }
                  className="h-2 min-w-[5.5rem] flex-1 touch-manipulation accent-slate-800"
                  aria-label={t.album_print_frame_width}
                />
                <span className="w-10 shrink-0 text-right text-[10px] font-semibold tabular-nums text-slate-500">
                  {Math.round(editFrameScaleX(activeEdit) * 100)}%
                </span>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold text-slate-500">
                  {t.album_print_frame_height}
                </span>
                <input
                  type="range"
                  min={FRAME_SCALE_MIN}
                  max={frameYMax}
                  step={0.01}
                  value={frameY}
                  onChange={(e) =>
                    patchEdit(active.id, {
                      frameScaleY: Math.min(Number(e.target.value), frameYMax),
                    })
                  }
                  className="h-2 min-w-[5.5rem] flex-1 touch-manipulation accent-slate-800"
                  aria-label={t.album_print_frame_height}
                />
                <span className="w-10 shrink-0 text-right text-[10px] font-semibold tabular-nums text-slate-500">
                  {Math.round((frameY / frameYMax) * 100)}%
                </span>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold text-slate-500">
                  {t.album_print_frame_rotate}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patchEdit(active.id, {
                      frameRotation: editFrameRotation(activeEdit) - ROTATE_STEP,
                    })
                  }
                  className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold touch-manipulation ring-1 ring-slate-200"
                  aria-label={`${t.album_print_frame_rotate} ccw`}
                >
                  ↺
                </button>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={editFrameRotation(activeEdit)}
                  onChange={(e) =>
                    patchEdit(active.id, { frameRotation: Number(e.target.value) })
                  }
                  className="h-2 min-w-[5.5rem] flex-1 touch-manipulation accent-slate-800"
                  aria-label={t.album_print_frame_rotate}
                />
                <span className="w-8 text-[10px] font-semibold tabular-nums text-slate-500">
                  {editFrameRotation(activeEdit)}°
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patchEdit(active.id, {
                      frameRotation: editFrameRotation(activeEdit) + ROTATE_STEP,
                    })
                  }
                  className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold touch-manipulation ring-1 ring-slate-200"
                  aria-label={`${t.album_print_frame_rotate} cw`}
                >
                  ↻
                </button>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold text-slate-500">
                  {t.album_print_photo_rotate}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patchEdit(active.id, { rotation: activeEdit.rotation - ROTATE_STEP })
                  }
                  className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold touch-manipulation ring-1 ring-slate-200"
                  aria-label={`${t.album_print_photo_rotate} ccw`}
                >
                  ↺
                </button>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={activeEdit.rotation}
                  onChange={(e) => patchEdit(active.id, { rotation: Number(e.target.value) })}
                  className="h-2 min-w-[5.5rem] flex-1 touch-manipulation accent-slate-800"
                  aria-label={t.album_print_photo_rotate}
                />
                <span className="w-8 text-[10px] font-semibold tabular-nums text-slate-500">
                  {activeEdit.rotation}°
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patchEdit(active.id, { rotation: activeEdit.rotation + ROTATE_STEP })
                  }
                  className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold touch-manipulation ring-1 ring-slate-200"
                  aria-label={`${t.album_print_photo_rotate} cw`}
                >
                  ↻
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  patchEdit(active.id, {
                    zoom: 1,
                    focusX: 50,
                    focusY: 50,
                    frameScaleX: 1,
                    frameScaleY: 1,
                    rotation: 0,
                    frameRotation: 0,
                  })
                }
                className="self-start rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 touch-manipulation ring-1 ring-slate-200"
                title={t.album_print_fit_hint}
              >
                {t.album_print_fit_reset}
              </button>
            </aside>
          ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={printCollisionDetection}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <DropZone
              id="drop-album"
              disabled={frameEditMode}
              boxRef={albumBoxRef}
              className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-2 sm:p-3"
            >
              <SortableContext items={selectedIds} strategy={rectSortingStrategy}>
                {selectedItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">{t.album_print_empty}</p>
                ) : (
                  <div
                    ref={setPageFitEl}
                    className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2"
                  >
                    {printPages.map((page, pageIdx) => {
                      return (
                      <section
                        key={`print-page-${pageIdx}`}
                        className="flex shrink-0 flex-col overflow-hidden rounded-2xl p-2 sm:p-3"
                        style={{
                          ...printBgPreviewStyle(bg),
                          ...(pageW > 0
                            ? { width: Math.round(pageW), height: Math.round(pageH) }
                            : {}),
                        }}
                      >
                        <div className="mb-2 flex shrink-0 items-baseline justify-between gap-2">
                          <h4 className="m-0 text-sm font-bold text-[#5c4630]">
                            {title.trim()}
                          </h4>
                          <span className="text-[10px] font-medium text-[#8a7355]/80">
                            {pageIdx + 1}/{printPages.length}
                          </span>
                        </div>
                        <div
                          className={`grid min-h-0 flex-1 gap-2 ${gridClass}`}
                          style={{ gridAutoRows: 'minmax(0, 1fr)' }}
                        >
                          {page.map((photo, idx) => (
                            <SortableAlbumThumb
                              key={photo.id}
                              photo={photo}
                              edit={photo.edit}
                              selected={activeId === photo.id}
                              showCaption={showCaptions}
                              caption={
                                photo.monthAge !== null ? monthLabel(photo.monthAge) : null
                              }
                              hero={layout === 'hero' && idx === 0}
                              frameEditMode={frameEditMode}
                              onFrameSlot={activeId === photo.id ? onFrameSlot : undefined}
                              onSelect={() => setActiveId(photo.id)}
                              onFitChange={(patch) => patchEdit(photo.id, patch)}
                            />
                          ))}
                        </div>
                      </section>
                      );
                    })}
                  </div>
                )}
              </SortableContext>
            </DropZone>

            <DropZone
              id="drop-pool"
              disabled={frameEditMode}
              className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 sm:px-4"
            >
              <p className="mb-2 text-[11px] font-semibold text-slate-500">
                {t.album_print_tray}
                {poolPhotos.length > 0 ? ` · ${poolPhotos.length}` : ''}
                {frameEditMode ? ` · ${t.album_print_edit_mode} ON` : ''}
              </p>
              {poolPhotos.length === 0 ? (
                <p className="m-0 py-2 text-center text-[11px] text-slate-400">
                  {t.album_print_tray_empty}
                </p>
              ) : (
                <div className="grid max-h-36 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
                  {poolPhotos.map((photo) => (
                    <PoolThumb
                      key={`pool-${photo.id}`}
                      photo={photo}
                      selected={activeId === photo.id}
                      disabled={frameEditMode}
                      onSelect={() => setActiveId(photo.id)}
                    />
                  ))}
                </div>
              )}
            </DropZone>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragPhoto ? (
              <div className="w-20 opacity-95 shadow-xl sm:w-24">
                {dragFromPool || !dragEdit ? (
                  <PlainPhotoThumb photo={dragPhoto} selected />
                ) : (
                  <FramedPhoto photo={dragPhoto} edit={dragEdit} selected />
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        </div>
      </div>
    </div>,
    document.body,
  );
}
