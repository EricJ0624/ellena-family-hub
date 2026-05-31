'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseFamilyGameRealtimeProps {
  groupId: string | null;
  sessionId: string | null;
  onSessionChange: () => void;
}

export function useFamilyGameRealtime({
  groupId,
  sessionId,
  onSessionChange,
}: UseFamilyGameRealtimeProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onChangeRef = useRef(onSessionChange);
  onChangeRef.current = onSessionChange;

  useEffect(() => {
    if (!groupId) return undefined;

    const channel = supabase
      .channel(`family_games:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_game_sessions',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          onChangeRef.current();
        },
      );

    if (sessionId) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_game_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          onChangeRef.current();
        },
      );
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [groupId, sessionId]);
}
