import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';

/** 시스템 관리자 목록 조회. 승격/해제는 /api/admin/system-admins/transfer 만 사용한다. */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: admins, error } = await supabase
      .from('system_admins')
      .select(`
        user_id,
        created_at,
        created_by
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('시스템 관리자 목록 조회 오류:', error);
      return NextResponse.json(
        { error: '시스템 관리자 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const userIds = admins?.map((a) => a.user_id) || [];
    let usersMap = new Map<string, { email: string; nickname: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds);

      if (profiles) {
        profiles.forEach((profile) => {
          usersMap.set(profile.id, {
            email: profile.email,
            nickname: profile.nickname,
          });
        });
      }
    }

    const adminsWithUserInfo = admins?.map((admin) => ({
      ...admin,
      email: usersMap.get(admin.user_id)?.email || null,
      nickname: usersMap.get(admin.user_id)?.nickname || null,
    }));

    return NextResponse.json({
      success: true,
      data: adminsWithUserInfo || [],
      count: admins?.length || 0,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '시스템 관리자 목록 조회 중 오류가 발생했습니다.';
    console.error('시스템 관리자 목록 조회 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
