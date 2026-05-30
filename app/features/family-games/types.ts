export type LadderRung = {
  leftLane: number;
  row: number;
  drawnBy?: string;
};

export type LadderPhase = 'setup' | 'draw' | 'result';

export const LADDER_ROW_COUNT = 10;
export const LADDER_MIN_LANES = 2;
export const LADDER_MAX_LANES = 8;

export function traceLadderPath(startLane: number, rungs: LadderRung[], totalRows: number): number {
  let lane = startLane;
  const byRow = new Map<number, LadderRung[]>();
  for (const rung of rungs) {
    const list = byRow.get(rung.row) ?? [];
    list.push(rung);
    byRow.set(rung.row, list);
  }

  for (let row = 0; row < totalRows; row += 1) {
    const rowRungs = byRow.get(row) ?? [];
    for (const rung of rowRungs) {
      if (rung.leftLane === lane) {
        lane += 1;
      } else if (rung.leftLane === lane - 1) {
        lane -= 1;
      }
    }
  }
  return lane;
}

export function fillRandomRungs(
  laneCount: number,
  existing: LadderRung[],
  totalRows: number,
): LadderRung[] {
  const occupied = new Set(existing.map((r) => `${r.leftLane}:${r.row}`));
  const result = [...existing];

  for (let row = 0; row < totalRows; row += 1) {
    for (let leftLane = 0; leftLane < laneCount - 1; leftLane += 1) {
      const key = `${leftLane}:${row}`;
      if (occupied.has(key)) continue;
      if (Math.random() < 0.35) {
        result.push({ leftLane, row });
        occupied.add(key);
      }
    }
  }

  if (result.length === existing.length) {
    const leftLane = Math.floor(Math.random() * Math.max(1, laneCount - 1));
    const row = Math.floor(Math.random() * totalRows);
    const key = `${leftLane}:${row}`;
    if (!occupied.has(key)) {
      result.push({ leftLane, row });
    }
  }

  return result;
}

export type RPSChoice = 'rock' | 'paper' | 'scissors';

export function resolveRPS(a: RPSChoice, b: RPSChoice): 'p1' | 'p2' | 'draw' {
  if (a === b) return 'draw';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'scissors' && b === 'paper') ||
    (a === 'paper' && b === 'rock')
  ) {
    return 'p1';
  }
  return 'p2';
}

export function pickRouletteIndex(slotCount: number, rotationDeg: number): number {
  if (slotCount <= 0) return 0;
  const slice = 360 / slotCount;
  const normalized = ((rotationDeg % 360) + 360) % 360;
  const pointerAngle = (360 - normalized + 90) % 360;
  const index = Math.floor(pointerAngle / slice) % slotCount;
  return index;
}

export type GameTab = 'ladder' | 'rps' | 'roulette';
