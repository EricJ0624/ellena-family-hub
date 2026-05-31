import type { LadderRung } from '@/app/features/family-games/types';
import { LADDER_ROW_COUNT } from '@/app/features/family-games/types';

/** Deterministic PRNG from session id (cheat-resistant server-side ladder fill). */
export function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };
}

export function generateDenseLadderRungsSeeded(
  laneCount: number,
  userRungs: LadderRung[],
  totalRows: number,
  seed: string,
): LadderRung[] {
  const rand = createSeededRandom(seed);
  const occupied = new Set(userRungs.map((r) => `${r.leftLane}:${r.row}`));
  const result = [...userRungs];

  for (let row = 0; row < totalRows; row += 1) {
    for (let leftLane = 0; leftLane < laneCount - 1; leftLane += 1) {
      const key = `${leftLane}:${row}`;
      if (occupied.has(key)) continue;
      if (rand() < 0.62) {
        result.push({ leftLane, row });
        occupied.add(key);
      }
    }
  }

  for (let row = 0; row < totalRows; row += 1) {
    const hasRungInRow = result.some((r) => r.row === row);
    if (hasRungInRow || laneCount <= 1) continue;
    const leftLane = Math.floor(rand() * (laneCount - 1));
    const key = `${leftLane}:${row}`;
    if (!occupied.has(key)) {
      result.push({ leftLane, row });
      occupied.add(key);
    }
  }

  return result;
}

export { LADDER_ROW_COUNT };
