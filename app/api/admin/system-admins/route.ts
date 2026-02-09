import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

/**
 * 시스템 관리자 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 시스템 관리자 확인
    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 시스템 관리자 목록 조회 (사용자 정보 포함)
    const { data: admins, error } = await supabase
      .from('system_admins')
      .select(`
        user_id,
        created_at,
        granted_by
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('시스템 관리자 목록 조회 오류:', error);
      return NextResponse.json(
        { error: '시스템 관리자 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 사용자 정보 조회
    const userIds = admins?.map(a => a.user_id) || [];
    let usersMap = new Map<string, { email: string; nickname: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds);

      if (profiles) {
        profiles.forEach(profile => {
          usersMap.set(profile.id, {
            email: profile.email,
            nickname: profile.nickname,
          });
        });
      }
    }

    const adminsWithUserInfo = admins?.map(admin => ({
      ...admin,
      email: usersMap.get(admin.user_id)?.email || null,
      nickname: usersMap.get(admin.user_id)?.nickname || null,
    }));

    return NextResponse.json({
      success: true,
      data: adminsWithUserInfo || [],
      count: admins?.length || 0,
    });
  } catch (error: any) {
    console.error('시스템 관리자 목록 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '시스템 관리자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 신규 시스템 관리자 추가
 * 1명 제한 (후임자 지정 시에만 일시적으로 2명 허용)
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 시스템 관리자 확인
    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 1. 현재 시스템 관리자 수 확인 (1명 제한)
    const { count } = await supabase
      .from('system_admins')
      .select('*', { count: 'exact', head: true });

    if (count && count >= 1) {
      return NextResponse.json(
        { error: '시스템 관리자는 1명만 지정할 수 있습니다. 기존 관리자의 권한을 먼저 해제해주세요.' },
        { status: 400 }
      );
    }

    // 2. 이미 시스템 관리자인지 확인
    const { data: existingAdmin } = await supabase
      .from('system_admins')
      .select('user_id')
      .eq('user_id', user_id)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: '이미 시스템 관리자입니다.' },
        { status: 400 }
      );
    }

    // 3. 사용자 존재 여부 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .eq('id', user_id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 4. 시스템 관리자 추가
    const { data: newAdmin, error } = await supabase
      .from('system_admins')
      .insert({
        user_id: user_id,
        granted_by: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('시스템 관리자 추가 오류:', error);
      return NextResponse.json(
        { error: '시스템 관리자 추가에 실패했습니다.' },
        { status: 500 }
      );
    }

      return NextResponse.json({
        success: true,
        data: newAdmin,
        message: `${profile.nickname || profile.email}님을 시스템 관리자로 지정했습니다. (활성 관리자: 1명)`,
      });
  } catch (error: any) {
    console.error('시스템 관리자 추가 오류:', error);
    return NextResponse.json(
      { error: error.message || '시스템 관리자 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 시스템 관리자 권한 해제
 */
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 시스템 관리자 확인
    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const target_user_id = searchParams.get('user_id');

    if (!target_user_id) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 1. 전체 시스템 관리자 수 확인
    const { count } = await supabase
      .from('system_admins')
      .select('*', { count: 'exact', head: true });

    if (count && count <= 1) {
      return NextResponse.json(
        { error: '마지막 시스템 관리자는 권한을 해제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 2. 시스템 관리자 권한 해제
    const { error } = await supabase
      .from('system_admins')
      .delete()
      .eq('user_id', target_user_id);

    if (error) {
      console.error('시스템 관리자 권한 해제 오류:', error);
      return NextResponse.json(
        { error: '시스템 관리자 권한 해제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '시스템 관리자 권한이 해제되었습니다.',
    });
  } catch (error: any) {
    console.error('시스템 관리자 권한 해제 오류:', error);
    return NextResponse.json(
      { error: error.message || '시스템 관리자 권한 해제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
