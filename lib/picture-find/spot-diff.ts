import type { NormalizedRegion } from './types';

const PATCH_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#ec4899', '#eab308', '#8b5cf6', '#14b8a6', '#ef4444'];

/**
 * Option B: single source image → variant canvas with visible patches at diff regions.
 */
export async function generateSpotDiffVariantDataUrl(
  imageUrl: string,
  regions: NormalizedRegion[],
): Promise<string> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  ctx.drawImage(img, 0, 0);

  regions.forEach((region, index) => {
    const cx = region.x * canvas.width;
    const cy = region.y * canvas.height;
    const radius = region.r * Math.min(canvas.width, canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = PATCH_COLORS[index % PATCH_COLORS.length];
    ctx.globalAlpha = 0.88;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, radius * 0.12);
    ctx.stroke();
    ctx.restore();
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    img.src = src;
  });
}

export async function resolveSpotDiffPair(
  sceneImageUrl: string,
  variantImageUrl: string | null,
  diffMode: 'auto' | 'manual',
  regions: NormalizedRegion[],
): Promise<{ leftUrl: string; rightUrl: string }> {
  if (diffMode === 'manual' && variantImageUrl) {
    return { leftUrl: sceneImageUrl, rightUrl: variantImageUrl };
  }
  const rightUrl = await generateSpotDiffVariantDataUrl(sceneImageUrl, regions);
  return { leftUrl: sceneImageUrl, rightUrl };
}
