import {
  PICTURE_FIND_EDGE_MARGIN,
  PICTURE_FIND_ITEM_MAX,
  PICTURE_FIND_ITEM_MIN,
  type HiddenItem,
  type NormalizedRegion,
  type PictureFindPuzzle,
} from './types';
import { createSeededRandom, randomInt } from './rng';

const HIDDEN_EMOJIS = ['🌟', '🔑', '🎈', '🐱', '🍎', '🌸', '🎁', '🦋', '🍀', '🎵', '🧸', '⭐'];

function regionsOverlap(a: NormalizedRegion, b: NormalizedRegion, minGap: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < a.r + b.r + minGap;
}

function placeRegions(
  count: number,
  rng: () => number,
  radius: number,
): NormalizedRegion[] {
  const margin = PICTURE_FIND_EDGE_MARGIN;
  const minGap = 0.04;
  const regions: NormalizedRegion[] = [];
  const maxAttempts = count * 80;

  for (let attempt = 0; attempt < maxAttempts && regions.length < count; attempt += 1) {
    const candidate: NormalizedRegion = {
      id: `r-${regions.length}`,
      x: margin + rng() * (1 - margin * 2),
      y: margin + rng() * (1 - margin * 2),
      r: radius,
    };
    if (regions.some((existing) => regionsOverlap(candidate, existing, minGap))) continue;
    regions.push(candidate);
  }

  while (regions.length < count) {
    regions.push({
      id: `r-${regions.length}`,
      x: margin + rng() * (1 - margin * 2),
      y: margin + rng() * (1 - margin * 2),
      r: radius,
    });
  }

  return regions;
}

export function buildPictureFindPuzzle(sceneId: string, playSeed: string): PictureFindPuzzle {
  const rng = createSeededRandom(`${sceneId}:${playSeed}`);
  const itemCount = randomInt(rng, PICTURE_FIND_ITEM_MIN, PICTURE_FIND_ITEM_MAX);
  const diffRegions = placeRegions(itemCount, rng, 0.045);
  const hiddenItems: HiddenItem[] = diffRegions.map((region, index) => ({
    ...region,
    id: `h-${index}`,
    emoji: HIDDEN_EMOJIS[index % HIDDEN_EMOJIS.length],
  }));

  return {
    seed: playSeed,
    itemCount,
    hiddenItems,
    diffRegions,
  };
}

export function hitTestNormalized(
  tapX: number,
  tapY: number,
  region: NormalizedRegion,
  tolerance = 1.25,
): boolean {
  const dx = tapX - region.x;
  const dy = tapY - region.y;
  return Math.sqrt(dx * dx + dy * dy) <= region.r * tolerance;
}

export function tapToNormalized(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

export function formatRemainingSeconds(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${sec}`;
}
