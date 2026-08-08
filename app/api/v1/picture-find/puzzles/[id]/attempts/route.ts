import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { buildPictureFindPuzzle } from '@/lib/picture-find/game-logic';
import {
  isBetterAttempt,
  mapAttemptRow,
  PICTURE_FIND_ATTEMPT_SELECT,
  PICTURE_FIND_PUZZLE_SELECT,
} from '@/lib/picture-find/puzzle-types';
import {
  PICTURE_FIND_DURATION_MS,
  PICTURE_FIND_MAX_HINTS,
} from '@/lib/picture-find/types';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Submit/upsert an attempt for a shared puzzle with server-side soft validation.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: puzzleId } = await context.params;
    if (!puzzleId) {
      return NextResponse.json({ error: '퍼즐 ID가 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();
    const foundCount = Number(body?.foundCount);
    const remainingMs = Number(body?.remainingMs);
    const hintsUsed = Number(body?.hintsUsed);
    const timedOut = Boolean(body?.timedOut);

    if (!Number.isFinite(foundCount) || foundCount < 0) {
      return NextResponse.json({ error: 'foundCount가 올바르지 않습니다.' }, { status: 400 });
    }
    if (!Number.isFinite(remainingMs) || remainingMs < 0 || remainingMs > PICTURE_FIND_DURATION_MS) {
      return NextResponse.json({ error: 'remainingMs가 올바르지 않습니다.' }, { status: 400 });
    }
    if (!Number.isFinite(hintsUsed) || hintsUsed < 0 || hintsUsed > PICTURE_FIND_MAX_HINTS) {
      return NextResponse.json({ error: 'hintsUsed가 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: puzzle, error: puzzleError } = await supabase
      .from('picture_find_puzzles')
      .select(PICTURE_FIND_PUZZLE_SELECT)
      .eq('id', puzzleId)
      .eq('is_active', true)
      .maybeSingle();

    if (puzzleError || !puzzle) {
      return NextResponse.json({ error: '퍼즐을 찾을 수 없습니다.' }, { status: 404 });
    }

    const memberCheck = await requireGroupMember(user.id, puzzle.group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const rebuilt = buildPictureFindPuzzle(puzzle.scene_id, puzzle.seed);
    if (rebuilt.itemCount !== puzzle.item_count) {
      console.warn('[picture-find/attempts] item_count mismatch', {
        puzzleId,
        stored: puzzle.item_count,
        rebuilt: rebuilt.itemCount,
      });
    }

    const totalCount = puzzle.item_count;
    const safeFound = Math.min(Math.floor(foundCount), totalCount);
    const completed = safeFound >= totalCount && !timedOut;
    const elapsedMs = Math.max(0, PICTURE_FIND_DURATION_MS - Math.floor(remainingMs));

    const { data: existing } = await supabase
      .from('picture_find_attempts')
      .select(PICTURE_FIND_ATTEMPT_SELECT)
      .eq('puzzle_id', puzzleId)
      .eq('user_id', user.id)
      .maybeSingle();

    const nextPayload = {
      puzzle_id: puzzleId,
      group_id: puzzle.group_id,
      user_id: user.id,
      found_count: safeFound,
      total_count: totalCount,
      remaining_ms: Math.floor(remainingMs),
      hints_used: Math.floor(hintsUsed),
      timed_out: timedOut,
      completed,
      elapsed_ms: elapsedMs,
    };

    if (existing) {
      const prev = mapAttemptRow(existing);
      const shouldReplace = isBetterAttempt(
        {
          completed,
          foundCount: safeFound,
          elapsedMs,
          hintsUsed: Math.floor(hintsUsed),
        },
        {
          completed: prev.completed,
          foundCount: prev.foundCount,
          elapsedMs: prev.elapsedMs,
          hintsUsed: prev.hintsUsed,
        },
      );

      if (!shouldReplace) {
        return NextResponse.json({
          success: true,
          data: prev,
          updated: false,
        });
      }

      const { data: updated, error: updateError } = await supabase
        .from('picture_find_attempts')
        .update(nextPayload)
        .eq('id', existing.id)
        .select(PICTURE_FIND_ATTEMPT_SELECT)
        .single();

      if (updateError || !updated) {
        console.error('[picture-find/attempts] update error:', updateError);
        return NextResponse.json({ error: '기록 저장에 실패했습니다.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: mapAttemptRow(updated), updated: true });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('picture_find_attempts')
      .insert(nextPayload)
      .select(PICTURE_FIND_ATTEMPT_SELECT)
      .single();

    if (insertError || !inserted) {
      console.error('[picture-find/attempts] insert error:', insertError);
      return NextResponse.json({ error: '기록 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: mapAttemptRow(inserted), updated: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '기록 저장 중 오류가 발생했습니다.';
    console.error('[picture-find/attempts] POST', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Leaderboard for a shared puzzle (group members only).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: puzzleId } = await context.params;
    if (!puzzleId) {
      return NextResponse.json({ error: '퍼즐 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: puzzle, error: puzzleError } = await supabase
      .from('picture_find_puzzles')
      .select('id, group_id, is_active')
      .eq('id', puzzleId)
      .maybeSingle();

    if (puzzleError || !puzzle || !puzzle.is_active) {
      return NextResponse.json({ error: '퍼즐을 찾을 수 없습니다.' }, { status: 404 });
    }

    const memberCheck = await requireGroupMember(user.id, puzzle.group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const { data: attempts, error } = await supabase
      .from('picture_find_attempts')
      .select(PICTURE_FIND_ATTEMPT_SELECT)
      .eq('puzzle_id', puzzleId)
      .order('completed', { ascending: false })
      .order('found_count', { ascending: false })
      .order('elapsed_ms', { ascending: true })
      .order('hints_used', { ascending: true })
      .limit(50);

    if (error) {
      console.error('[picture-find/attempts] leaderboard error:', error);
      return NextResponse.json({ error: '리더보드 조회에 실패했습니다.' }, { status: 500 });
    }

    const rows = attempts ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, nickname').in('id', userIds)
      : { data: [] as { id: string; nickname: string | null }[] };

    const nickMap = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));

    const leaderboard = rows.map((row, index) => ({
      ...mapAttemptRow(row),
      nickname: nickMap.get(row.user_id) ?? null,
      rank: index + 1,
    }));

    return NextResponse.json({
      success: true,
      data: {
        puzzleId,
        leaderboard,
        myRank: leaderboard.find((e) => e.userId === user.id)?.rank ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '리더보드 조회 중 오류가 발생했습니다.';
    console.error('[picture-find/attempts] GET', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
