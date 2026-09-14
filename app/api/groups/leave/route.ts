import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';

/**
 * 그룹 탈퇴 API
 * 특정 그룹에서만 나가기 (계정은 유지)
 * 정지된 그룹에서도 본인 탈퇴는 허용한다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { group_id } = body;

    if (!group_id) {
      return NextResponse.json({ error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: group } = await supabase
      .from('groups')
      .select('owner_id, name')
      .eq('id', group_id)
      .eq('app_id', CURRENT_APP_ID)
      .maybeSingle();

    if (!group) {
      return NextResponse.json({ error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (group.owner_id === user.id) {
      return NextResponse.json(
        {
          error:
            '그룹 소유자는 탈퇴할 수 없습니다. 먼저 소유권을 이전하거나 그룹을 삭제해주세요.',
        },
        { status: 403 },
      );
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('user_id, group_id')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .eq('app_id', CURRENT_APP_ID)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: '해당 그룹의 멤버가 아닙니다.' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .eq('app_id', CURRENT_APP_ID);

    if (deleteError) {
      console.error('그룹 탈퇴 오류:', deleteError);
      return NextResponse.json({ error: '그룹 탈퇴에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${group.name} 그룹에서 탈퇴했습니다.`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '그룹 탈퇴 중 오류가 발생했습니다.';
    console.error('그룹 탈퇴 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
