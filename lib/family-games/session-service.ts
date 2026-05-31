import {
  generateDenseLadderRungsSeeded,
  LADDER_ROW_COUNT,
} from '@/lib/family-games/ladder-server';
import type {
  CreateGameSessionBody,
  FamilyGameParticipantRow,
  FamilyGameSessionBundle,
  FamilyGameSessionRow,
  GameSessionAction,
  LadderSessionConfig,
  RPSSessionConfig,
  RouletteSessionConfig,
} from '@/lib/family-games/session-types';
import {
  asLadderConfig,
  asRPSConfig,
  asRouletteConfig,
} from '@/lib/family-games/session-types';
import {
  LADDER_MAX_LANES,
  LADDER_MIN_LANES,
  buildRouletteSegments,
  pickRouletteIndex,
  resolveRPS,
  type LadderRung,
  type RPSChoice,
} from '@/app/features/family-games/types';
import {
  canAddLobbySlot,
  canRemoveLobbySlot,
  createInitialLobbyConfig,
  getLobbyMaxSlotsCap,
  getSessionMaxSlots,
  isLobbyPhase,
  lobbyCanStart,
  LOBBY_MIN_SLOTS,
} from '@/lib/family-games/lobby-helpers';
import type { LobbyJoinBody } from '@/lib/family-games/session-types';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = () => new Date().toISOString();

export async function fetchActiveSessionForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<FamilyGameSessionBundle | null> {
  await cancelStaleSessionsForGroup(supabase, groupId);

  const { data: session, error } = await supabase
    .from('family_game_sessions')
    .select('*')
    .eq('group_id', groupId)
    .in('status', ['config', 'active', 'revealing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!session) return null;

  const participants = await fetchParticipants(supabase, session.id);
  return { session: session as FamilyGameSessionRow, participants };
}

export async function fetchSessionBundle(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<FamilyGameSessionBundle | null> {
  const { data: session, error } = await supabase
    .from('family_game_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!session) return null;

  const participants = await fetchParticipants(supabase, sessionId);
  return { session: session as FamilyGameSessionRow, participants };
}

async function fetchParticipants(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<FamilyGameParticipantRow[]> {
  const { data, error } = await supabase
    .from('family_game_participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('slot_index', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FamilyGameParticipantRow[];
}

export async function cancelStaleSessionsForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  await supabase
    .from('family_game_sessions')
    .update({ status: 'cancelled', updated_at: NOW() })
    .eq('group_id', groupId)
    .in('status', ['config', 'active', 'revealing'])
    .lt('expires_at', NOW());
}

export async function createGameSession(
  supabase: SupabaseClient,
  hostUserId: string,
  body: CreateGameSessionBody,
): Promise<FamilyGameSessionBundle> {
  const { groupId, gameType, config } = body;

  await cancelStaleSessionsForGroup(supabase, groupId);

  const { data: existing } = await supabase
    .from('family_game_sessions')
    .select('id')
    .eq('group_id', groupId)
    .in('status', ['config', 'active', 'revealing'])
    .maybeSingle();

  if (existing) {
    throw new Error('ACTIVE_SESSION_EXISTS');
  }

  validateCreateConfig(gameType, config);

  const participantIds = extractParticipantIds(gameType, config);
  const now = NOW();

  const { data: session, error: sessionError } = await supabase
    .from('family_game_sessions')
    .insert({
      group_id: groupId,
      game_type: gameType,
      status: 'config',
      host_user_id: hostUserId,
      phase: 'config',
      config,
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();

  if (sessionError || !session) {
    throw sessionError ?? new Error('Failed to create session');
  }

  const participantRows = participantIds.map((userId, slotIndex) => ({
    session_id: session.id,
    user_id: userId,
    slot_index: slotIndex,
    ready: userId === hostUserId,
    payload: {},
    created_at: now,
    updated_at: now,
  }));

  const { error: participantsError } = await supabase
    .from('family_game_participants')
    .insert(participantRows);

  if (participantsError) throw participantsError;

  return {
    session: session as FamilyGameSessionRow,
    participants: participantRows as FamilyGameParticipantRow[],
  };
}

function extractParticipantIds(
  gameType: CreateGameSessionBody['gameType'],
  config: CreateGameSessionBody['config'],
): string[] {
  if (gameType === 'ladder') {
    const c = config as LadderSessionConfig;
    return [...c.participantIds];
  }
  if (gameType === 'rps') {
    const c = config as RPSSessionConfig;
    return [c.p1UserId, c.p2UserId];
  }
  const c = config as RouletteSessionConfig;
  return [...c.selectedIds];
}

function validateCreateConfig(
  gameType: CreateGameSessionBody['gameType'],
  config: CreateGameSessionBody['config'],
): void {
  if (gameType === 'ladder') {
    const c = config as LadderSessionConfig;
    if (c.participantIds.length < LADDER_MIN_LANES) throw new Error('LADDER_MIN_PLAYERS');
    if (new Set(c.participantIds).size !== c.participantIds.length) throw new Error('DUPLICATE_PARTICIPANT');
  } else if (gameType === 'rps') {
    const c = config as RPSSessionConfig;
    if (!c.p1UserId || !c.p2UserId || c.p1UserId === c.p2UserId) throw new Error('RPS_INVALID_PLAYERS');
  } else {
    const c = config as RouletteSessionConfig;
    if (c.selectedIds.length < 2) throw new Error('ROULETTE_MIN_PARTICIPANTS');
    if (c.slotsPerMember < 1) throw new Error('ROULETTE_INVALID_SLOTS');
  }
}

export async function joinGameSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<FamilyGameParticipantRow> {
  const bundle = await fetchSessionBundle(supabase, sessionId);
  if (!bundle) throw new Error('SESSION_NOT_FOUND');

  const existing = bundle.participants.find((p) => p.user_id === userId);
  if (existing) return existing;

  throw new Error('NOT_A_PARTICIPANT');
}

async function getGroupMemberCount(
  supabase: SupabaseClient,
  groupId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId);

  if (error) throw error;
  return Math.max(count ?? LOBBY_MIN_SLOTS, LOBBY_MIN_SLOTS);
}

export async function lobbyJoinGameSession(
  supabase: SupabaseClient,
  userId: string,
  body: LobbyJoinBody,
): Promise<FamilyGameSessionBundle> {
  const { groupId, gameType } = body;
  await cancelStaleSessionsForGroup(supabase, groupId);

  const memberCount = await getGroupMemberCount(supabase, groupId);
  const slotsCap = getLobbyMaxSlotsCap(gameType, memberCount);

  const { data: existingSession } = await supabase
    .from('family_game_sessions')
    .select('*')
    .eq('group_id', groupId)
    .in('status', ['config', 'active', 'revealing'])
    .maybeSingle();

  const now = NOW();

  if (existingSession) {
    const session = existingSession as FamilyGameSessionRow;
    if (session.game_type !== gameType) {
      throw new Error('WRONG_GAME_TYPE');
    }
    if (!isLobbyPhase(session)) {
      throw new Error('LOBBY_CLOSED');
    }

    const participants = await fetchParticipants(supabase, session.id);
    const existing = participants.find((p) => p.user_id === userId);
    if (existing) {
      return { session, participants };
    }

    const maxSlots = getSessionMaxSlots(session);
    if (participants.length >= maxSlots) {
      throw new Error('LOBBY_FULL');
    }

    const slotIndex = participants.length;
    const { error: insertError } = await supabase.from('family_game_participants').insert({
      session_id: session.id,
      user_id: userId,
      slot_index: slotIndex,
      ready: false,
      payload: {},
      created_at: now,
      updated_at: now,
    });
    if (insertError) throw insertError;

    return (await fetchSessionBundle(supabase, session.id))!;
  }

  const config = createInitialLobbyConfig(gameType);
  const { data: session, error: sessionError } = await supabase
    .from('family_game_sessions')
    .insert({
      group_id: groupId,
      game_type: gameType,
      status: 'config',
      host_user_id: userId,
      phase: 'lobby',
      config,
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();

  if (sessionError || !session) {
    throw sessionError ?? new Error('Failed to create session');
  }

  const { error: participantError } = await supabase.from('family_game_participants').insert({
    session_id: session.id,
    user_id: userId,
    slot_index: 0,
    ready: false,
    payload: {},
    created_at: now,
    updated_at: now,
  });
  if (participantError) throw participantError;

  return (await fetchSessionBundle(supabase, session.id))!;
}

async function handleLobbyAction(
  supabase: SupabaseClient,
  session: FamilyGameSessionRow,
  participants: FamilyGameParticipantRow[],
  userId: string,
  isHost: boolean,
  action: GameSessionAction,
): Promise<void> {
  if (!isLobbyPhase(session)) throw new Error('FORBIDDEN');
  const now = NOW();
  const memberCount = await getGroupMemberCount(supabase, session.group_id);
  const slotsCap = getLobbyMaxSlotsCap(session.game_type, memberCount);

  if (action.type === 'leave_lobby') {
    const participant = participants.find((p) => p.user_id === userId);
    if (!participant) return;

    await supabase
      .from('family_game_participants')
      .delete()
      .eq('session_id', session.id)
      .eq('user_id', userId);

    const remaining = await fetchParticipants(supabase, session.id);
    if (remaining.length === 0) {
      await updateSession(supabase, session.id, { status: 'cancelled', updated_at: now });
      return;
    }

    if (session.host_user_id === userId) {
      const newHost = [...remaining].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )[0];
      await updateSession(supabase, session.id, {
        host_user_id: newHost.user_id,
        updated_at: now,
      });
    }
    return;
  }

  if (action.type === 'update_lobby_slots') {
    if (!isHost) throw new Error('HOST_ONLY');
    const maxSlots = getSessionMaxSlots(session);
    const participantCount = participants.length;

    if (action.addSlot) {
      if (!canAddLobbySlot(maxSlots, slotsCap, session.game_type)) {
        throw new Error('MAX_SLOTS');
      }
      await updateSession(supabase, session.id, {
        config: { ...session.config, maxSlots: maxSlots + 1 },
        updated_at: now,
      });
      return;
    }

    if (action.removeSlot) {
      if (!canRemoveLobbySlot(maxSlots, participantCount, session.game_type)) {
        throw new Error('MIN_SLOTS');
      }
      await updateSession(supabase, session.id, {
        config: { ...session.config, maxSlots: maxSlots - 1 },
        updated_at: now,
      });
    }
    return;
  }

  if (action.type === 'host_start_lobby') {
    if (!isHost) throw new Error('HOST_ONLY');
    const maxSlots = getSessionMaxSlots(session);
    const ordered = [...participants].sort((a, b) => a.slot_index - b.slot_index);
    const participantIds = ordered.map((p) => p.user_id);

    if (!lobbyCanStart(participantIds.length, maxSlots)) {
      throw new Error('LOBBY_NOT_FULL');
    }

    if (session.game_type === 'ladder') {
      const destinations = participantIds.map((_, i) => `Result ${i + 1}`);
      await updateSession(supabase, session.id, {
        phase: 'config',
        config: {
          ...asLadderConfig(session.config),
          participantIds,
          destinations,
          maxSlots,
        },
        updated_at: now,
      });
      await syncLadderParticipants(supabase, session.id, participantIds, now);
      return;
    }

    if (session.game_type === 'rps') {
      await updateSession(supabase, session.id, {
        status: 'active',
        phase: 'select',
        config: {
          ...asRPSConfig(session.config),
          p1UserId: participantIds[0],
          p2UserId: participantIds[1],
          maxSlots,
        },
        updated_at: now,
      });
      await syncLadderParticipants(supabase, session.id, participantIds, now);
      return;
    }

    await updateSession(supabase, session.id, {
      status: 'active',
      phase: 'spin',
      config: {
        ...asRouletteConfig(session.config),
        selectedIds: participantIds,
        slotsPerMember: 1,
        maxSlots,
      },
      updated_at: now,
    });
    await syncRouletteParticipants(supabase, session.id, participantIds, now);
  }
}

export async function performGameSessionAction(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  action: GameSessionAction,
): Promise<FamilyGameSessionBundle> {
  const bundle = await fetchSessionBundle(supabase, sessionId);
  if (!bundle) throw new Error('SESSION_NOT_FOUND');

  const { session } = bundle;
  const isHost = session.host_user_id === userId;
  const now = NOW();

  if (action.type === 'cancel') {
    if (!isHost) throw new Error('HOST_ONLY');
    await updateSession(supabase, sessionId, { status: 'cancelled', updated_at: now });
    return (await fetchSessionBundle(supabase, sessionId))!;
  }

  if (
    action.type === 'leave_lobby' ||
    action.type === 'update_lobby_slots' ||
    action.type === 'host_start_lobby'
  ) {
    await handleLobbyAction(supabase, session, bundle.participants, userId, isHost, action);
    const updated = await fetchSessionBundle(supabase, sessionId);
    if (!updated) throw new Error('SESSION_NOT_FOUND');
    return updated;
  }

  switch (session.game_type) {
    case 'ladder':
      await handleLadderAction(supabase, session, bundle.participants, userId, isHost, action);
      break;
    case 'rps':
      await handleRPSAction(supabase, session, bundle.participants, userId, isHost, action);
      break;
    case 'roulette':
      await handleRouletteAction(supabase, session, bundle.participants, userId, isHost, action);
      break;
    default:
      throw new Error('UNKNOWN_GAME');
  }

  const updated = await fetchSessionBundle(supabase, sessionId);
  if (!updated) throw new Error('SESSION_NOT_FOUND');
  return updated;
}

async function handleLadderAction(
  supabase: SupabaseClient,
  session: FamilyGameSessionRow,
  participants: FamilyGameParticipantRow[],
  userId: string,
  isHost: boolean,
  action: GameSessionAction,
): Promise<void> {
  const config = asLadderConfig(session.config);
  const now = NOW();

  if (action.type === 'update_ladder_config') {
    if (!isHost) throw new Error('FORBIDDEN');
    const isConfig = session.status === 'config';
    const isDraw = session.status === 'active' && session.phase === 'draw';
    const isLaneChange = Boolean(action.addLane || action.removeLane);

    if (isLaneChange && !isDraw) throw new Error('FORBIDDEN');
    if (action.destinations && !isConfig) throw new Error('FORBIDDEN');
    if (action.participantIds && !isConfig && !isDraw) throw new Error('FORBIDDEN');

    let participantIds = [...config.participantIds];
    let destinations = [...config.destinations];
    let userRungs = config.userRungs ?? [];

    if (action.participantIds) {
      participantIds = action.participantIds;
      destinations = participantIds.map((_, i) => destinations[i] ?? `Result ${i + 1}`);
    }
    if (action.destinations) {
      destinations = action.destinations;
    }
    if (action.addLane) {
      if (participantIds.length >= LADDER_MAX_LANES) throw new Error('MAX_LANES');
      participantIds.push('');
      destinations.push(`Result ${participantIds.length}`);
    }
    if (action.removeLane) {
      if (participantIds.length <= LADDER_MIN_LANES) throw new Error('MIN_LANES');
      const removedId = participantIds[participantIds.length - 1];
      participantIds = participantIds.slice(0, -1);
      destinations = destinations.slice(0, -1);
      const maxLeftLane = participantIds.length - 2;
      userRungs = userRungs.filter(
        (r) => r.leftLane <= maxLeftLane && r.drawnBy !== removedId,
      );
    }

    const newConfig: LadderSessionConfig = { ...config, participantIds, destinations, userRungs };
    await updateSession(supabase, session.id, {
      config: newConfig,
      updated_at: now,
    });
    await syncLadderParticipants(supabase, session.id, participantIds, now);

    if (action.removeLane && isDraw) {
      const drawnIds = new Set(userRungs.map((r) => r.drawnBy).filter(Boolean));
      for (const p of participants) {
        if (!participantIds.includes(p.user_id)) continue;
        if (p.ready && !drawnIds.has(p.user_id)) {
          await supabase
            .from('family_game_participants')
            .update({ ready: false, payload: {}, updated_at: now })
            .eq('session_id', session.id)
            .eq('user_id', p.user_id);
        }
      }
    }
    return;
  }

  if (action.type === 'update_own_destination') {
    if (session.status !== 'config') throw new Error('FORBIDDEN');
    const slotIndex = participants.find((p) => p.user_id === userId)?.slot_index;
    if (slotIndex === undefined) throw new Error('NOT_A_PARTICIPANT');
    const destinations = [...config.destinations];
    destinations[slotIndex] = action.destination.trim();
    await updateSession(supabase, session.id, {
      config: { ...config, destinations },
      updated_at: now,
    });
    await supabase
      .from('family_game_participants')
      .update({
        payload: { destination: action.destination.trim() },
        updated_at: now,
      })
      .eq('session_id', session.id)
      .eq('user_id', userId);
    return;
  }

  if (action.type === 'host_begin_draw') {
    if (!isHost || session.status !== 'config') throw new Error('FORBIDDEN');
    const idsOk =
      config.participantIds.every((id) => id.trim()) &&
      new Set(config.participantIds).size === config.participantIds.length;
    if (!idsOk || config.participantIds.length < LADDER_MIN_LANES) throw new Error('INVALID_CONFIG');
    const destinations = config.destinations.map((d, i) =>
      d.trim() ? d.trim() : `Result ${i + 1}`,
    );
    await updateSession(supabase, session.id, {
      status: 'active',
      phase: 'draw',
      config: { ...config, destinations, userRungs: [] },
      updated_at: now,
    });
    await supabase
      .from('family_game_participants')
      .update({ ready: false, payload: {}, updated_at: now })
      .eq('session_id', session.id);
    return;
  }

  if (action.type === 'draw_rung') {
    if (session.status !== 'active' || session.phase !== 'draw') throw new Error('FORBIDDEN');
    const participant = participants.find((p) => p.user_id === userId);
    if (!participant) throw new Error('NOT_A_PARTICIPANT');
    if (participant.ready) throw new Error('ALREADY_DRAWN');

    const { leftLane, row } = action;
    const laneCount = config.participantIds.length;
    if (leftLane < 0 || leftLane >= laneCount - 1 || row < 0 || row >= LADDER_ROW_COUNT) {
      throw new Error('INVALID_RUNG');
    }

    const userRungs = config.userRungs ?? [];
    const exists = userRungs.some((r) => r.leftLane === leftLane && r.row === row);
    if (exists) throw new Error('RUNG_TAKEN');

    const newRung: LadderRung = { leftLane, row, drawnBy: userId };
    const nextRungs = [...userRungs, newRung];

    await updateSession(supabase, session.id, {
      config: { ...config, userRungs: nextRungs },
      updated_at: now,
    });
    await supabase
      .from('family_game_participants')
      .update({
        ready: true,
        payload: { ladderRung: { leftLane, row } },
        updated_at: now,
      })
      .eq('session_id', session.id)
      .eq('user_id', userId);
    return;
  }

  if (action.type === 'host_start_ladder') {
    if (!isHost || session.status !== 'active' || session.phase !== 'draw') throw new Error('FORBIDDEN');
    const laneCount = config.participantIds.length;
    const userRungs = config.userRungs ?? [];
    const finalRungs = generateDenseLadderRungsSeeded(
      laneCount,
      userRungs,
      LADDER_ROW_COUNT,
      session.id,
    );
    await updateSession(supabase, session.id, {
      status: 'revealing',
      phase: 'result',
      config: {
        ...config,
        finalRungs,
        revealStartedAt: now,
      },
      updated_at: now,
    });
    return;
  }

  if (action.type === 'host_complete_ladder') {
    if (!isHost || session.status !== 'revealing') throw new Error('FORBIDDEN');
    await updateSession(supabase, session.id, {
      status: 'completed',
      updated_at: now,
    });
  }
}

async function handleRPSAction(
  supabase: SupabaseClient,
  session: FamilyGameSessionRow,
  participants: FamilyGameParticipantRow[],
  userId: string,
  isHost: boolean,
  action: GameSessionAction,
): Promise<void> {
  const config = asRPSConfig(session.config);
  const now = NOW();

  if (action.type === 'submit_rps') {
    if (session.status !== 'active' || session.phase !== 'select') throw new Error('FORBIDDEN');
    if (userId !== config.p1UserId && userId !== config.p2UserId) throw new Error('NOT_A_PARTICIPANT');
    if (!['rock', 'paper', 'scissors'].includes(action.choice)) throw new Error('INVALID_CHOICE');

    await supabase.from('family_game_participant_secrets').upsert(
      {
        session_id: session.id,
        user_id: userId,
        secret: { rps_choice: action.choice },
        updated_at: now,
      },
      { onConflict: 'session_id,user_id' },
    );

    await supabase
      .from('family_game_participants')
      .update({ ready: true, updated_at: now })
      .eq('session_id', session.id)
      .eq('user_id', userId);

    const allReady = await checkAllParticipantsReady(supabase, session.id, 2);
    if (allReady) {
      await autoRevealRPS(supabase, session, config, now);
    }
    return;
  }

  if (action.type === 'host_reveal_rps') {
    if (!isHost) throw new Error('HOST_ONLY');
    await autoRevealRPS(supabase, session, config, now);
  }
}

async function autoRevealRPS(
  supabase: SupabaseClient,
  session: FamilyGameSessionRow,
  config: RPSSessionConfig,
  now: string,
): Promise<void> {
  const { data: secrets } = await supabase
    .from('family_game_participant_secrets')
    .select('user_id, secret')
    .eq('session_id', session.id);

  const choiceFor = (uid: string): RPSChoice | null => {
    const row = secrets?.find((s) => s.user_id === uid);
    const choice = row?.secret?.rps_choice;
    return choice === 'rock' || choice === 'paper' || choice === 'scissors' ? choice : null;
  };

  const p1Choice = choiceFor(config.p1UserId);
  const p2Choice = choiceFor(config.p2UserId);
  if (!p1Choice || !p2Choice) throw new Error('CHOICES_INCOMPLETE');

  const outcome = resolveRPS(p1Choice, p2Choice);

  await updateSession(supabase, session.id, {
    status: 'revealing',
    phase: 'reveal',
    config: {
      ...config,
      p1Choice,
      p2Choice,
      outcome,
      revealStartedAt: now,
    },
    updated_at: now,
  });
}

async function handleRouletteAction(
  supabase: SupabaseClient,
  session: FamilyGameSessionRow,
  participants: FamilyGameParticipantRow[],
  userId: string,
  isHost: boolean,
  action: GameSessionAction,
): Promise<void> {
  const config = asRouletteConfig(session.config);
  const now = NOW();

  if (action.type === 'host_update_roulette_config') {
    if (!isHost || session.status !== 'config') throw new Error('FORBIDDEN');
    const selectedIds = action.selectedIds ?? config.selectedIds;
    const slotsPerMember = action.slotsPerMember ?? config.slotsPerMember;
    if (selectedIds.length < 2) throw new Error('ROULETTE_MIN_PARTICIPANTS');
    await updateSession(supabase, session.id, {
      config: { ...config, selectedIds, slotsPerMember },
      updated_at: now,
    });
    await syncRouletteParticipants(supabase, session.id, selectedIds, now);
    return;
  }

  if (action.type === 'toggle_roulette_ready') {
    if (session.status !== 'config') throw new Error('FORBIDDEN');
    const participant = participants.find((p) => p.user_id === userId);
    if (!participant) throw new Error('NOT_A_PARTICIPANT');
    await supabase
      .from('family_game_participants')
      .update({ ready: !participant.ready, updated_at: now })
      .eq('session_id', session.id)
      .eq('user_id', userId);

    const updatedParticipants = await fetchParticipants(supabase, session.id);
    const allReady =
      updatedParticipants.length >= 2 &&
      config.selectedIds.every((id) =>
        updatedParticipants.some((p) => p.user_id === id && p.ready),
      );
    if (allReady) {
      await updateSession(supabase, session.id, {
        status: 'active',
        phase: 'spin',
        updated_at: now,
      });
    }
    return;
  }

  if (action.type === 'host_spin_roulette') {
    if (!isHost || (session.status !== 'active' && session.status !== 'config')) throw new Error('FORBIDDEN');
    const selectedIds = config.selectedIds;
    const segments = buildRouletteSegments(selectedIds, config.slotsPerMember, (id) => id);
    const totalSlots = segments.length;
    if (totalSlots < 2) throw new Error('INVALID_WHEEL');

    const extraTurns = 5 + Math.floor(Math.random() * 4);
    const randomOffset = Math.random() * 360;
    const rotation = extraTurns * 360 + randomOffset;
    const index = pickRouletteIndex(totalSlots, rotation);
    const winnerSegment = segments[index];

    await updateSession(supabase, session.id, {
      status: 'completed',
      phase: 'result',
      config: {
        ...config,
        rotation,
        winnerUserId: winnerSegment?.userId ?? '',
        winnerIndex: index,
        spinStartedAt: now,
      },
      updated_at: now,
    });
  }
}

async function checkAllParticipantsReady(
  supabase: SupabaseClient,
  sessionId: string,
  expected: number,
): Promise<boolean> {
  const participants = await fetchParticipants(supabase, sessionId);
  return participants.length >= expected && participants.every((p) => p.ready);
}

async function syncLadderParticipants(
  supabase: SupabaseClient,
  sessionId: string,
  participantIds: string[],
  now: string,
): Promise<void> {
  const existing = await fetchParticipants(supabase, sessionId);
  const existingIds = new Set(existing.map((p) => p.user_id));

  for (let i = 0; i < participantIds.length; i += 1) {
    const uid = participantIds[i];
    if (!uid) continue;
    if (!existingIds.has(uid)) {
      await supabase.from('family_game_participants').insert({
        session_id: sessionId,
        user_id: uid,
        slot_index: i,
        ready: false,
        payload: {},
        created_at: now,
        updated_at: now,
      });
    } else {
      await supabase
        .from('family_game_participants')
        .update({ slot_index: i, updated_at: now })
        .eq('session_id', sessionId)
        .eq('user_id', uid);
    }
  }

  const validSet = new Set(participantIds.filter(Boolean));
  for (const p of existing) {
    if (!validSet.has(p.user_id)) {
      await supabase
        .from('family_game_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', p.user_id);
    }
  }
}

async function syncRouletteParticipants(
  supabase: SupabaseClient,
  sessionId: string,
  selectedIds: string[],
  now: string,
): Promise<void> {
  await syncLadderParticipants(supabase, sessionId, selectedIds, now);
}

async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('family_game_sessions')
    .update(patch)
    .eq('id', sessionId);
  if (error) throw error;
}

// Set initial RPS session to active/select on create
export async function finalizeSessionAfterCreate(
  supabase: SupabaseClient,
  bundle: FamilyGameSessionBundle,
): Promise<FamilyGameSessionBundle> {
  const { session } = bundle;
  if (session.game_type === 'rps') {
    await updateSession(supabase, session.id, {
      status: 'active',
      phase: 'select',
      updated_at: NOW(),
    });
  }
  return (await fetchSessionBundle(supabase, session.id))!;
}
