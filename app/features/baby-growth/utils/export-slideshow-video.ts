/** 클라이언트에서 슬라이드쇼 WebM을 만들어 다운로드한다 (아기 앨범 전용). */

async function loadImage(
  src: string,
  objectUrls: string[],
): Promise<HTMLImageElement> {
  // same-origin/인증 프록시 URL은 fetch→blob 로 CORS taint 를 피한다
  let objectUrl: string | null = null;
  try {
    const res = await fetch(src, { credentials: 'include' });
    if (!res.ok) throw new Error('image fetch failed');
    const blob = await res.blob();
    objectUrl = URL.createObjectURL(blob);
    objectUrls.push(objectUrl);
  } catch {
    objectUrl = null;
  }
  const url = objectUrl ?? src;
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!objectUrl) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  alpha: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let dw = w;
  let dh = h;
  let dx = 0;
  let dy = 0;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
  } else {
    dw = w;
    dh = w / ir;
    dy = (h - dh) / 2;
  }
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  return '';
}

export async function exportSlideshowVideo(opts: {
  urls: string[];
  intervalMs: number;
  effect: 'fade' | 'slide';
  fileName?: string;
  onProgress?: (ratio: number) => void;
}): Promise<void> {
  if (opts.urls.length === 0) throw new Error('no photos');
  const mime = pickMime();
  if (!mime) throw new Error('MediaRecorder unsupported');

  const w = 1280;
  const h = 720;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');

  const objectUrls: string[] = [];
  try {
  const images = await Promise.all(opts.urls.map((url) => loadImage(url, objectUrls)));
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    recorder.onerror = () => reject(new Error('record failed'));
  });

  recorder.start(200);

  const fadeMs = Math.min(400, Math.floor(opts.intervalMs * 0.35));
  const holdMs = Math.max(200, opts.intervalMs - fadeMs);

  for (let i = 0; i < images.length; i += 1) {
    const img = images[i]!;
    const prev = i > 0 ? images[i - 1]! : null;
    opts.onProgress?.(i / images.length);

    if (opts.effect === 'fade' && prev) {
      const steps = Math.max(8, Math.floor(fadeMs / 33));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        drawCover(ctx, prev, w, h, 1 - t);
        drawCover(ctx, img, w, h, t);
        await new Promise((r) => setTimeout(r, fadeMs / steps));
      }
    } else if (opts.effect === 'slide' && prev) {
      const steps = Math.max(8, Math.floor(fadeMs / 33));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.translate(-w * t, 0);
        drawCover(ctx, prev, w, h, 1);
        ctx.restore();
        ctx.save();
        ctx.translate(w * (1 - t), 0);
        drawCover(ctx, img, w, h, 1);
        ctx.restore();
        await new Promise((r) => setTimeout(r, fadeMs / steps));
      }
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      drawCover(ctx, img, w, h, 1);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    drawCover(ctx, img, w, h, 1);
    await new Promise((r) => setTimeout(r, holdMs));
  }

  opts.onProgress?.(1);
  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());

  const blob = await done;
  if (blob.size === 0) throw new Error('empty video');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.fileName ?? `baby-collection-${Date.now()}.webm`;
  a.click();
  // click 직후 revoke 하면 일부 브라우저에서 다운로드가 끊김
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } finally {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }
}
