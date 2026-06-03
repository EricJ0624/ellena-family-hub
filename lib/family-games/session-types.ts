import type { LadderRung, RPSChoice } from '@/app/features/family-games/types';

export type FamilyGameType = 'ladder' | 'rps' | 'roulette';

export type FamilyGameStatus = 'config' | 'active' | 'revealing' | 'completed' | 'cancelled';

export type FamilyGameSessionRow = {
  id: string;
  group_id: string;
  game_type: FamilyGameType;
  status: FamilyGameStatus;
  host_user_id: string;
  phase: string;
  config: FamilyGameSessionConfig;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type FamilyGameParticipantRow = {
  session_id: string;
  user_id: string;
  slot_index: number;
  ready: boolean;
  payload: FamilyGameParticipantPayload;
  created_at: string;
  updated_at: string;
};

export type FamilyGameParticipantPayload = {
  ladderRung?: { leftLane: number; row: number };
  destination?: string;
};

export type LadderSessionConfig = {
  participantIds: string[];
  destinations: string[];
  maxSlots?: number;
  userRungs?: LadderRung[];
  finalRungs?: LadderRung[];
  revealStartedAt?: string;
};

export type RPSSessionConfig = {
  p1UserId: string;
  p2UserId: string;
  maxSlots?: number;
  p1Choice?: RPSChoice;
  p2Choice?: RPSChoice;
  outcome?: 'p1' | 'p2' | 'draw';
  revealStartedAt?: string;
};

export type RouletteSessionConfig = {
  selectedIds: string[];
  slotsPerMember: number;
  totalSlots?: number;
  maxSlots?: number;
  rotation?: number;
  winnerLabel?: string;
  winnerUserId?: string;
  winnerIndex?: number;
  spinStartedAt?: string;
};

export type FamilyGameSessionConfig =
  | LadderSessionConfig
  | RPSSessionConfig
  | RouletteSessionConfig
  | Record<string, unknown>;

export type FamilyGameSessionBundle = {
  session: FamilyGameSessionRow;
  participants: FamilyGameParticipantRow[];
};

export type GameSessionAction =
  | { type: 'update_ladder_config'; participantIds?: string[]; destinations?: string[]; addLane?: boolean; removeLane?: boolean }
  | { type: 'update_own_destination'; destination: string }
  | { type: 'host_begin_draw' }
  | { type: 'draw_rung'; leftLane: number; row: number }
  | { type: 'host_start_ladder' }
  | { type: 'host_complete_ladder' }
  | { type: 'submit_rps'; choice: RPSChoice }
  | { type: 'host_reveal_rps' }
  | { type: 'toggle_roulette_ready' }
  | { type: 'host_update_roulette_config'; selectedIds?: string[]; slotsPerMember?: number; totalSlots?: number }
  | { type: 'host_spin_roulette' }
  | { type: 'host_complete_roulette' }
  | { type: 'leave_lobby' }
  | { type: 'update_lobby_slots'; addSlot?: boolean; removeSlot?: boolean }
  | { type: 'host_start_lobby' }
  | { type: 'cancel' };

export type LobbyJoinBody = {
  groupId: string;
  gameType: FamilyGameType;
};

export type CreateGameSessionBody = {
  groupId: string;
  gameType: FamilyGameType;
  config: LadderSessionConfig | RPSSessionConfig | RouletteSessionConfig;
};

export const ACTIVE_GAME_STATUSES: FamilyGameStatus[] = ['config', 'active', 'revealing'];

export function isActiveGameStatus(status: FamilyGameStatus): boolean {
  return ACTIVE_GAME_STATUSES.includes(status);
}

/** 플레이 종료(결과 표시) — fetch 대상은 아니나 클라이언트에서 잠시 유지 가능 */
export function isTerminalGameSession(
  session: Pick<FamilyGameSessionRow, 'status' | 'phase'>,
): boolean {
  if (session.status === 'completed') return true;
  if (session.status === 'active' && session.phase === 'result') return true;
  return false;
}

export function asLadderConfig(config: FamilyGameSessionConfig): LadderSessionConfig {
  const c = config as LadderSessionConfig;
  return {
    participantIds: Array.isArray(c.participantIds) ? c.participantIds : [],
    destinations: Array.isArray(c.destinations) ? c.destinations : [],
    userRungs: c.userRungs,
    finalRungs: c.finalRungs,
    revealStartedAt: c.revealStartedAt,
  };
}

export function asRPSConfig(config: FamilyGameSessionConfig): RPSSessionConfig {
  const c = config as RPSSessionConfig;
  return {
    p1UserId: c.p1UserId ?? '',
    p2UserId: c.p2UserId ?? '',
    p1Choice: c.p1Choice,
    p2Choice: c.p2Choice,
    outcome: c.outcome,
    revealStartedAt: c.revealStartedAt,
  };
}

export function asRouletteConfig(config: FamilyGameSessionConfig): RouletteSessionConfig {
  const c = config as RouletteSessionConfig;
  const selectedIds = Array.isArray(c.selectedIds) ? c.selectedIds : [];
  const slotsPerMember = typeof c.slotsPerMember === 'number' ? c.slotsPerMember : 1;
  const legacyTotal = selectedIds.length * slotsPerMember;
  const totalSlots =
    typeof c.totalSlots === 'number' && c.totalSlots >= 2
      ? c.totalSlots
      : Math.max(2, legacyTotal);
  return {
    selectedIds,
    slotsPerMember,
    totalSlots,
    maxSlots: c.maxSlots,
    rotation: c.rotation,
    winnerLabel: c.winnerLabel,
    winnerUserId: c.winnerUserId,
    winnerIndex: c.winnerIndex,
    spinStartedAt: c.spinStartedAt,
  };
}
