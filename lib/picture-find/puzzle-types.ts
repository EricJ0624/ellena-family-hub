import type { PictureFindMode, PictureFindScene } from './types';

export type PictureFindPuzzleRow = {
  id: string;
  group_id: string;
  scene_id: string;
  mode: PictureFindMode;
  seed: string;
  title: string;
  item_count: number;
  published_by: string;
  is_active: boolean;
  created_at: string;
};

export type PictureFindSharedPuzzle = {
  id: string;
  groupId: string;
  sceneId: string;
  mode: PictureFindMode;
  seed: string;
  title: string;
  itemCount: number;
  publishedBy: string;
  createdAt: string;
  scene: PictureFindScene | null;
  myAttempt: PictureFindAttemptSummary | null;
  attemptCount: number;
};

export type PictureFindAttemptSummary = {
  id: string;
  puzzleId: string;
  userId: string;
  foundCount: number;
  totalCount: number;
  remainingMs: number;
  hintsUsed: number;
  timedOut: boolean;
  completed: boolean;
  elapsedMs: number;
  createdAt: string;
  nickname?: string | null;
};

export type PictureFindLeaderboardEntry = PictureFindAttemptSummary & {
  rank: number;
};

export function mapPuzzleRow(row: PictureFindPuzzleRow): Omit<PictureFindSharedPuzzle, 'scene' | 'myAttempt' | 'attemptCount'> {
  return {
    id: row.id,
    groupId: row.group_id,
    sceneId: row.scene_id,
    mode: row.mode,
    seed: row.seed,
    title: row.title,
    itemCount: row.item_count,
    publishedBy: row.published_by,
    createdAt: row.created_at,
  };
}

export const PICTURE_FIND_PUZZLE_SELECT =
  'id, group_id, scene_id, mode, seed, title, item_count, published_by, is_active, created_at';

export const PICTURE_FIND_ATTEMPT_SELECT =
  'id, puzzle_id, group_id, user_id, found_count, total_count, remaining_ms, hints_used, timed_out, completed, elapsed_ms, created_at';

export function mapAttemptRow(row: {
  id: string;
  puzzle_id: string;
  user_id: string;
  found_count: number;
  total_count: number;
  remaining_ms: number;
  hints_used: number;
  timed_out: boolean;
  completed: boolean;
  elapsed_ms: number;
  created_at: string;
}): PictureFindAttemptSummary {
  return {
    id: row.id,
    puzzleId: row.puzzle_id,
    userId: row.user_id,
    foundCount: row.found_count,
    totalCount: row.total_count,
    remainingMs: row.remaining_ms,
    hintsUsed: row.hints_used,
    timedOut: row.timed_out,
    completed: row.completed,
    elapsedMs: row.elapsed_ms,
    createdAt: row.created_at,
  };
}

/** Prefer completed, then more found, then faster elapsed, then fewer hints */
export function isBetterAttempt(
  next: { completed: boolean; foundCount: number; elapsedMs: number; hintsUsed: number },
  prev: { completed: boolean; foundCount: number; elapsedMs: number; hintsUsed: number },
): boolean {
  if (next.completed !== prev.completed) return next.completed;
  if (next.foundCount !== prev.foundCount) return next.foundCount > prev.foundCount;
  if (next.elapsedMs !== prev.elapsedMs) return next.elapsedMs < prev.elapsedMs;
  return next.hintsUsed < prev.hintsUsed;
}
