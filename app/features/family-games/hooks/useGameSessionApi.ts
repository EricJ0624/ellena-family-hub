'use client';

import { supabase } from '@/lib/supabase';
import type {
  CreateGameSessionBody,
  FamilyGameSessionBundle,
  GameSessionAction,
} from '@/lib/family-games/session-types';

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchActiveGameSession(groupId: string): Promise<FamilyGameSessionBundle | null> {
  const response = await authFetch(`/api/games/sessions?groupId=${encodeURIComponent(groupId)}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to load session');
  return result.data ?? null;
}

export async function fetchGameSession(sessionId: string): Promise<FamilyGameSessionBundle> {
  const response = await authFetch(`/api/games/sessions/${sessionId}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to load session');
  return result.data;
}

export async function createGameSessionApi(body: CreateGameSessionBody): Promise<FamilyGameSessionBundle> {
  const response = await authFetch('/api/games/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to create session');
  return result.data;
}

export async function joinGameSessionApi(sessionId: string): Promise<void> {
  const response = await authFetch(`/api/games/sessions/${sessionId}/join`, { method: 'POST' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to join session');
}

export async function performGameActionApi(
  sessionId: string,
  action: GameSessionAction,
): Promise<FamilyGameSessionBundle> {
  const response = await authFetch(`/api/games/sessions/${sessionId}/action`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Action failed');
  return result.data;
}
