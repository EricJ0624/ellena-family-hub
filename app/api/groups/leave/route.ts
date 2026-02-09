import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';

/**
 * 그룹 탈퇴 API
 * 특정 그룹에서만 나가기 (계정은 유지)
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { group_id } = body;

    if (!group_id) {
      return NextResponse.json(
        { error: '그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 1. 그룹 소유자인지 확인
    const { data: group } = await supabase
      .from('groups')
      .select('owner_id, name')
      .eq('id', group_id)
      .single();

    if (!group) {
      return NextResponse.json(
        { error: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (group.owner_id === user.id) {
      return NextResponse.json(
        { error: '그룹 소유자는 탈퇴할 수 없습니다. 먼저 소유권을 이전하거나 그룹을 삭제해주세요.' },
        { status: 403 }
      );
    }

    // 2. 멤버십 확인
    const { data: membership } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: '해당 그룹의 멤버가 아닙니다.' },
        { status: 404 }
      );
    }

    // 3. 멤버십 삭제 (그룹 탈퇴)
    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('user_id', user.id)
      .eq('group_id', group_id);

    if (deleteError) {
      console.error('그룹 탈퇴 오류:', deleteError);
      return NextResponse.json(
        { error: '그룹 탈퇴에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${group.name} 그룹에서 탈퇴했습니다.`,
    });
  } catch (error: any) {
    console.error('그룹 탈퇴 오류:', error);
    return NextResponse.json(
      { error: error.message || '그룹 탈퇴 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
