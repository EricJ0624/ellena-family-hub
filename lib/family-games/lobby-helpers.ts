import {
  LADDER_MAX_LANES,
  LADDER_MIN_LANES,
} from '@/app/features/family-games/types';
import type { FamilyGameSessionRow, FamilyGameType } from '@/lib/family-games/session-types';

export const LOBBY_MIN_SLOTS = 2;

export type LobbyConfigFields = {
  maxSlots?: number;
};

export function isLobbyPhase(session: Pick<FamilyGameSessionRow, 'status' | 'phase'>): boolean {
  return session.status === 'config' && session.phase === 'lobby';
}

export function getSessionMaxSlots(session: FamilyGameSessionRow): number {
  const maxSlots = (session.config as LobbyConfigFields)?.maxSlots;
  if (typeof maxSlots === 'number' && maxSlots >= LOBBY_MIN_SLOTS) return maxSlots;
  if (session.game_type === 'rps') return 2;
  return LOBBY_MIN_SLOTS;
}

export function getLobbyMaxSlotsCap(gameType: FamilyGameType, memberCount: number): number {
  const count = Math.max(memberCount, LOBBY_MIN_SLOTS);
  if (gameType === 'rps') return 2;
  if (gameType === 'ladder') return Math.min(count, LADDER_MAX_LANES);
  return count;
}

export function createInitialLobbyConfig(gameType: FamilyGameType): Record<string, unknown> {
  const base = { maxSlots: LOBBY_MIN_SLOTS };
  if (gameType === 'ladder') {
    return { ...base, participantIds: [], destinations: [] };
  }
  if (gameType === 'rps') {
    return { ...base, p1UserId: '', p2UserId: '' };
  }
  return { ...base, selectedIds: [], slotsPerMember: 1 };
}

export function lobbyCanStart(participantCount: number, maxSlots: number): boolean {
  return participantCount >= LOBBY_MIN_SLOTS && participantCount === maxSlots;
}

export function canAddLobbySlot(
  maxSlots: number,
  cap: number,
  gameType: FamilyGameType,
): boolean {
  if (gameType === 'rps') return false;
  return maxSlots < cap;
}

export function canRemoveLobbySlot(
  maxSlots: number,
  participantCount: number,
  gameType: FamilyGameType,
): boolean {
  if (gameType === 'rps') return false;
  return maxSlots > LOBBY_MIN_SLOTS && maxSlots > participantCount;
}
