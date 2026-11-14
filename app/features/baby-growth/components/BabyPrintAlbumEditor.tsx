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
import { exportPrintAlbumPdf } from '../utils/export-print-album-pdf';

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

type PrintBgKey = BabyPrintAlbum['bg'];
type PrintLayout = BabyPrintAlbum['layout'];
type PrintFrame = BabyPrintPhotoEdit['frame'];
type PhotoEdit = BabyPrintPhotoEdit;
type FlashTarget = 'family' | null;

/** 출력 규격 (가로×세로 mm, 세로 인화) */
const PRINT_PHOTO_SIZES: Record<
  BabyPrintPhotoSize,
  { wMm: number; hMm: number; marginMm: number }
> = {
  mini_2x3: { wMm: 50.8, hMm: 76.2, marginMm: 3 },
  small_3_5x5: { wMm: 88.9, hMm: 127, marginMm: 4 },
  std_4x6: { wMm: 101.6, hMm: 152.4, marginMm: 5 },
  large_5x7: { wMm: 127, hMm: 177.8, marginMm: 6 },
  xl_8x10: { wMm: 203.2, hMm: 254, marginMm: 8 },
};

const PHOTO_SIZE_KEYS: BabyPrintPhotoSize[] = [
  'mini_2x3',
  'small_3_5x5',
  'std_4x6',
  'large_5x7',
  'xl_8x10',
];

function isPhotoSize(v: unknown): v is BabyPrintPhotoSize {
  return typeof v === 'string' && PHOTO_SIZE_KEYS.includes(v as BabyPrintPhotoSize);
}

const PRINT_BG: Record<PrintBgKey, { preview: string; print: string; swatch: string }> = {
  cream: {
    preview: 'bg-[linear-gradient(160deg,#fbf6ec_0%,#f3e8d4_55%,#efe2cc_100%)]',
    print: 'linear-gradient(160deg,#fbf6ec 0%,#f3e8d4 55%,#efe2cc 100%)',
    swatch: 'bg-[#f3e8d4]',
  },
  blush: {
    preview: 'bg-[linear-gradient(160deg,#fff7f5_0%,#fde8e4_55%,#f9dcd6_100%)]',
    print: 'linear-gradient(160deg,#fff7f5 0%,#fde8e4 55%,#f9dcd6 100%)',
    swatch: 'bg-[#fde8e4]',
  },
  sage: {
    preview: 'bg-[linear-gradient(160deg,#f4f7f2_0%,#e4eee0_55%,#d7e6d1_100%)]',
    print: 'linear-gradient(160deg,#f4f7f2 0%,#e4eee0 55%,#d7e6d1 100%)',
    swatch: 'bg-[#e4eee0]',
  },
  sky: {
    preview: 'bg-[linear-gradient(160deg,#f3f8fb_0%,#e2eef6_55%,#d4e6f2_100%)]',
    print: 'linear-gradient(160deg,#f3f8fb 0%,#e2eef6 55%,#d4e6f2 100%)',
    swatch: 'bg-[#e2eef6]',
  },
};

const FRAME_CLIP: Record<PrintFrame, string> = {
  rect: 'none',
  round: 'circle(50% at 50% 50%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  heart:
    'polygon(50% 88%, 12% 52%, 8% 28%, 22% 10%, 40% 12%, 50% 28%, 60% 12%, 78% 10%, 92% 28%, 88% 52%)',
  hex: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
};

const FRAME_KEYS: PrintFrame[] = ['rect', 'round', 'diamond', 'heart', 'hex'];
const FRAME_LABEL: Record<PrintFrame, string> = {
  rect: '▭',
  round: '○',
  diamond: '◇',
  heart: '♥',
  hex: '⬡',
};

const ROTATE_STEP = 15;
const BG_KEYS = Object.keys(PRINT_BG) as PrintBgKey[];

function normDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

function defaultEdit(): PhotoEdit {
  // 새 사진은 대기열 — 드래그로 인쇄 앨범에 넣음
  return { included: false, frame: 'rect', rotation: 0 };
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

function chunkPhotos<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** 페이지당 장수 — 배치(layout)만 따름. 사진 크기(photoSize)는 용지 mm만 담당. */
function pageSizeFor(layout: PrintLayout): number {
  if (layout === 'grid3') return 9;
  if (layout === 'hero') return 5;
  return 6; // grid2: 2×3
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parsePhotoEdit(raw: unknown): PhotoEdit {
  if (!raw || typeof raw !== 'object') return defaultEdit();
  const e = raw as Record<string, unknown>;
  const frame = FRAME_KEYS.includes(e.frame as PrintFrame) ? (e.frame as PrintFrame) : 'rect';
  const rotation =
    typeof e.rotation === 'number' && Number.isFinite(e.rotation) ? normDeg(e.rotation) : 0;
  return { included: e.included !== false, frame, rotation };
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

function runPrintAlbum(opts: {
  title: string;
  items: PrintItem[];
  bg: PrintBgKey;
  layout: PrintLayout;
  photoSize: BabyPrintPhotoSize;
  showCaptions: boolean;
  monthLabel: (n: number) => string;
}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  const paper = PRINT_PHOTO_SIZES[opts.photoSize];
  const size = pageSizeFor(opts.layout);
  const pages = chunkPhotos(opts.items, size);
  const cols = opts.layout === 'grid3' ? 3 : 2;

  const pageHtml = pages
    .map((page, pageIdx) => {
      const cells = page
        .map((photo, idx) => {
          const caption =
            opts.showCaptions && photo.monthAge !== null
              ? escapeHtml(opts.monthLabel(photo.monthAge))
              : '';
          const clip = FRAME_CLIP[photo.edit.frame];
          const clipStyle = clip === 'none' ? '' : `clip-path:${clip};`;
          const radius =
            photo.edit.frame === 'rect' ? 'border-radius:4mm;' : 'border-radius:0;';
          const heroClass = opts.layout === 'hero' && idx === 0 ? ' cell--hero' : '';
          return `<figure class="cell${heroClass}">
  <div class="frame" style="${radius}">
    <div class="spin" style="transform:rotate(${photo.edit.rotation}deg)">
      <img src="${escapeHtml(photo.imageUrl)}" alt="" style="${clipStyle}" />
    </div>
  </div>
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</figure>`;
        })
        .join('');
      const gridClass =
        opts.layout === 'hero' ? 'grid grid--hero' : `grid grid--${cols}`;
      return `<section class="page${pageIdx === pages.length - 1 ? ' page--last' : ''}">
  <header><h1>${escapeHtml(opts.title)}</h1><span>${pageIdx + 1}/${pages.length}</span></header>
  <div class="${gridClass}">${cells}</div>
</section>`;
    })
    .join('');

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(opts.title)}</title>
<style>
  @page { size: ${paper.wMm}mm ${paper.hMm}mm; margin: ${paper.marginMm}mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", "Apple SD Gothic Neo", sans-serif;
    color: #4a3f35;
    background: ${PRINT_BG[opts.bg].print};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    min-height: calc(100vh - 2px);
    padding: 10mm;
    display: flex;
    flex-direction: column;
    gap: 7mm;
    page-break-after: always;
    break-after: page;
  }
  .page--last { page-break-after: auto; break-after: auto; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  h1 { margin: 0; font-size: 18pt; font-weight: 700; letter-spacing: -0.02em; }
  header span { font-size: 10pt; opacity: 0.55; }
  .grid { flex: 1; display: grid; gap: 5mm; align-content: stretch; min-height: 0; }
  .grid--2 { grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; }
  .grid--3 { grid-template-columns: 1fr 1fr 1fr; grid-auto-rows: 1fr; }
  .grid--hero {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1.35fr 1fr 1fr;
  }
  .cell--hero { grid-column: 1 / -1; }
  .cell { margin: 0; display: flex; flex-direction: column; gap: 2mm; min-height: 0; }
  .frame {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: rgba(255,255,255,0.72);
    box-shadow: 0 1.2mm 3.5mm rgba(74, 63, 53, 0.12);
    border: 0.35mm solid rgba(255,255,255,0.9);
  }
  .spin {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .spin img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  figcaption { font-size: 8.5pt; font-weight: 600; opacity: 0.7; text-align: center; }
  @media print {
    .page { min-height: auto; height: ${paper.hMm - paper.marginMm * 2}mm; padding: ${paper.marginMm}mm; }
    h1 { font-size: ${opts.layout === 'grid3' ? '12pt' : '14pt'}; }
  }
</style></head><body>${pageHtml}</body></html>`);
  doc.close();

  const imgs = Array.from(doc.images);
  const wait =
    imgs.length === 0
      ? Promise.resolve()
      : Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) return resolve();
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }),
          ),
        );

  void wait.then(() => {
    win.focus();
    win.print();
    window.setTimeout(() => iframe.remove(), 1000);
  });
}

function FramedPhoto({
  photo,
  edit,
  selected,
}: {
  photo: BabyPhoto;
  edit: PhotoEdit;
  selected?: boolean;
}) {
  const clip = FRAME_CLIP[edit.frame];
  return (
    <div
      className={`relative aspect-square overflow-hidden bg-white/70 shadow-sm ${
        edit.frame === 'rect' ? 'rounded-xl' : ''
      } ${selected ? 'ring-2 ring-amber-500' : 'border border-white/80'}`}
    >
      <div
        className="flex h-full w-full items-center justify-center transition-transform duration-200 ease-out"
        style={{ transform: `rotate(${edit.rotation}deg)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbnailUrl ?? photo.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          style={clip === 'none' ? undefined : { clipPath: clip }}
        />
      </div>
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
  onSelect,
}: {
  photo: BabyPhoto;
  edit: PhotoEdit;
  selected: boolean;
  showCaption: boolean;
  caption: string | null;
  hero?: boolean;
  onSelect: () => void;
}) {
  const data: PrintDragData = { photoId: photo.id, zone: 'album' };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    data,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={`m-0 flex min-w-0 touch-none flex-col gap-1 ${hero ? 'col-span-2' : ''}`}
    >
      <button
        type="button"
        className="m-0 cursor-grab border-0 bg-transparent p-0 text-left active:cursor-grabbing"
        onClick={onSelect}
        {...attributes}
        {...listeners}
      >
        <FramedPhoto photo={photo} edit={edit} selected={selected} />
      </button>
      {showCaption && caption ? (
        <span className="text-center text-[10px] font-semibold text-[#8a7355]">{caption}</span>
      ) : null}
    </div>
  );
}

function PoolThumb({
  photo,
  edit,
  selected,
  onSelect,
}: {
  photo: BabyPhoto;
  edit: PhotoEdit;
  selected: boolean;
  onSelect: () => void;
}) {
  const data: PrintDragData = { photoId: photo.id, zone: 'pool' };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-${photo.id}`,
    data,
  });
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
      }}
      className="touch-none cursor-grab border-0 bg-transparent p-0 active:cursor-grabbing"
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <FramedPhoto photo={photo} edit={edit} selected={selected} />
    </button>
  );
}

function DropZone({
  id,
  className,
  children,
}: {
  id: 'drop-album' | 'drop-pool';
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${isOver ? 'ring-2 ring-pink-400 ring-offset-2' : ''}`}
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
  setters.setTitle(
    typeof draft.title === 'string' && draft.title.trim() ? draft.title : defaultTitle,
  );
  if (draft.bg === 'cream' || draft.bg === 'blush' || draft.bg === 'sage' || draft.bg === 'sky') {
    setters.setBg(draft.bg);
  }
  if (draft.layout === 'grid2' || draft.layout === 'grid3' || draft.layout === 'hero') {
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
  const [layout, setLayout] = useState<PrintLayout>('grid2');
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
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const wasOpenRef = useRef(false);
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
  const gridClass = layout === 'grid3' ? 'grid-cols-3' : 'grid-cols-2';

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
      return { ...prev, [id]: next };
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [dragId, setDragId] = useState<string | null>(null);

  const poolPhotos = useMemo(
    () => orderedPhotos.filter((p) => !isIncluded(edits, p.id)),
    [orderedPhotos, edits],
  );
  const selectedIds = useMemo(
    () => order.filter((id) => isIncluded(edits, id)),
    [order, edits],
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as PrintDragData | undefined;
    setDragId(data?.photoId ?? String(event.active.id).replace(/^pool-/, ''));
  }, []);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    setDragId(null);
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
      setEdits((prev) => ({
        ...prev,
        [photoId]: { ...(prev[photoId] ?? defaultEdit()), included: true },
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
        title: title.trim() || defaultTitle,
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

  const handleSavePdf = async () => {
    if (selectedItems.length === 0 || pdfBusy) return;
    setPdfBusy(true);
    try {
      await exportPrintAlbumPdf({
        title: title.trim() || defaultTitle,
        items: selectedItems,
        bg,
        layout,
        photoSize,
        showCaptions,
        monthLabel,
      });
    } catch (err) {
      console.error('[BabyPrintAlbumEditor] pdf:', err);
    } finally {
      setPdfBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black/50">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl sm:my-3 sm:h-[min(94dvh,56rem)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3 className="m-0 text-sm font-bold text-slate-800">{t.album_print}</h3>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
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
              disabled={selectedItems.length === 0}
              onClick={() =>
                runPrintAlbum({
                  title: title.trim() || defaultTitle,
                  items: selectedItems,
                  bg,
                  layout,
                  photoSize,
                  showCaptions,
                  monthLabel,
                })
              }
              className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {t.album_print_action}
            </button>
            <button
              type="button"
              disabled={selectedItems.length === 0 || pdfBusy}
              onClick={() => {
                void handleSavePdf();
              }}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {pdfBusy ? '...' : t.album_print_download}
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500">{t.album_print_bg}</span>
            <div className="flex gap-2">
              {BG_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={bg === key}
                  onClick={() => setBg(key)}
                  className={`h-7 w-7 rounded-full border-2 ${PRINT_BG[key].swatch} ${
                    bg === key
                      ? 'scale-110 border-slate-800'
                      : 'border-white shadow ring-1 ring-slate-200'
                  }`}
                />
              ))}
            </div>

            <span className="text-[11px] font-semibold text-slate-500">{t.album_print_layout}</span>
            <div className="flex gap-1">
              {(
                [
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
              {PHOTO_SIZE_KEYS.map((key) => (
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

          {active && activeEdit?.included ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
              <span className="text-[11px] font-semibold text-slate-500">{t.album_print_frame}</span>
              <div className="flex gap-1">
                {FRAME_KEYS.map((frame) => (
                  <button
                    key={frame}
                    type="button"
                    onClick={() => patchEdit(active.id, { frame })}
                    className={`h-7 w-7 rounded-md text-sm ${
                      activeEdit.frame === frame
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200'
                    }`}
                  >
                    {FRAME_LABEL[frame]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  patchEdit(active.id, { rotation: activeEdit.rotation - ROTATE_STEP })
                }
                className="rounded-md bg-white px-2 py-1 text-xs font-bold ring-1 ring-slate-200"
                aria-label="ccw"
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
                className="h-2 w-28 accent-slate-800"
                aria-label="rotation"
              />
              <span className="w-8 text-[10px] font-semibold tabular-nums text-slate-500">
                {activeEdit.rotation}°
              </span>
              <button
                type="button"
                onClick={() =>
                  patchEdit(active.id, { rotation: activeEdit.rotation + ROTATE_STEP })
                }
                className="rounded-md bg-white px-2 py-1 text-xs font-bold ring-1 ring-slate-200"
                aria-label="cw"
              >
                ↻
              </button>
            </div>
          ) : null}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={printCollisionDetection}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DropZone
              id="drop-album"
              className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-4"
            >
              <SortableContext items={selectedIds} strategy={rectSortingStrategy}>
                {selectedItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">{t.album_print_empty}</p>
                ) : (
                  <div className="mx-auto flex max-w-2xl flex-col gap-4">
                    {printPages.map((page, pageIdx) => (
                      <section
                        key={`print-page-${pageIdx}`}
                        className={`overflow-hidden rounded-2xl p-4 shadow-sm ${PRINT_BG[bg].preview}`}
                      >
                        <div className="mb-3 flex items-baseline justify-between gap-2">
                          <h4 className="m-0 text-sm font-bold text-[#5c4630]">
                            {title.trim() || defaultTitle}
                          </h4>
                          <span className="text-[10px] font-medium text-[#8a7355]/80">
                            {pageIdx + 1}/{printPages.length}
                          </span>
                        </div>
                        <div className={`grid gap-2.5 ${gridClass}`}>
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
                              onSelect={() => setActiveId(photo.id)}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </SortableContext>
            </DropZone>

            <DropZone
              id="drop-pool"
              className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 sm:px-4"
            >
              <p className="mb-2 text-[11px] font-semibold text-slate-500">
                {t.album_print_tray}
                {poolPhotos.length > 0 ? ` · ${poolPhotos.length}` : ''}
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
                      edit={edits[photo.id] ?? defaultEdit()}
                      selected={activeId === photo.id}
                      onSelect={() => setActiveId(photo.id)}
                    />
                  ))}
                </div>
              )}
            </DropZone>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragPhoto && dragEdit ? (
              <div className="w-20 opacity-95 shadow-xl sm:w-24">
                <FramedPhoto photo={dragPhoto} edit={dragEdit} selected />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>,
    document.body,
  );
}
