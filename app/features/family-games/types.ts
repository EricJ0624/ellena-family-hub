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
  /** @deprecated use totalSlots */
  slotsPerMember?: number;
  totalSlots?: number;
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

function ladderRungKey(row: number, leftLane: number): string {
  return `${row}:${leftLane}`;
}

/** 한 층에서는 가로줄을 한 번만 타고, 다음 층은 항상 아래다. */
function advanceLadderLane(
  lane: number,
  row: number,
  rungAt: ReadonlyMap<string, LadderRung>,
): number {
  if (rungAt.has(ladderRungKey(row, lane))) return lane + 1;
  if (rungAt.has(ladderRungKey(row, lane - 1))) return lane - 1;
  return lane;
}

function indexLadderRungs(rungs: LadderRung[]): Map<string, LadderRung> {
  const rungAt = new Map<string, LadderRung>();
  for (const rung of rungs) {
    rungAt.set(ladderRungKey(rung.row, rung.leftLane), rung);
  }
  return rungAt;
}

/** 위→아래 경로 좌표. y는 감소하지 않는다. */
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
  const rungAt = indexLadderRungs(rungs);

  const pushDown = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (last && y < last.y) return;
    points.push({ x, y });
  };

  for (let row = 0; row < totalRows; row += 1) {
    const y = rowToY(row);
    pushDown(laneToX(lane), y);
    const nextLane = advanceLadderLane(lane, row, rungAt);
    if (nextLane !== lane) {
      lane = nextLane;
      pushDown(laneToX(lane), y);
    }
  }

  pushDown(laneToX(lane), bottomY);
  return points;
}

export function pointsToSvgPath(points: LadderPoint[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function traceLadderPath(startLane: number, rungs: LadderRung[], totalRows: number): number {
  let lane = startLane;
  const rungAt = indexLadderRungs(rungs);
  for (let row = 0; row < totalRows; row += 1) {
    lane = advanceLadderLane(lane, row, rungAt);
  }
  return lane;
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

/** 선택 가능한 총 칸 수 (2~15, 참가 인원과 무관) */
export function getRouletteTotalSlotOptions(): number[] {
  return Array.from({ length: ROULETTE_MAX_SLOTS - 1 }, (_, i) => i + 2);
}

/** @deprecated 멤버당 칸 — totalSlots 사용 */
export function getRouletteSlotsPerMemberOptions(participantCount: number): number[] {
  if (participantCount <= 0) return [];
  const maxPerMember = Math.floor(ROULETTE_MAX_SLOTS / participantCount);
  return Array.from({ length: maxPerMember }, (_, i) => i + 1);
}

export function resolveRouletteTotalSlots(
  config: { selectedIds: string[]; totalSlots?: number; slotsPerMember?: number },
): number {
  if (typeof config.totalSlots === 'number' && config.totalSlots >= 2) {
    return Math.min(config.totalSlots, ROULETTE_MAX_SLOTS);
  }
  const perMember = config.slotsPerMember ?? 1;
  return Math.min(
    ROULETTE_MAX_SLOTS,
    Math.max(2, config.selectedIds.length * perMember),
  );
}

export type RouletteSegment = {
  userId: string;
  label: string;
  memberIndex: number;
};

/** 총 칸 수를 참가자에게 라운드로빈 배치 */
export function buildRouletteSegments(
  participantIds: string[],
  totalSlots: number,
  getLabel: (userId: string) => string,
): RouletteSegment[] {
  if (participantIds.length === 0 || totalSlots < 2) return [];
  const segments: RouletteSegment[] = [];
  for (let i = 0; i < totalSlots; i += 1) {
    const memberIndex = i % participantIds.length;
    const id = participantIds[memberIndex];
    segments.push({
      userId: id,
      label: getLabel(id),
      memberIndex,
    });
  }
  return segments;
}
