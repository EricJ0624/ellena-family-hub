import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

/**
 * 후임자 지정 및 본인 권한 해제
 * 마지막 시스템 관리자가 탈퇴할 때 사용
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
    const { successor_user_id } = body;

    if (!successor_user_id) {
      return NextResponse.json(
        { error: '후임자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (successor_user_id === user.id) {
      return NextResponse.json(
        { error: '본인을 후임자로 지정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 1. 후임자가 유효한 사용자인지 확인
    const { data: successorProfile } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .eq('id', successor_user_id)
      .single();

    if (!successorProfile) {
      return NextResponse.json(
        { error: '후임자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 후임자가 이미 시스템 관리자인지 확인
    const { data: existingAdmin } = await supabase
      .from('system_admins')
      .select('user_id')
      .eq('user_id', successor_user_id)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: '선택한 사용자는 이미 시스템 관리자입니다.' },
        { status: 400 }
      );
    }

    // 3. 현재 시스템 관리자 수 확인
    const { count } = await supabase
      .from('system_admins')
      .select('*', { count: 'exact', head: true });

    if (count && count >= 2) {
      return NextResponse.json(
        { error: '시스템 관리자는 최대 2명까지만 지정할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 4. 트랜잭션: 후임자 추가 + 본인 제거
    // 후임자 추가
    const { error: insertError } = await supabase
      .from('system_admins')
      .insert({
        user_id: successor_user_id,
        granted_by: user.id,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('후임자 추가 오류:', insertError);
      return NextResponse.json(
        { error: '후임자 지정에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 본인 권한 해제
    const { error: deleteError } = await supabase
      .from('system_admins')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('본인 권한 해제 오류:', deleteError);
      // 롤백: 후임자 제거
      await supabase
        .from('system_admins')
        .delete()
        .eq('user_id', successor_user_id);

      return NextResponse.json(
        { error: '권한 해제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${successorProfile.nickname || successorProfile.email}님을 후임 시스템 관리자로 지정했습니다.`,
    });
  } catch (error: any) {
    console.error('후임자 지정 오류:', error);
    return NextResponse.json(
      { error: error.message || '후임자 지정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
