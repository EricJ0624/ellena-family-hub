/** 인쇄용 앨범 PDF를 기기 로컬에만 저장 (S3·그룹 GB 미포함). */

import { jsPDF } from 'jspdf';
import type { BabyPhoto, BabyPrintAlbum, BabyPrintPhotoEdit, BabyPrintPhotoSize } from '../types';

type PrintBgKey = BabyPrintAlbum['bg'];
type PrintLayout = BabyPrintAlbum['layout'];
type PrintItem = BabyPhoto & { edit: BabyPrintPhotoEdit };

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

const PRINT_BG: Record<PrintBgKey, string> = {
  cream: '#f3e8d4',
  blush: '#fde8e4',
  sage: '#e4eee0',
  sky: '#e2eef6',
};

function pageSizeFor(layout: PrintLayout): number {
  if (layout === 'grid3') return 9;
  if (layout === 'hero') return 5;
  return 6;
}

function chunkPhotos<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

async function loadImageDataUrl(src: string): Promise<string> {
  try {
    const res = await fetch(src, { credentials: 'include' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    // fallback: try direct (may taint / fail)
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0);
        try {
          resolve(c.toDataURL('image/jpeg', 0.92));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = x + (w - dw) / 2;
  } else {
    dw = w;
    dh = w / ir;
    dy = y + (h - dh) / 2;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

async function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

/** PC는 가능하면 저장 위치 선택, 그 외·스마트폰은 다운로드 */
export async function saveBlobLocally(blob: Blob, fileName: string): Promise<void> {
  const w = window as SaveFilePickerWindow;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cellRects(
  layout: PrintLayout,
  count: number,
  x: number,
  y: number,
  w: number,
  h: number,
  gap: number,
): Array<{ x: number; y: number; w: number; h: number }> {
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  if (layout === 'hero') {
    const heroH = (h - gap * 2) * (1.35 / 3.35);
    const restH = (h - gap * 2 - heroH) / 2;
    const colW = (w - gap) / 2;
    rects.push({ x, y, w, h: heroH });
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 2; c += 1) {
        if (rects.length >= count) break;
        rects.push({
          x: x + c * (colW + gap),
          y: y + heroH + gap + r * (restH + gap),
          w: colW,
          h: restH,
        });
      }
    }
    return rects.slice(0, count);
  }
  const cols = layout === 'grid3' ? 3 : 2;
  const rows = Math.ceil(count / cols) || 1;
  const cellW = (w - gap * (cols - 1)) / cols;
  const cellH = (h - gap * (rows - 1)) / rows;
  for (let i = 0; i < count; i += 1) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    rects.push({
      x: x + c * (cellW + gap),
      y: y + r * (cellH + gap),
      w: cellW,
      h: cellH,
    });
  }
  return rects;
}

export async function exportPrintAlbumPdf(opts: {
  title: string;
  items: PrintItem[];
  bg: PrintBgKey;
  layout: PrintLayout;
  photoSize: BabyPrintPhotoSize;
  showCaptions: boolean;
  monthLabel: (n: number) => string;
  fileName?: string;
  onProgress?: (ratio: number) => void;
}): Promise<void> {
  if (opts.items.length === 0) throw new Error('no photos');

  const paper = PRINT_PHOTO_SIZES[opts.photoSize];
  const pages = chunkPhotos(opts.items, pageSizeFor(opts.layout));
  const pdf = new jsPDF({
    unit: 'mm',
    format: [paper.wMm, paper.hMm],
    orientation: paper.wMm >= paper.hMm ? 'landscape' : 'portrait',
  });

  const margin = paper.marginMm;
  const gap = 2.5;
  const headerH = 8;
  const captionH = opts.showCaptions ? 4 : 0;
  const dpi = 2; // canvas sharpness
  const bg = PRINT_BG[opts.bg];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx += 1) {
    opts.onProgress?.(pageIdx / pages.length);
    if (pageIdx > 0) pdf.addPage([paper.wMm, paper.hMm], paper.wMm >= paper.hMm ? 'landscape' : 'portrait');

    const page = pages[pageIdx]!;
    const contentW = paper.wMm - margin * 2;
    const contentH = paper.hMm - margin * 2;
    const gridY = margin + headerH;
    const gridH = contentH - headerH - 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(paper.wMm * 96 * dpi / 25.4);
    canvas.height = Math.round(paper.hMm * 96 * dpi / 25.4);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unsupported');

    const sx = canvas.width / paper.wMm;
    const sy = canvas.height / paper.hMm;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#4a3f35';
    ctx.font = `bold ${Math.round(4.2 * sx)}px "Segoe UI", "Apple SD Gothic Neo", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(opts.title, margin * sx, margin * sy);
    ctx.font = `${Math.round(2.8 * sx)}px "Segoe UI", "Apple SD Gothic Neo", sans-serif`;
    ctx.globalAlpha = 0.55;
    const pageLabel = `${pageIdx + 1}/${pages.length}`;
    const labelW = ctx.measureText(pageLabel).width;
    ctx.fillText(pageLabel, canvas.width - margin * sx - labelW, margin * sy);
    ctx.globalAlpha = 1;

    const rects = cellRects(opts.layout, page.length, margin, gridY, contentW, gridH, gap);

    for (let i = 0; i < page.length; i += 1) {
      const photo = page[i]!;
      const rect = rects[i];
      if (!rect) continue;
      const photoH = Math.max(4, rect.h - captionH);
      const px = rect.x * sx;
      const py = rect.y * sy;
      const pw = rect.w * sx;
      const ph = photoH * sy;

      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillRect(px, py, pw, ph);

      try {
        const dataUrl = await loadImageDataUrl(photo.imageUrl);
        const img = await dataUrlToImage(dataUrl);
        ctx.save();
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate((photo.edit.rotation * Math.PI) / 180);
        drawCover(ctx, img, -pw / 2, -ph / 2, pw, ph);
        ctx.restore();
      } catch {
        ctx.fillStyle = '#ccc';
        ctx.fillRect(px, py, pw, ph);
      }

      if (opts.showCaptions && photo.monthAge != null) {
        ctx.fillStyle = 'rgba(74,63,53,0.7)';
        ctx.font = `600 ${Math.round(2.6 * sx)}px "Segoe UI", "Apple SD Gothic Neo", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
          opts.monthLabel(photo.monthAge),
          px + pw / 2,
          py + ph + 1.2 * sy,
        );
        ctx.textAlign = 'left';
      }
    }

    const jpeg = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(jpeg, 'JPEG', 0, 0, paper.wMm, paper.hMm);
  }

  opts.onProgress?.(1);
  const blob = pdf.output('blob');
  const safeTitle = opts.title.trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'baby-album';
  await saveBlobLocally(blob, opts.fileName ?? `${safeTitle}.pdf`);
}
