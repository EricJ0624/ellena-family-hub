import { LADDER_MIN_LANES } from '@/app/features/family-games/types';

/** 2명일 때만 사용하는 시각적 세로줄 수 */
export const LADDER_TWO_PLAYER_LANE_COUNT = 3;

export function isLadderTripleLaneMode(participantCount: number): boolean {
  return participantCount === LADDER_MIN_LANES;
}

export function getLadderVisualLaneCount(participantCount: number): number {
  return isLadderTripleLaneMode(participantCount)
    ? LADDER_TWO_PLAYER_LANE_COUNT
    : participantCount;
}

export function getLadderLaneLetter(laneIndex: number): string {
  return String.fromCharCode(65 + laneIndex);
}

export function getUserStartLane(
  userId: string,
  participantIds: string[],
  startLanes: Record<string, number> | undefined,
): number {
  if (isLadderTripleLaneMode(participantIds.length) && startLanes?.[userId] !== undefined) {
    return startLanes[userId]!;
  }
  const idx = participantIds.indexOf(userId);
  return idx >= 0 ? idx : 0;
}

export function getOccupantAtLane(
  laneIndex: number,
  participantIds: string[],
  startLanes: Record<string, number> | undefined,
): string | null {
  if (!isLadderTripleLaneMode(participantIds.length)) {
    return participantIds[laneIndex] ?? null;
  }
  const entry = Object.entries(startLanes ?? {}).find(([, lane]) => lane === laneIndex);
  return entry?.[0] ?? null;
}

export function allStartLanesAssigned(
  participantIds: string[],
  startLanes: Record<string, number> | undefined,
): boolean {
  if (!isLadderTripleLaneMode(participantIds.length)) return true;
  const lanes = startLanes ?? {};
  const assigned = participantIds.map((id) => lanes[id]);
  if (assigned.some((lane) => lane === undefined)) return false;
  return new Set(assigned).size === assigned.length;
}

export function normalizeLadderDestinationsLength(
  destinations: string[],
  participantCount: number,
): string[] {
  const target = getLadderVisualLaneCount(participantCount);
  if (destinations.length === target) return [...destinations];
  const next = [...destinations];
  while (next.length < target) next.push('');
  return next.slice(0, target);
}
