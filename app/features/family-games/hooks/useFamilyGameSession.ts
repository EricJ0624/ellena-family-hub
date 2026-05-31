'use client';

import { useCallback, useEffect, useState } from 'react';
import { isLobbyPhase } from '@/lib/family-games/lobby-helpers';
import type {
  FamilyGameSessionBundle,
  FamilyGameType,
  GameSessionAction,
} from '@/lib/family-games/session-types';
import { isActiveGameStatus } from '@/lib/family-games/session-types';
import {
  fetchActiveGameSession,
  fetchGameSession,
  lobbyJoinGameSessionApi,
  performGameActionApi,
} from './useGameSessionApi';
import { useFamilyGameRealtime } from './useFamilyGameRealtime';

interface UseFamilyGameSessionProps {
  groupId: string | null;
  userId: string;
}

export function useFamilyGameSession({ groupId, userId }: UseFamilyGameSessionProps) {
  const [bundle, setBundle] = useState<FamilyGameSessionBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!groupId) {
      setBundle(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchActiveGameSession(groupId);
      setBundle(data);
    } catch (err) {
      console.error('Failed to refresh game session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFamilyGameRealtime({
    groupId,
    sessionId: bundle?.session.id ?? null,
    onSessionChange: refresh,
  });

  const lobbyJoin = useCallback(
    async (gameType: FamilyGameType) => {
      if (!groupId) throw new Error('No group');
      setActionLoading(true);
      setError(null);
      try {
        const joined = await lobbyJoinGameSessionApi({ groupId, gameType });
        setBundle(joined);
        return joined;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join lobby';
        setError(message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [groupId],
  );

  const leaveLobby = useCallback(async () => {
    if (!bundle?.session.id) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await performGameActionApi(bundle.session.id, { type: 'leave_lobby' });
      if (updated.session.status === 'cancelled') {
        setBundle(null);
        await refresh();
      } else {
        setBundle(updated);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Leave failed';
      setError(message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [bundle?.session.id, refresh]);

  const performAction = useCallback(
    async (action: GameSessionAction) => {
      if (!bundle?.session.id) throw new Error('No active session');
      setActionLoading(true);
      setError(null);
      try {
        const updated = await performGameActionApi(bundle.session.id, action);
        setBundle(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [bundle?.session.id],
  );

  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const data = await fetchGameSession(sessionId);
      setBundle(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelSession = useCallback(async () => {
    if (!bundle?.session.id) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await performGameActionApi(bundle.session.id, { type: 'cancel' });
      setBundle(updated.session.status === 'cancelled' ? null : updated);
      if (updated.session.status === 'cancelled') {
        await refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancel failed';
      setError(message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [bundle?.session.id, refresh]);

  const isHost = bundle?.session.host_user_id === userId;
  const isParticipant = Boolean(
    bundle?.participants.some((p) => p.user_id === userId),
  );
  const hasActiveSession = Boolean(
    bundle && isActiveGameStatus(bundle.session.status),
  );
  const myParticipant =
    bundle?.participants.find((p) => p.user_id === userId) ?? null;

  const isLobby = Boolean(bundle && isLobbyPhase(bundle.session));

  return {
    bundle,
    loading,
    actionLoading,
    error,
    refresh,
    lobbyJoin,
    leaveLobby,
    performAction,
    cancelSession,
    loadSession,
    isHost,
    isParticipant,
    hasActiveSession,
    isLobby,
    myParticipant,
  };
}
