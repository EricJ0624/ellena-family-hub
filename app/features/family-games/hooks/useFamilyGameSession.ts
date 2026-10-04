'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isLobbyPhase } from '@/lib/family-games/lobby-helpers';
import type {
  FamilyGameSessionBundle,
  FamilyGameType,
  GameSessionAction,
} from '@/lib/family-games/session-types';
import { isActiveGameStatus, isTerminalGameSession } from '@/lib/family-games/session-types';
import {
  fetchActiveGameSession,
  fetchGameSession,
  lobbyJoinGameSessionApi,
  performGameActionApi,
} from './useGameSessionApi';
import { useFamilyGameRealtime } from './useFamilyGameRealtime';
import { isSupabaseLockError } from '@/lib/supabase-error';
import { supabase } from '@/lib/supabase';

interface UseFamilyGameSessionProps {
  groupId: string | null;
  userId: string;
}

export function useFamilyGameSession({ groupId, userId }: UseFamilyGameSessionProps) {
  const [bundle, setBundle] = useState<FamilyGameSessionBundle | null>(null);
  const bundleRef = useRef<FamilyGameSessionBundle | null>(null);
  const refreshGenRef = useRef(0);
  const [loading, setLoading] = useState(Boolean(groupId));
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);

  const refresh = useCallback(async () => {
    if (!groupId) {
      refreshGenRef.current += 1;
      setBundle(null);
      setLoading(false);
      return;
    }
    const gen = ++refreshGenRef.current;
    const isCurrent = () => gen === refreshGenRef.current;
    let authPending = false;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActiveGameSession(groupId);
      if (!isCurrent()) return;
      if (data) {
        setBundle(data);
        return;
      }

      const prev = bundleRef.current;
      if (!prev?.session.id) {
        setBundle(null);
        return;
      }

      try {
        const latest = await fetchGameSession(prev.session.id);
        if (!isCurrent()) return;
        if (!latest || latest.session.status === 'cancelled') {
          setBundle(null);
        } else {
          setBundle(latest);
        }
      } catch {
        if (!isCurrent()) return;
        setBundle(null);
      }
    } catch (err) {
      if (!isCurrent()) return;
      const message = err instanceof Error ? err.message : 'Failed to load session';
      if (message === 'NOT_AUTHENTICATED') {
        authPending = true;
        return;
      }
      // Supabase 내부 lock 경쟁 에러는 사용자에게 노출하지 않음
      if (!isSupabaseLockError(err)) {
        console.error('Failed to refresh game session:', err);
        setError(message);
      }
    } finally {
      if (isCurrent() && !authPending) setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return undefined;
    const run = () => {
      void refresh();
    };
    run();
    const { data: authSubscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        run();
      }
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      authSubscription.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [groupId, refresh]);

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
        // Supabase 내부 lock 경쟁 에러는 사용자에게 노출하지 않음
        if (!isSupabaseLockError(err)) {
          const message = err instanceof Error ? err.message : 'Failed to join lobby';
          setError(message);
        }
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
      // Supabase 내부 lock 경쟁 에러는 사용자에게 노출하지 않음
      if (!isSupabaseLockError(err)) {
        const message = err instanceof Error ? err.message : 'Leave failed';
        setError(message);
      }
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
        // Supabase 내부 lock 경쟁 에러는 사용자에게 노출하지 않음
        if (!isSupabaseLockError(err)) {
          const message = err instanceof Error ? err.message : 'Action failed';
          setError(message);
          if (message === 'FORBIDDEN' || message === 'HOST_ONLY') {
            await refresh();
          }
        }
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [bundle?.session.id, refresh],
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
      setBundle(null);
      await refresh();
      return updated;
    } catch (err) {
      // Supabase 내부 lock 경쟁 에러는 사용자에게 노출하지 않음
      if (!isSupabaseLockError(err)) {
        const message = err instanceof Error ? err.message : 'Cancel failed';
        setError(message);
      }
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
    bundle &&
      isActiveGameStatus(bundle.session.status) &&
      !isTerminalGameSession(bundle.session),
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
