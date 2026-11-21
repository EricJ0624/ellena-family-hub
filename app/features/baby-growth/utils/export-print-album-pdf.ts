/** 인쇄용 앨범 PDF를 기기 로컬에만 저장 (S3·그룹 GB 미포함). */

import { jsPDF } from 'jspdf';
import type { BabyPhoto, BabyPrintAlbum, BabyPrintPhotoEdit, BabyPrintPhotoSize } from '../types';
import {
  FRAME_SCALE_MIN,
  FRAME_SCALE_X_MAX,
  FRAME_SCALE_Y_MAX,
  PRINT_PHOTO_SIZES,
  chunkPhotos,
  pageSizeFor,
} from './print-frame-box';
import {
  fillPrintPaperBackground,
  printBgPatternUrl,
  type PrintBgKey,
} from './print-album-bg';

type PrintLayout = BabyPrintAlbum['layout'];
type PrintItem = BabyPhoto & { edit: BabyPrintPhotoEdit };

/** 보통 4×6 세로를 기준으로 글자·간격을 용지 높이에 비례시킨다. */
const STD_PAGE_H_MM = PRINT_PHOTO_SIZES.std_4x6.hMm;
/** 화면 카드 안쪽 여백과 같은 비율. 용지마다 mm를 고정하면 미니 사진이 더 작아진다. */
const PAGE_INSET_RATIO = 0.024;

/** 화면 <img>용 302는 유지하고, 캔버스에 그릴 때만 같은 출처 바이트를 받는다. */
function canvasImageUrl(src: string): string {
  if (!src.startsWith('/api/media/file')) return src;
  if (/[?&]raw=1(?:&|$)/.test(src)) return src;
  return `${src}${src.includes('?') ? '&' : '?'}raw=1`;
}

async function loadImageElement(src: string): Promise<{ img: HTMLImageElement; done: () => void }> {
  const res = await fetch(canvasImageUrl(src), { credentials: 'include' });
  if (!res.ok) throw new Error('image fetch failed');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = objectUrl;
    });
    return { img, done: () => URL.revokeObjectURL(objectUrl) };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** 에디터와 동일: zoom 1=cover, 1 미만은 cover보다 작게(원본이 더 보임). 빈 칸만 블러 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  focusX = 50,
  focusY = 50,
  zoom = 1,
) {
  const ir = img.naturalWidth / Math.max(1, img.naturalHeight);
  const z = clampNum(zoom, 0.35, 4);
  const fx = clampNum(focusX, 0, 100) / 100;
  const fy = clampNum(focusY, 0, 100) / 100;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (z < 1) {
    const cr = w / Math.max(1, h);
    let bdw: number;
    let bdh: number;
    if (ir > cr) {
      bdh = h * 1.2;
      bdw = bdh * ir;
    } else {
      bdw = w * 1.2;
      bdh = bdw / ir;
    }
    ctx.save();
    ctx.filter = 'blur(12px)';
    ctx.drawImage(img, x + (w - bdw) / 2, y + (h - bdh) / 2, bdw, bdh);
    ctx.restore();
  }

  const cr = w / Math.max(1, h);
  let coverW: number;
  let coverH: number;
  if (ir > cr) {
    coverH = h;
    coverW = h * ir;
  } else {
    coverW = w;
    coverH = w / ir;
  }
  const dw = coverW * z;
  const dh = coverH * z;
  const cx = x + w * fx;
  const cy = y + h * fy;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function layoutMetrics(paper: { wMm: number; hMm: number }, showCaptions: boolean) {
  const scale = paper.hMm / STD_PAGE_H_MM;
  return {
    margin: paper.wMm * PAGE_INSET_RATIO,
    gap: 2.5 * scale,
    headerH: 8 * scale,
    captionH: showCaptions ? 4 * scale : 0,
    titleMm: 4.2 * scale,
    pageNumMm: 2.8 * scale,
    captionMm: 2.6 * scale,
    captionGapMm: 1.2 * scale,
  };
}

function fitCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}${ellipsis}`).width > maxWidth) end -= 1;
  return end > 0 ? `${text.slice(0, end)}${ellipsis}` : '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
async function saveBlobLocally(blob: Blob, fileName: string): Promise<void> {
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

type PrintFrame = BabyPrintPhotoEdit['frame'];

/** 프레임 중심이 원점인 상태에서 마스크 경로. 에디터 clip-path와 같은 비율. */
function traceFrame(ctx: CanvasRenderingContext2D, frame: PrintFrame, w: number, h: number) {
  const px = (u: number) => -w / 2 + u * w;
  const py = (v: number) => -h / 2 + v * h;
  ctx.beginPath();
  if (frame === 'round') {
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (frame === 'diamond') {
    ctx.moveTo(px(0.5), py(0));
    ctx.lineTo(px(1), py(0.5));
    ctx.lineTo(px(0.5), py(1));
    ctx.lineTo(px(0), py(0.5));
    ctx.closePath();
    return;
  }
  if (frame === 'hex') {
    const pts: Array<[number, number]> = [
      [0.5, 0],
      [0.93, 0.25],
      [0.93, 0.75],
      [0.5, 1],
      [0.07, 0.75],
      [0.07, 0.25],
    ];
    pts.forEach(([u, v], i) => (i === 0 ? ctx.moveTo(px(u), py(v)) : ctx.lineTo(px(u), py(v))));
    ctx.closePath();
    return;
  }
  if (frame === 'heart') {
    const pts: Array<[number, number]> = [
      [0.5, 1],
      [0.12, 0.5385],
      [0.08, 0.2308],
      [0.22, 0],
      [0.4, 0.0256],
      [0.5, 0.2308],
      [0.6, 0.0256],
      [0.78, 0],
      [0.92, 0.2308],
      [0.88, 0.5385],
    ];
    pts.forEach(([u, v], i) => (i === 0 ? ctx.moveTo(px(u), py(v)) : ctx.lineTo(px(u), py(v))));
    ctx.closePath();
    return;
  }
  if (frame === 'heart_soft') {
    ctx.moveTo(px(0.5), py(1));
    ctx.bezierCurveTo(px(0.5), py(1), px(0.02), py(0.614), px(0.02), py(0.318));
    ctx.bezierCurveTo(px(0.02), py(0.114), px(0.16), py(0), px(0.31), py(0));
    ctx.bezierCurveTo(px(0.4), py(0), px(0.46), py(0.057), px(0.5), py(0.136));
    ctx.bezierCurveTo(px(0.54), py(0.057), px(0.6), py(0), px(0.69), py(0));
    ctx.bezierCurveTo(px(0.84), py(0), px(0.98), py(0.114), px(0.98), py(0.318));
    ctx.bezierCurveTo(px(0.98), py(0.614), px(0.5), py(1), px(0.5), py(1));
    ctx.closePath();
    return;
  }
  const radius = Math.min(w, h) * 0.06;
  if (frame === 'rect' && typeof ctx.roundRect === 'function') {
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    return;
  }
  ctx.rect(-w / 2, -h / 2, w, h);
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
  const cols = layout === 'grid1' ? 1 : layout === 'grid3' ? 3 : 2;
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

type AlbumPageOpts = {
  title: string;
  items: PrintItem[];
  bg: PrintBgKey;
  layout: PrintLayout;
  photoSize: BabyPrintPhotoSize;
  showCaptions: boolean;
  monthLabel: (n: number) => string;
  onProgress?: (ratio: number) => void;
};

function waitForPrintImages(imgs: HTMLImageElement[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (imgs.length === 0) {
      reject(new Error('print image failed'));
      return;
    }
    let settled = false;
    let pending = imgs.length;
    const finish = (ok: boolean) => {
      if (settled) return;
      if (!ok) {
        settled = true;
        window.clearTimeout(timer);
        reject(new Error('print image failed'));
        return;
      }
      pending -= 1;
      if (pending > 0) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(() => finish(false), 15000);
    for (const img of imgs) {
      if (img.complete) {
        finish(img.naturalWidth > 0);
        continue;
      }
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
    }
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('canvas'));
      else resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

/** 인쇄와 PDF가 같이 쓰는 용지 페이지. 여백은 페이지 안에 한 번만 들어간다. */
async function renderPrintAlbumCanvases(opts: AlbumPageOpts): Promise<HTMLCanvasElement[]> {
  if (opts.items.length === 0) throw new Error('no photos');

  const paper = PRINT_PHOTO_SIZES[opts.photoSize];
  const metrics = layoutMetrics(paper, opts.showCaptions);
  const pages = chunkPhotos(opts.items, pageSizeFor(opts.layout));
  const dpi = 2;
  const canvases: HTMLCanvasElement[] = [];

  let patternImg: HTMLImageElement | null = null;
  let releasePattern: (() => void) | null = null;
  try {
    const loaded = await loadImageElement(printBgPatternUrl(opts.bg));
    patternImg = loaded.img;
    releasePattern = loaded.done;
  } catch {
    patternImg = null;
  }

  try {
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx += 1) {
      opts.onProgress?.(pageIdx / pages.length);
      const page = pages[pageIdx]!;
      const contentW = paper.wMm - metrics.margin * 2;
      const contentH = paper.hMm - metrics.margin * 2;
      const gridY = metrics.margin + metrics.headerH;
      const gridH = contentH - metrics.headerH - metrics.captionGapMm;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round((paper.wMm * 96 * dpi) / 25.4);
      canvas.height = Math.round((paper.hMm * 96 * dpi) / 25.4);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unsupported');

      const sx = canvas.width / paper.wMm;
      const sy = canvas.height / paper.hMm;

      fillPrintPaperBackground(ctx, canvas.width, canvas.height, opts.bg, patternImg);

      ctx.fillStyle = '#4a3f35';
      ctx.textBaseline = 'top';
      ctx.font = `${Math.round(metrics.pageNumMm * sx)}px "Segoe UI", "Apple SD Gothic Neo", sans-serif`;
      const pageLabel = `${pageIdx + 1}/${pages.length}`;
      const labelW = ctx.measureText(pageLabel).width;
      ctx.font = `bold ${Math.round(metrics.titleMm * sx)}px "Segoe UI", "Apple SD Gothic Neo", sans-serif`;
      const titleMax = canvas.width - metrics.margin * sx * 2 - labelW - 2 * sx;
      ctx.fillText(fitCanvasText(ctx, opts.title, titleMax), metrics.margin * sx, metrics.margin * sy);
      ctx.font = `${Math.round(metrics.pageNumMm * sx)}px "Segoe UI", "Apple SD Gothic Neo", sans-serif`;
      ctx.globalAlpha = 0.55;
      ctx.fillText(pageLabel, canvas.width - metrics.margin * sx - labelW, metrics.margin * sy);
      ctx.globalAlpha = 1;

      const rects = cellRects(opts.layout, page.length, metrics.margin, gridY, contentW, gridH, metrics.gap);

      for (let i = 0; i < page.length; i += 1) {
        const photo = page[i]!;
        const rect = rects[i];
        if (!rect) continue;
        const photoH = Math.max(0, rect.h - metrics.captionH);
        const px = rect.x * sx;
        const py = rect.y * sy;
        const pw = rect.w * sx;
        const ph = photoH * sy;
        // 화면과 같게: 프레임 크기는 칸 너비 기준이고, 칸 안에서 가운데 정렬된다.
        const scaleX = clampNum(photo.edit.frameScaleX ?? 1, FRAME_SCALE_MIN, FRAME_SCALE_X_MAX);
        const scaleY = clampNum(photo.edit.frameScaleY ?? 1, FRAME_SCALE_MIN, FRAME_SCALE_Y_MAX);
        const fw = pw * scaleX;
        const fh = fw * (scaleY / Math.max(scaleX, 0.01));

        const loaded = await loadImageElement(photo.imageUrl);
        try {
          const img = loaded.img;
          const frameRot = ((photo.edit.frameRotation ?? 0) * Math.PI) / 180;
          const photoRot = (photo.edit.rotation * Math.PI) / 180;
          ctx.save();
          ctx.beginPath();
          ctx.rect(px, py, pw, ph);
          ctx.clip();
          ctx.translate(px + pw / 2, py + ph / 2);
          ctx.rotate(frameRot);
          traceFrame(ctx, photo.edit.frame, fw, fh);
          ctx.fillStyle = 'rgba(255,255,255,0.72)';
          ctx.fill();
          ctx.save();
          traceFrame(ctx, photo.edit.frame, fw, fh);
          ctx.clip();
          ctx.rotate(photoRot);
          drawCover(
            ctx,
            img,
            -fw / 2,
            -fh / 2,
            fw,
            fh,
            photo.edit.focusX ?? 50,
            photo.edit.focusY ?? 50,
            photo.edit.zoom ?? 1,
          );
          ctx.restore();
          traceFrame(ctx, photo.edit.frame, fw, fh);
          ctx.lineWidth = Math.max(1, 0.35 * sx);
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.stroke();
          ctx.restore();
        } finally {
          loaded.done();
        }

        if (opts.showCaptions && photo.monthAge != null) {
          ctx.fillStyle = 'rgba(74,63,53,0.7)';
          ctx.font = `600 ${Math.round(metrics.captionMm * sx)}px "Segoe UI", "Apple SD Gothic Neo", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(opts.monthLabel(photo.monthAge), px + pw / 2, py + ph + metrics.captionGapMm * sy);
          ctx.textAlign = 'left';
        }
      }

      canvases.push(canvas);
    }

    opts.onProgress?.(1);
    return canvases;
  } finally {
    releasePattern?.();
  }
}

/**
 * 같은 페이지 그림을 선택한 용지 크기로 인쇄한다.
 * Android Chrome은 hidden iframe print 시 상위(앱) 문서를 미리보는 경우가 있어
 * 앨범 HTML만 담은 새 창에서 print() 한다. (사용자 제스처 유지를 위해 창은 먼저 연다)
 */
export async function printPrintAlbum(opts: AlbumPageOpts): Promise<void> {
  const paper = PRINT_PHOTO_SIZES[opts.photoSize];

  // popup blocker: await 전에 빈 창을 연다
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('print window blocked');
  }

  const urls: string[] = [];
  let cleaned = false;
  let safetyTimer = 0;
  let afterPrintTimer = 0;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (safetyTimer) window.clearTimeout(safetyTimer);
    if (afterPrintTimer) window.clearTimeout(afterPrintTimer);
    urls.forEach((url) => URL.revokeObjectURL(url));
    try {
      win.close();
    } catch {
      /* ignore */
    }
  };

  try {
    win.document.open();
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(opts.title)}</title></head>` +
        `<body style="margin:0;font-family:sans-serif;padding:24px;color:#64748b;">Preparing print…</body></html>`,
    );
    win.document.close();

    const canvases = await renderPrintAlbumCanvases(opts);
    const blobs = await Promise.all(canvases.map((canvas) => canvasToJpegBlob(canvas)));
    urls.push(...blobs.map((blob) => URL.createObjectURL(blob)));

    const images = urls.map((url) => `<img src="${url}" alt="" />`).join('');
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(opts.title)}</title>
<style>
  @page { size: ${paper.wMm}mm ${paper.hMm}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  img { display: block; width: ${paper.wMm}mm; height: ${paper.hMm}mm; page-break-after: always; break-after: page; }
  img:last-child { page-break-after: auto; break-after: auto; }
</style></head><body>${images}</body></html>`);
    win.document.close();

    const imgs = Array.from(win.document.images);
    await waitForPrintImages(imgs);

    // Android는 afterprint가 print() 직후 오기도 함 → 너무 이른 revoke/close 방지
    const printStartedAt = Date.now();
    const onAfterPrint = () => {
      win.removeEventListener('afterprint', onAfterPrint);
      const elapsed = Date.now() - printStartedAt;
      const delayMs = elapsed < 800 ? 60_000 : 1_500;
      afterPrintTimer = window.setTimeout(cleanup, delayMs);
    };
    win.addEventListener('afterprint', onAfterPrint);
    safetyTimer = window.setTimeout(cleanup, 180_000);

    win.focus();
    win.print();
  } catch (err) {
    cleanup();
    throw err;
  }
}

export async function exportPrintAlbumPdf(opts: AlbumPageOpts & {
  fileName?: string;
  /** false면 저장 대화상자 없이 Blob만 돌려준다. 공유 버튼용. */
  save?: boolean;
}): Promise<Blob> {
  const paper = PRINT_PHOTO_SIZES[opts.photoSize];
  const canvases = await renderPrintAlbumCanvases(opts);
  const pdf = new jsPDF({
    unit: 'mm',
    format: [paper.wMm, paper.hMm],
    orientation: paper.wMm >= paper.hMm ? 'landscape' : 'portrait',
  });

  canvases.forEach((canvas, pageIdx) => {
    if (pageIdx > 0) {
      pdf.addPage([paper.wMm, paper.hMm], paper.wMm >= paper.hMm ? 'landscape' : 'portrait');
    }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, paper.wMm, paper.hMm);
  });

  const blob = pdf.output('blob');
  const safeTitle = opts.title.trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'baby-album';
  if (opts.save !== false) {
    await saveBlobLocally(blob, opts.fileName ?? `${safeTitle}.pdf`);
  }
  return blob;
}
