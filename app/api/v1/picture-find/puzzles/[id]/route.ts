import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin, requireGroupMember } from '@/lib/api-guards';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Soft-deactivate a family puzzle. Publisher or group admin only.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuthUser(_request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: '퍼즐 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: puzzle, error } = await supabase
      .from('picture_find_puzzles')
      .select('id, group_id, published_by, is_active')
      .eq('id', id)
      .maybeSingle();

    if (error || !puzzle) {
      return NextResponse.json({ error: '퍼즐을 찾을 수 없습니다.' }, { status: 404 });
    }

    const memberCheck = await requireGroupMember(user.id, puzzle.group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    if (puzzle.published_by !== user.id) {
      const adminCheck = await requireGroupAdmin(user.id, puzzle.group_id);
      if (adminCheck instanceof NextResponse) return adminCheck;
    }

    if (!puzzle.is_active) {
      return NextResponse.json({ success: true, data: { id: puzzle.id, removed: true } });
    }

    const { error: updateError } = await supabase
      .from('picture_find_puzzles')
      .update({ is_active: false })
      .eq('id', puzzle.id);

    if (updateError) {
      console.error('[picture-find/puzzles] delete error:', updateError);
      return NextResponse.json({ error: '퍼즐 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id: puzzle.id, removed: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '퍼즐 삭제 중 오류가 발생했습니다.';
    console.error('[picture-find/puzzles] DELETE', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
