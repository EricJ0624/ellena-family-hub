/** 인쇄 앨범 페이지 배경 — 에디터 미리보기와 PDF가 같은 레시피를 쓴다. */

import type { CSSProperties } from 'react';
import type { BabyPrintAlbum } from '../types';

export type PrintBgKey = BabyPrintAlbum['bg'];
export type PrintBgGroup = 'premium' | 'cute';

/** CC0 cold-press paper grain (Rindraw). */
export const PRINT_BG_PAPER_GRAIN_URL = '/baby-print-bg/paper-grain.png';

const PREVIEW_PATTERN_TILE_PX = 220;

type BgRecipe = {
  group: PrintBgGroup;
  /** 160° linear multi-stop */
  stops: [string, string, string, string, string];
  highlight: string;
  vignette: string;
  swatchHex: string;
  /** 타일 패턴 (용지 grain 또는 일러스트) */
  patternUrl: string;
  /** grain 캔버스 강도. 일러스트 SVG는 원본 알파 그대로 그린다. */
  patternOpacity: number;
  patternBlend: GlobalCompositeOperation;
};

export const PRINT_BG_RECIPES: Record<PrintBgKey, BgRecipe> = {
  cream: {
    group: 'premium',
    stops: ['#fffef9', '#fbf6ec', '#f4e9d6', '#ebe0cb', '#e4d6be'],
    highlight: 'rgba(255, 253, 248, 0.7)',
    vignette: 'rgba(110, 85, 55, 0.07)',
    swatchHex: '#f3e8d4',
    patternUrl: PRINT_BG_PAPER_GRAIN_URL,
    patternOpacity: 0.16,
    patternBlend: 'soft-light',
  },
  blush: {
    group: 'premium',
    stops: ['#fffbfa', '#fff7f5', '#fde8e4', '#f6d9d3', '#efcdc6'],
    highlight: 'rgba(255, 252, 251, 0.72)',
    vignette: 'rgba(120, 70, 65, 0.07)',
    swatchHex: '#fde8e4',
    patternUrl: PRINT_BG_PAPER_GRAIN_URL,
    patternOpacity: 0.16,
    patternBlend: 'soft-light',
  },
  sage: {
    group: 'premium',
    stops: ['#fafcf8', '#f4f7f2', '#e6efe3', '#d9e7d4', '#cfe0c8'],
    highlight: 'rgba(252, 254, 250, 0.7)',
    vignette: 'rgba(70, 95, 65, 0.07)',
    swatchHex: '#e4eee0',
    patternUrl: PRINT_BG_PAPER_GRAIN_URL,
    patternOpacity: 0.16,
    patternBlend: 'soft-light',
  },
  sky: {
    group: 'premium',
    stops: ['#fafcfe', '#f3f8fb', '#e4eef6', '#d6e7f2', '#c9deec'],
    highlight: 'rgba(252, 254, 255, 0.72)',
    vignette: 'rgba(55, 85, 110, 0.07)',
    swatchHex: '#e2eef6',
    patternUrl: PRINT_BG_PAPER_GRAIN_URL,
    patternOpacity: 0.16,
    patternBlend: 'soft-light',
  },
  stars_clouds: {
    group: 'cute',
    stops: ['#fbfcfe', '#f3f7fb', '#e8f0f7', '#dde9f3', '#d2e2ef'],
    highlight: 'rgba(255, 255, 255, 0.65)',
    vignette: 'rgba(70, 100, 130, 0.06)',
    swatchHex: '#e8f0f7',
    patternUrl: '/baby-print-bg/stars-clouds.svg',
    patternOpacity: 0.42,
    patternBlend: 'multiply',
  },
  hearts_soft: {
    group: 'cute',
    stops: ['#fffaf9', '#fff5f3', '#fde9e6', '#f8ddd9', '#f2d1cc'],
    highlight: 'rgba(255, 252, 251, 0.7)',
    vignette: 'rgba(130, 80, 90, 0.06)',
    swatchHex: '#fde9e6',
    patternUrl: '/baby-print-bg/hearts-soft.svg',
    patternOpacity: 0.4,
    patternBlend: 'multiply',
  },
  wash: {
    group: 'premium',
    stops: ['#fffdf8', '#f8f1e6', '#f0e4d2', '#e7d7c2', '#deccb4'],
    highlight: 'rgba(255, 252, 246, 0.7)',
    vignette: 'rgba(120, 90, 60, 0.06)',
    swatchHex: '#f0e4d2',
    patternUrl: '/baby-print-bg/wash-edge.svg',
    patternOpacity: 0.7,
    patternBlend: 'multiply',
  },
  line: {
    group: 'premium',
    stops: ['#fdfcfa', '#f7f4ef', '#efeae3', '#e6dfd6', '#ddd4c8'],
    highlight: 'rgba(255, 255, 255, 0.7)',
    vignette: 'rgba(90, 80, 70, 0.05)',
    swatchHex: '#efeae3',
    patternUrl: '/baby-print-bg/line-min.svg',
    patternOpacity: 0.75,
    patternBlend: 'multiply',
  },
  floral: {
    group: 'premium',
    stops: ['#fffaf8', '#fbf3ef', '#f6e8e4', '#f0ddd8', '#e8d0cb'],
    highlight: 'rgba(255, 250, 248, 0.7)',
    vignette: 'rgba(120, 80, 80, 0.05)',
    swatchHex: '#f6e8e4',
    patternUrl: '/baby-print-bg/floral-soft.svg',
    patternOpacity: 0.65,
    patternBlend: 'multiply',
  },
  vellum: {
    group: 'premium',
    stops: ['#fbf8f2', '#f3eee4', '#e9e2d4', '#dfd6c6', '#d4c9b6'],
    highlight: 'rgba(255, 252, 246, 0.65)',
    vignette: 'rgba(100, 80, 55, 0.06)',
    swatchHex: '#e9e2d4',
    patternUrl: '/baby-print-bg/vellum-fiber.svg',
    patternOpacity: 0.7,
    patternBlend: 'multiply',
  },
  moon: {
    group: 'cute',
    stops: ['#fbfaff', '#f4f1fb', '#ebe6f6', '#e2daf0', '#d8cee8'],
    highlight: 'rgba(255, 255, 255, 0.65)',
    vignette: 'rgba(90, 70, 120, 0.06)',
    swatchHex: '#ebe6f6',
    patternUrl: '/baby-print-bg/moon-night.svg',
    patternOpacity: 0.5,
    patternBlend: 'multiply',
  },
  animals: {
    group: 'cute',
    stops: ['#fffaf6', '#fbf3ea', '#f6e8da', '#f0dcc8', '#e8d0ba'],
    highlight: 'rgba(255, 252, 248, 0.7)',
    vignette: 'rgba(120, 90, 60, 0.05)',
    swatchHex: '#f6e8da',
    patternUrl: '/baby-print-bg/animals-soft.svg',
    patternOpacity: 0.5,
    patternBlend: 'multiply',
  },
  rainbow: {
    group: 'cute',
    stops: ['#fffafc', '#fff4f6', '#fdeef2', '#fbe8ee', '#f8e0e8'],
    highlight: 'rgba(255, 255, 255, 0.7)',
    vignette: 'rgba(140, 90, 110, 0.05)',
    swatchHex: '#fdeef2',
    patternUrl: '/baby-print-bg/rainbow-soft.svg',
    patternOpacity: 0.55,
    patternBlend: 'multiply',
  },
  balloons: {
    group: 'cute',
    stops: ['#f8fcff', '#f2f7fb', '#e8f1f8', '#deebf4', '#d4e4f0'],
    highlight: 'rgba(255, 255, 255, 0.7)',
    vignette: 'rgba(70, 100, 130, 0.05)',
    swatchHex: '#e8f1f8',
    patternUrl: '/baby-print-bg/balloons.svg',
    patternOpacity: 0.5,
    patternBlend: 'multiply',
  },
  footprints: {
    group: 'cute',
    stops: ['#fffaf8', '#fbf4f0', '#f7ebe6', '#f2e2db', '#ecd8d0'],
    highlight: 'rgba(255, 250, 248, 0.7)',
    vignette: 'rgba(120, 80, 70, 0.05)',
    swatchHex: '#f7ebe6',
    patternUrl: '/baby-print-bg/footprints.svg',
    patternOpacity: 0.5,
    patternBlend: 'multiply',
  },
  blocks: {
    group: 'cute',
    stops: ['#fbfcf8', '#f6f7f0', '#eef0e4', '#e6e8d8', '#dee1cc'],
    highlight: 'rgba(255, 255, 255, 0.7)',
    vignette: 'rgba(90, 100, 70, 0.05)',
    swatchHex: '#eef0e4',
    patternUrl: '/baby-print-bg/blocks.svg',
    patternOpacity: 0.5,
    patternBlend: 'multiply',
  },
};

export const PRINT_BG_KEYS = Object.keys(PRINT_BG_RECIPES) as PrintBgKey[];

export const PRINT_BG_PREMIUM_KEYS = PRINT_BG_KEYS.filter(
  (k) => PRINT_BG_RECIPES[k].group === 'premium',
);
export const PRINT_BG_CUTE_KEYS = PRINT_BG_KEYS.filter((k) => PRINT_BG_RECIPES[k].group === 'cute');

export function isPrintBgKey(v: unknown): v is PrintBgKey {
  return typeof v === 'string' && v in PRINT_BG_RECIPES;
}

export function printBgPatternUrl(key: PrintBgKey): string {
  return PRINT_BG_RECIPES[key].patternUrl;
}

function isMotifPattern(url: string): boolean {
  return url.endsWith('.svg');
}

/** 에디터 페이지 배경. 일러스트는 색에 묻히지 않게 그대로 깐다. */
export function printBgPreviewStyle(key: PrintBgKey): CSSProperties {
  const r = PRINT_BG_RECIPES[key];
  const motif = isMotifPattern(r.patternUrl);
  const tile = motif ? '120px 120px' : `${PREVIEW_PATTERN_TILE_PX}px ${PREVIEW_PATTERN_TILE_PX}px`;
  return {
    backgroundColor: r.swatchHex,
    backgroundImage: [
      `url(${r.patternUrl})`,
      `radial-gradient(120% 85% at 50% 12%, ${r.highlight} 0%, transparent 58%)`,
      `radial-gradient(95% 75% at 50% 110%, ${r.vignette} 0%, transparent 52%)`,
      `linear-gradient(160deg, ${r.stops[0]} 0%, ${r.stops[1]} 26%, ${r.stops[2]} 52%, ${r.stops[3]} 78%, ${r.stops[4]} 100%)`,
    ].join(', '),
    backgroundSize: `${tile}, auto, auto, auto`,
    backgroundRepeat: 'repeat, no-repeat, no-repeat, no-repeat',
    backgroundBlendMode: motif ? 'normal, normal, normal, normal' : `soft-light, normal, normal, normal`,
    opacity: 1,
    boxShadow:
      'inset 0 0 0 1px rgba(255,255,255,0.42), inset 0 0 48px rgba(70,55,40,0.035), 0 10px 28px rgba(55,40,28,0.1)',
  };
}

/** 선택 카드 — 일러스트 한 장이 카드 안에 다 들어오게 줄인다. */
export function printBgThumbStyle(key: PrintBgKey): CSSProperties {
  const r = PRINT_BG_RECIPES[key];
  const base = printBgPreviewStyle(key);
  if (!isMotifPattern(r.patternUrl)) {
    return { ...base, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)' };
  }
  return {
    ...base,
    backgroundSize: '100% 100%, auto, auto, auto',
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)',
  };
}

function linearGradient160(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: string[],
) {
  const rad = (160 * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const len = Math.abs(width * dx) + Math.abs(height * dy);
  const cx = width / 2;
  const cy = height / 2;
  const grad = ctx.createLinearGradient(
    cx - (dx * len) / 2,
    cy - (dy * len) / 2,
    cx + (dx * len) / 2,
    cy + (dy * len) / 2,
  );
  const last = Math.max(1, stops.length - 1);
  stops.forEach((color, i) => grad.addColorStop(i / last, color));
  return grad;
}

function tilePattern(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  cute: boolean,
): CanvasPattern | null {
  const tile = Math.max(96, Math.round(Math.min(width, height) * (cute ? 0.28 : 0.2)));
  const off = document.createElement('canvas');
  off.width = tile;
  off.height = tile;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.drawImage(image, 0, 0, tile, tile);
  return ctx.createPattern(off, 'repeat');
}

/**
 * PDF/인쇄 캔버스 배경. pattern은 선택 — 실패해도 그라데이션만으로 동작.
 * 사진·텍스트는 이 함수 이후에 그려지므로 가리지 않는다.
 */
export function fillPrintPaperBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  key: PrintBgKey,
  pattern: CanvasImageSource | null | undefined,
) {
  const r = PRINT_BG_RECIPES[key];
  const cx = width / 2;
  const cy = height / 2;
  const cute = r.group === 'cute';

  ctx.fillStyle = linearGradient160(ctx, width, height, r.stops);
  ctx.fillRect(0, 0, width, height);

  const highlightR = Math.max(width, height) * 0.72;
  const hg = ctx.createRadialGradient(cx, height * 0.14, 0, cx, height * 0.14, highlightR);
  hg.addColorStop(0, r.highlight);
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, width, height);

  const vigInner = Math.min(width, height) * 0.32;
  const vigOuter = Math.max(width, height) * 0.78;
  const vg = ctx.createRadialGradient(cx, cy, vigInner, cx, cy, vigOuter);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, r.vignette);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  if (pattern) {
    const pat = tilePattern(ctx, pattern, width, height, cute);
    if (pat) {
      ctx.save();
      const motif = isMotifPattern(r.patternUrl);
      ctx.globalAlpha = motif ? 1 : r.patternOpacity;
      ctx.globalCompositeOperation = motif ? 'source-over' : r.patternBlend;
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.0035));
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = inset;
  ctx.strokeRect(inset / 2, inset / 2, width - inset, height - inset);
  ctx.restore();
}
