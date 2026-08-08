import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { buildPictureFindPuzzle } from '@/lib/picture-find/game-logic';
import {
  mapAttemptRow,
  mapPuzzleRow,
  PICTURE_FIND_ATTEMPT_SELECT,
  PICTURE_FIND_PUZZLE_SELECT,
} from '@/lib/picture-find/puzzle-types';
import { mapSceneRow, PICTURE_FIND_SCENE_SELECT } from '@/lib/picture-find/scene-mapper';
import type { PictureFindMode } from '@/lib/picture-find/types';

/**
 * List active family puzzles for a group (with scene + my attempt summary).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: puzzleRows, error } = await supabase
      .from('picture_find_puzzles')
      .select(PICTURE_FIND_PUZZLE_SELECT)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[picture-find/puzzles] list error:', error);
      return NextResponse.json({ error: '가족 퍼즐 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const puzzles = puzzleRows ?? [];
    const sceneIds = [...new Set(puzzles.map((p) => p.scene_id))];
    const puzzleIds = puzzles.map((p) => p.id);

    const [{ data: scenes }, { data: attempts }, { data: counts }] = await Promise.all([
      sceneIds.length
        ? supabase.from('picture_find_scenes').select(PICTURE_FIND_SCENE_SELECT).in('id', sceneIds)
        : Promise.resolve({ data: [] as never[] }),
      puzzleIds.length
        ? supabase
            .from('picture_find_attempts')
            .select(PICTURE_FIND_ATTEMPT_SELECT)
            .eq('user_id', user.id)
            .in('puzzle_id', puzzleIds)
        : Promise.resolve({ data: [] as never[] }),
      puzzleIds.length
        ? supabase.from('picture_find_attempts').select('puzzle_id').in('puzzle_id', puzzleIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const sceneMap = new Map((scenes ?? []).map((s) => [s.id, mapSceneRow(s)]));
    const myAttemptMap = new Map((attempts ?? []).map((a) => [a.puzzle_id, mapAttemptRow(a)]));
    const attemptCountMap = new Map<string, number>();
    for (const row of counts ?? []) {
      attemptCountMap.set(row.puzzle_id, (attemptCountMap.get(row.puzzle_id) ?? 0) + 1);
    }

    return NextResponse.json({
      success: true,
      data: puzzles.map((row) => ({
        ...mapPuzzleRow(row),
        scene: sceneMap.get(row.scene_id) ?? null,
        myAttempt: myAttemptMap.get(row.id) ?? null,
        attemptCount: attemptCountMap.get(row.id) ?? 0,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '가족 퍼즐 목록 조회 중 오류가 발생했습니다.';
    console.error('[picture-find/puzzles] GET', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Publish a family puzzle with a fixed seed so all members play the same layout.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, sceneId, mode, seed, title } = body ?? {};

    if (!groupId || !sceneId || !mode || !seed) {
      return NextResponse.json({ error: 'groupId, sceneId, mode, seed는 필수입니다.' }, { status: 400 });
    }
    if (mode !== 'hidden' && mode !== 'spot_diff') {
      return NextResponse.json({ error: 'mode가 올바르지 않습니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, String(groupId));
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: scene, error: sceneError } = await supabase
      .from('picture_find_scenes')
      .select(PICTURE_FIND_SCENE_SELECT)
      .eq('id', String(sceneId))
      .eq('is_active', true)
      .maybeSingle();

    if (sceneError || !scene) {
      return NextResponse.json({ error: '장면을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (scene.scope === 'group' && scene.group_id !== String(groupId)) {
      return NextResponse.json({ error: '다른 그룹의 장면은 공유할 수 없습니다.' }, { status: 403 });
    }
    if (mode === 'hidden' && !scene.supports_hidden) {
      return NextResponse.json({ error: '이 장면은 숨은그림찾기를 지원하지 않습니다.' }, { status: 400 });
    }
    if (mode === 'spot_diff' && !scene.supports_spot_diff) {
      return NextResponse.json({ error: '이 장면은 틀린그림찾기를 지원하지 않습니다.' }, { status: 400 });
    }

    const puzzle = buildPictureFindPuzzle(String(sceneId), String(seed));
    const safeTitle =
      String(title || `${scene.title} · ${mode === 'hidden' ? '숨은그림' : '틀린그림'}`)
        .trim()
        .slice(0, 80) || scene.title;

    const { data, error } = await supabase
      .from('picture_find_puzzles')
      .insert({
        group_id: String(groupId),
        scene_id: String(sceneId),
        mode: mode as PictureFindMode,
        seed: String(seed),
        title: safeTitle,
        item_count: puzzle.itemCount,
        published_by: user.id,
        is_active: true,
      })
      .select(PICTURE_FIND_PUZZLE_SELECT)
      .single();

    if (error || !data) {
      console.error('[picture-find/puzzles] insert error:', error);
      return NextResponse.json({ error: '가족 퍼즐 공유에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...mapPuzzleRow(data),
          scene: mapSceneRow(scene),
          myAttempt: null,
          attemptCount: 0,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '가족 퍼즐 공유 중 오류가 발생했습니다.';
    console.error('[picture-find/puzzles] POST', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
