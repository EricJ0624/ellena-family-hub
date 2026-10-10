import { supabase } from '@/lib/supabase';
import { assignFaceDifferences, layoutFace, type FaceGrid } from './spot-diff-face';
import {
  classifySpotSurface,
  paintSpotSprite,
  pickSpotSprite,
  type RegionAppearance,
} from './spot-diff-sprites';
import type { NormalizedRegion } from './types';

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l < 0.5 ? d / (max + min) : d / (2 - max - min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function isSkinRgb(r255: number, g255: number, b255: number): boolean {
  return r255 > 95 && g255 > 40 && b255 > 20 && r255 > g255 && r255 > b255 && Math.abs(r255 - g255) > 15 && r255 - b255 > 15;
}

function isSkinTone(r255: number, g255: number, b255: number, saturation: number, lightness: number): boolean {
  return isSkinRgb(r255, g255, b255) && saturation >= 0.12 && saturation <= 0.58 && lightness >= 0.25 && lightness <= 0.9;
}

function isSkinPixel(r255: number, g255: number, b255: number): boolean {
  const { s, l } = rgbToHsl(r255 / 255, g255 / 255, b255 / 255);
  return isSkinTone(r255, g255, b255, s, l);
}

/**
 * 원 안의 색·살색 비율·밝기 흔들림을 읽는다.
 * 그림을 고르기 전에 호출해야 원본 기준으로 종류를 정한다.
 */
function sampleRegionAppearance(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  yNorm: number,
): RegionAppearance {
  const empty: RegionAppearance = {
    y: yNorm,
    hue: 0,
    saturation: 0,
    lightness: 0,
    skinRatio: 0,
    lightnessStd: 0,
  };
  const x0 = Math.max(0, Math.round(cx - radius));
  const y0 = Math.max(0, Math.round(cy - radius));
  const bw = Math.min(ctx.canvas.width - x0, Math.round(radius * 2));
  const bh = Math.min(ctx.canvas.height - y0, Math.round(radius * 2));
  if (bw <= 0 || bh <= 0) return empty;

  const data = ctx.getImageData(x0, y0, bw, bh).data;
  const boxCx = cx - x0;
  const boxCy = cy - y0;
  const r2 = radius * radius;

  let totalSat = 0;
  let totalL = 0;
  let totalL2 = 0;
  let count = 0;
  let skin = 0;
  let sumSin = 0;
  let sumCos = 0;
  let chroma = 0;

  for (let py = 0; py < bh; py += 1) {
    for (let px = 0; px < bw; px += 1) {
      const dx = px - boxCx;
      const dy = py - boxCy;
      if (dx * dx + dy * dy > r2) continue;

      const i = (py * bw + px) * 4;
      const r255 = data[i];
      const g255 = data[i + 1];
      const b255 = data[i + 2];
      const { h, s, l } = rgbToHsl(r255 / 255, g255 / 255, b255 / 255);
      const l255 = l * 255;

      totalSat += s;
      totalL += l255;
      totalL2 += l255 * l255;
      count += 1;
      if (isSkinTone(r255, g255, b255, s, l)) skin += 1;
      if (s > 0.12) {
        const rad = (h * Math.PI) / 180;
        sumSin += Math.sin(rad) * s;
        sumCos += Math.cos(rad) * s;
        chroma += s;
      }
    }
  }

  if (count === 0) return empty;
  const meanL = totalL / count;
  const variance = Math.max(0, totalL2 / count - meanL * meanL);
  const hue = chroma > 0 ? (Math.atan2(sumSin, sumCos) * 180) / Math.PI : 0;

  return {
    y: yNorm,
    hue: hue < 0 ? hue + 360 : hue,
    saturation: totalSat / count,
    lightness: meanL / 255,
    skinRatio: skin / count,
    lightnessStd: Math.sqrt(variance),
  };
}

/**
 * 비교 이미지를 만든다.
 * 정면이고 귀가 화면 안에 있으면 안경·귀걸이·점을 나누고, 귀가 잘렸으면 안경과 점만 둔다.
 * 옆모습은 점만 둔다. 얼굴 밖은 그 자리의 장면 그림을 둔다.
 *
 * SVG 파일 대응: naturalWidth/naturalHeight가 0인 경우(viewBox만 있는 SVG)
 * 800×600 폴백을 사용해 canvas가 0×0이 되는 문제를 방지한다.
 */
export async function generateSpotDiffVariantDataUrl(
  imageUrl: string,
  regions: NormalizedRegion[],
): Promise<{ url: string; regions: NormalizedRegion[] }> {
  const img = await loadImageForCanvas(imageUrl);
  const canvas = document.createElement('canvas');

  const W = img.naturalWidth || img.width || 800;
  const H = img.naturalHeight || img.height || 600;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  ctx.drawImage(img, 0, 0, W, H);

  const appearances = regions.map((region) => {
    const radius = region.r * Math.min(W, H);
    return sampleRegionAppearance(ctx, region.x * W, region.y * H, radius, region.y);
  });
  const surfaces = appearances.map((appearance) => classifySpotSurface(appearance));
  const placed = assignFaceDifferences(regions, layoutFace(sampleFaceGrid(ctx, W, H)));

  placed.regions.forEach((region, index) => {
    const cx = region.x * W;
    const cy = region.y * H;
    const radius = region.r * Math.min(W, H);
    const faceKind = placed.faceKinds[index];
    const surface = surfaces[index];
    if (faceKind) {
      paintSpotSprite(ctx, faceKind, cx, cy, radius, index);
      return;
    }
    if (surface === 'skin') {
      paintSpotSprite(ctx, 'mole', cx, cy, radius, index);
      return;
    }
    paintSpotSprite(ctx, pickSpotSprite(surface, index), cx, cy, radius, index);
  });

  return { url: canvas.toDataURL('image/jpeg', 0.92), regions: placed.regions };
}

function sampleFaceGrid(ctx: CanvasRenderingContext2D, width: number, height: number): FaceGrid {
  const stride = width * height > 2_000_000 ? 6 : 4;
  const cols = Math.max(1, Math.floor(width / stride));
  const rows = Math.max(1, Math.floor(height / stride));
  const skin = new Uint8Array(cols * rows);
  const lum = new Uint8Array(cols * rows);
  const data = ctx.getImageData(0, 0, width, height).data;

  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const px = Math.min(width - 1, gx * stride);
      const py = Math.min(height - 1, gy * stride);
      const i = (py * width + px) * 4;
      const idx = gy * cols + gx;
      lum[idx] = Math.round(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722);
      skin[idx] = isSkinPixel(data[i], data[i + 1], data[i + 2]) ? 1 : 0;
    }
  }

  return { cols, rows, skin, lum };
}

async function resolveCanvasSourceUrl(src: string): Promise<string> {
  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    return src;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('IMAGE_LOAD_FAILED');

  const res = await fetch(
    `/api/v1/picture-find/image-proxy?url=${encodeURIComponent(src)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('IMAGE_LOAD_FAILED');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  return (async () => {
    const url = await resolveCanvasSourceUrl(src);
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const cleanup = () => {
        // blob: URL은 사용 후 해제해 메모리 누수 방지
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      };
      img.onload = () => { cleanup(); resolve(img); };
      img.onerror = () => { cleanup(); reject(new Error('IMAGE_LOAD_FAILED')); };
      img.src = url;
    });
  })();
}

export async function resolveSpotDiffPair(
  sceneImageUrl: string,
  variantImageUrl: string | null,
  diffMode: 'auto' | 'manual',
  regions: NormalizedRegion[],
): Promise<{ leftUrl: string; rightUrl: string; regions: NormalizedRegion[] }> {
  if (diffMode === 'manual' && variantImageUrl) {
    return { leftUrl: sceneImageUrl, rightUrl: variantImageUrl, regions };
  }
  const generated = await generateSpotDiffVariantDataUrl(sceneImageUrl, regions);
  return { leftUrl: sceneImageUrl, rightUrl: generated.url, regions: generated.regions };
}
