'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { BabyPhoto, BabyPrintAlbum, BabyPrintPhotoEdit } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

type PrintBgKey = BabyPrintAlbum['bg'];
type PrintLayout = BabyPrintAlbum['layout'];
type PrintFrame = BabyPrintPhotoEdit['frame'];
type PhotoEdit = BabyPrintPhotoEdit;
type FlashTarget = 'device' | 'family' | null;

type DraftV1 = {
  v: 1;
  title: string;
  bg: PrintBgKey;
  layout: PrintLayout;
  showCaptions: boolean;
  order: string[];
  edits: Record<string, PhotoEdit>;
};

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

function draftKey(babyId: string) {
  return `sfh_baby_print_album_${babyId}`;
}

function normDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

function defaultEdit(): PhotoEdit {
  return { included: true, frame: 'rect', rotation: 0 };
}

function chunkPhotos<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

function pageSizeFor(layout: PrintLayout): number {
  if (layout === 'grid3') return 9;
  if (layout === 'hero') return 5;
  return 6;
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
  @page { size: A4 portrait; margin: 12mm; }
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
    .page { min-height: auto; height: 273mm; }
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
          style={clip === 'none' ? undefined : { clipPath: clip }}
        />
      </div>
      {!edit.included ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11px] font-bold text-white">
          —
        </div>
      ) : null}
    </div>
  );
}

function applyDraftToState(
  draft: {
    title?: string;
    bg?: string;
    layout?: string;
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
  const [showCaptions, setShowCaptions] = useState(true);
  const [order, setOrder] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, PhotoEdit>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flashTarget, setFlashTarget] = useState<FlashTarget>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [familyAlbums, setFamilyAlbums] = useState<BabyPrintAlbum[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
        'id, group_id, baby_id, created_by, title, bg, layout, show_captions, photo_order, photo_edits, created_at, updated_at',
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
      setShowCaptions(true);
      const initial = mergePhotoState(currentPhotos, currentPhotos.map((p) => p.id), {});
      setOrder(initial.order);
      setEdits(initial.edits);
      setActiveId(initial.order[0] ?? null);
      setActiveAlbumId(null);
      setListOpen(false);
      setFlashTarget(null);
      try {
        setHasDraft(Boolean(localStorage.getItem(draftKey(babyId))));
      } catch {
        setHasDraft(false);
      }
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

  const patchEdit = (id: string, patch: Partial<PhotoEdit>) => {
    setEdits((prev) => {
      const base = prev[id] ?? defaultEdit();
      const next = { ...base, ...patch };
      if (typeof next.rotation === 'number') next.rotation = normDeg(next.rotation);
      return { ...prev, [id]: next };
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx]!;
      copy[idx] = copy[next]!;
      copy[next] = tmp;
      return copy;
    });
  };

  const saveDraft = () => {
    const draft: DraftV1 = {
      v: 1,
      title: title.trim() || defaultTitle,
      bg,
      layout,
      showCaptions,
      order,
      edits,
    };
    try {
      localStorage.setItem(draftKey(babyId), JSON.stringify(draft));
      setHasDraft(true);
      flash('device');
    } catch {
      /* ignore */
    }
  };

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey(babyId));
      if (!raw) return;
      const draft = JSON.parse(raw) as DraftV1;
      if (draft?.v !== 1) return;
      applyDraftToState(draft, photosRef.current, defaultTitle, {
        setTitle,
        setBg,
        setLayout,
        setShowCaptions,
        setOrder,
        setEdits,
        setActiveId,
      });
      setActiveAlbumId(null);
    } catch {
      /* ignore */
    }
  };

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
        showCaptions: album.show_captions,
        order: album.photo_order,
        edits: album.photo_edits as Record<string, unknown>,
      },
      photosRef.current,
      defaultTitle,
      { setTitle, setBg, setLayout, setShowCaptions, setOrder, setEdits, setActiveId },
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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black/50">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl sm:my-3 sm:h-[min(94dvh,56rem)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3 className="m-0 text-sm font-bold text-slate-800">{t.album_print}</h3>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {currentGroupId ? (
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {t.album_print_family_list}
                {familyAlbums.length > 0 ? ` (${familyAlbums.length})` : ''}
              </button>
            ) : null}
            {hasDraft ? (
              <button
                type="button"
                onClick={loadDraft}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {t.album_print_load}
              </button>
            ) : null}
            <button
              type="button"
              onClick={saveDraft}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {flashTarget === 'device' ? t.album_print_saved : t.album_print_device}
            </button>
            {currentGroupId ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void saveFamily();
                }}
                className="rounded-full bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {flashTarget === 'family' ? t.album_print_saved : t.album_print_save_family}
              </button>
            ) : null}
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

            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() =>
                  setEdits((prev) =>
                    Object.fromEntries(
                      Object.keys(prev).map((id) => [id, { ...prev[id]!, included: true }]),
                    ),
                  )
                }
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                {t.album_print_select_all}
              </button>
              <button
                type="button"
                onClick={() =>
                  setEdits((prev) =>
                    Object.fromEntries(
                      Object.keys(prev).map((id) => [id, { ...prev[id]!, included: false }]),
                    ),
                  )
                }
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                {t.album_print_clear}
              </button>
              <button
                type="button"
                disabled={selectedItems.length === 0}
                onClick={() =>
                  runPrintAlbum({
                    title: title.trim() || defaultTitle,
                    items: selectedItems,
                    bg,
                    layout,
                    showCaptions,
                    monthLabel,
                  })
                }
                className="rounded-full bg-amber-500 px-3.5 py-1 text-[11px] font-bold text-white hover:bg-amber-600 disabled:opacity-40"
              >
                {t.album_print_action}
              </button>
            </div>
          </div>

          {active && activeEdit ? (
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
              <button
                type="button"
                onClick={() => move(active.id, -1)}
                className="rounded-md bg-white px-2 py-1 text-xs font-bold ring-1 ring-slate-200"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(active.id, 1)}
                className="rounded-md bg-white px-2 py-1 text-xs font-bold ring-1 ring-slate-200"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => patchEdit(active.id, { included: !activeEdit.included })}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  activeEdit.included
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {activeEdit.included ? '−' : '+'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-4">
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
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setActiveId(photo.id)}
                        className={`m-0 flex min-w-0 flex-col gap-1 border-0 bg-transparent p-0 text-left ${
                          layout === 'hero' && idx === 0 ? 'col-span-2' : ''
                        }`}
                      >
                        <FramedPhoto
                          photo={photo}
                          edit={photo.edit}
                          selected={activeId === photo.id}
                        />
                        {showCaptions && photo.monthAge !== null ? (
                          <span className="text-center text-[10px] font-semibold text-[#8a7355]">
                            {monthLabel(photo.monthAge)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div className="mx-auto mt-4 max-w-2xl">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {orderedPhotos.map((photo) => {
                const edit = edits[photo.id] ?? defaultEdit();
                return (
                  <button
                    key={`tray-${photo.id}`}
                    type="button"
                    onClick={() => setActiveId(photo.id)}
                    className="border-0 bg-transparent p-0"
                  >
                    <FramedPhoto photo={photo} edit={edit} selected={activeId === photo.id} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
