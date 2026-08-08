import { supabase } from '@/lib/supabase';
import type { PictureFindMode } from '@/lib/picture-find/types';
import type {
  PictureFindAttemptSummary,
  PictureFindLeaderboardEntry,
  PictureFindSharedPuzzle,
} from '@/lib/picture-find/puzzle-types';

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('인증 세션이 필요합니다.');
  return session.access_token;
}

async function authJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '요청에 실패했습니다.');
  return json as T;
}

export async function fetchPictureFindPuzzles(groupId: string): Promise<PictureFindSharedPuzzle[]> {
  const json = await authJson<{ data: PictureFindSharedPuzzle[] }>(
    `/api/v1/picture-find/puzzles?groupId=${encodeURIComponent(groupId)}`,
  );
  return json.data ?? [];
}

export async function publishPictureFindPuzzle(params: {
  groupId: string;
  sceneId: string;
  mode: PictureFindMode;
  seed: string;
  title?: string;
}): Promise<PictureFindSharedPuzzle> {
  const json = await authJson<{ data: PictureFindSharedPuzzle }>('/api/v1/picture-find/puzzles', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return json.data;
}

export async function deletePictureFindPuzzle(puzzleId: string): Promise<void> {
  await authJson(`/api/v1/picture-find/puzzles/${encodeURIComponent(puzzleId)}`, {
    method: 'DELETE',
  });
}

export async function submitPictureFindAttempt(params: {
  puzzleId: string;
  foundCount: number;
  remainingMs: number;
  hintsUsed: number;
  timedOut: boolean;
}): Promise<PictureFindAttemptSummary> {
  const json = await authJson<{ data: PictureFindAttemptSummary }>(
    `/api/v1/picture-find/puzzles/${encodeURIComponent(params.puzzleId)}/attempts`,
    {
      method: 'POST',
      body: JSON.stringify({
        foundCount: params.foundCount,
        remainingMs: params.remainingMs,
        hintsUsed: params.hintsUsed,
        timedOut: params.timedOut,
      }),
    },
  );
  return json.data;
}

export async function fetchPictureFindLeaderboard(puzzleId: string): Promise<{
  leaderboard: PictureFindLeaderboardEntry[];
  myRank: number | null;
}> {
  const json = await authJson<{
    data: { leaderboard: PictureFindLeaderboardEntry[]; myRank: number | null };
  }>(`/api/v1/picture-find/puzzles/${encodeURIComponent(puzzleId)}/attempts`);
  return json.data;
}
