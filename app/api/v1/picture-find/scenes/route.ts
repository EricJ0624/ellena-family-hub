import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { mapSceneRow, PICTURE_FIND_SCENE_SELECT } from '@/lib/picture-find/scene-mapper';

/**
 * 활성 장면 목록 (시스템 기본 + 요청 그룹 장면)
 * Phase 1: read-only. 관리 UI는 위젯/모달에서 2차 이후 연결.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(authResult.user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();

    const { data: systemRows, error: systemError } = await supabase
      .from('picture_find_scenes')
      .select(PICTURE_FIND_SCENE_SELECT)
      .eq('scope', 'system')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (systemError) {
      if (systemError.code === '42P01') {
        return NextResponse.json({ success: true, data: [], fallback: true });
      }
      console.error('[picture-find/scenes] system query error:', systemError);
      return NextResponse.json({ error: '장면 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const { data: groupRows, error: groupError } = await supabase
      .from('picture_find_scenes')
      .select(PICTURE_FIND_SCENE_SELECT)
      .eq('scope', 'group')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (groupError && groupError.code !== '42P01') {
      console.error('[picture-find/scenes] group query error:', groupError);
      return NextResponse.json({ error: '장면 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const scenes = [...(systemRows ?? []), ...(groupRows ?? [])].map(mapSceneRow);

    return NextResponse.json({
      success: true,
      data: scenes,
      fallback: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '장면 목록 조회 중 오류가 발생했습니다.';
    console.error('[picture-find/scenes]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
