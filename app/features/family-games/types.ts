export type GameTab = 'ladder' | 'rps' | 'roulette';

export type LadderLaunchConfig = {
  participantIds: string[];
  destinations: string[];
};

export type RPSLaunchConfig = {
  p1UserId: string;
  p2UserId: string;
};

export type RouletteLaunchConfig = {
  selectedIds: string[];
  slotsPerMember: number;
};

export type GamePlaySession =
  | { game: 'ladder'; config: LadderLaunchConfig }
  | { game: 'rps'; config: RPSLaunchConfig }
  | { game: 'roulette'; config: RouletteLaunchConfig };

export type LadderRung = {
  leftLane: number;
  row: number;
  drawnBy?: string;
};

export type LadderPhase = 'setup' | 'config' | 'draw' | 'result';

export const LADDER_ROW_COUNT = 14;
export const LADDER_MIN_LANES = 2;
export const LADDER_MAX_LANES = 8;

const LADDER_PATH_COLORS = [
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
];

export function getLadderPathColor(laneIndex: number): string {
  return LADDER_PATH_COLORS[laneIndex % LADDER_PATH_COLORS.length];
}

export type LadderPoint = { x: number; y: number };

/** 위→아래 경로 좌표 (결과 하이라이트용) */
export function traceLadderPathPoints(
  startLane: number,
  rungs: LadderRung[],
  totalRows: number,
  laneToX: (lane: number) => number,
  rowToY: (row: number) => number,
  topY: number,
  bottomY: number,
): LadderPoint[] {
  let lane = startLane;
  const points: LadderPoint[] = [{ x: laneToX(lane), y: topY }];

  const rungAt = new Map<string, LadderRung>();
  for (const rung of rungs) {
    rungAt.set(`${rung.row}:${rung.leftLane}`, rung);
  }

  for (let row = 0; row < totalRows; row += 1) {
    const y = rowToY(row);
    points.push({ x: laneToX(lane), y });

    if (rungAt.has(`${row}:${lane}`)) {
      lane += 1;
      points.push({ x: laneToX(lane), y });
    } else if (rungAt.has(`${row}:${lane - 1}`)) {
      lane -= 1;
      points.push({ x: laneToX(lane), y });
    }
  }

  points.push({ x: laneToX(lane), y: bottomY });
  return points;
}

export function pointsToSvgPath(points: LadderPoint[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

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

/** 사용자가 그린 가로줄 + 나머지 랜덤 채움 (사다리타기 밀도) */
export function generateDenseLadderRungs(
  laneCount: number,
  userRungs: LadderRung[],
  totalRows: number,
): LadderRung[] {
  const occupied = new Set(userRungs.map((r) => `${r.leftLane}:${r.row}`));
  const result = [...userRungs];

  for (let row = 0; row < totalRows; row += 1) {
    for (let leftLane = 0; leftLane < laneCount - 1; leftLane += 1) {
      const key = `${leftLane}:${row}`;
      if (occupied.has(key)) continue;
      if (Math.random() < 0.62) {
        result.push({ leftLane, row });
        occupied.add(key);
      }
    }
  }

  for (let row = 0; row < totalRows; row += 1) {
    const hasRungInRow = result.some((r) => r.row === row);
    if (hasRungInRow || laneCount <= 1) continue;
    const leftLane = Math.floor(Math.random() * (laneCount - 1));
    const key = `${leftLane}:${row}`;
    if (!occupied.has(key)) {
      result.push({ leftLane, row });
      occupied.add(key);
    }
  }

  return result;
}

/** @deprecated generateDenseLadderRungs 사용 */
export function fillRandomRungs(
  laneCount: number,
  existing: LadderRung[],
  totalRows: number,
): LadderRung[] {
  return generateDenseLadderRungs(laneCount, existing, totalRows);
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

/** 룰렛판 최대 칸 수 */
export const ROULETTE_MAX_SLOTS = 15;

/** 참가 인원 기준 멤버당 선택 가능한 칸 수 (1~floor(15/n)) */
export function getRouletteSlotsPerMemberOptions(participantCount: number): number[] {
  if (participantCount <= 0) return [];
  const maxPerMember = Math.floor(ROULETTE_MAX_SLOTS / participantCount);
  return Array.from({ length: maxPerMember }, (_, i) => i + 1);
}

export type RouletteSegment = {
  userId: string;
  label: string;
  memberIndex: number;
};

/** 멤버당 동일 칸 수로 룰렛 세그먼트 생성 (라운드로빈 배치) */
export function buildRouletteSegments(
  participantIds: string[],
  slotsPerMember: number,
  getLabel: (userId: string) => string,
): RouletteSegment[] {
  const segments: RouletteSegment[] = [];
  for (let round = 0; round < slotsPerMember; round += 1) {
    participantIds.forEach((id, memberIndex) => {
      segments.push({
        userId: id,
        label: getLabel(id),
        memberIndex,
      });
    });
  }
  return segments;
}
