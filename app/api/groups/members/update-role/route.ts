import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

/**
 * 멤버 역할 변경 API
 * 그룹 관리자(소유자 또는 ADMIN)만 다른 멤버의 역할을 변경할 수 있습니다.
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
    const { targetUserId, groupId, newRole } = body;

    // 입력값 검증
    if (!targetUserId || !groupId || !newRole) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다. (targetUserId, groupId, newRole)' },
        { status: 400 }
      );
    }

    // 역할 검증
    if (newRole !== 'ADMIN' && newRole !== 'MEMBER') {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다. (ADMIN, MEMBER만 가능)' },
        { status: 400 }
      );
    }

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId) || !uuidRegex.test(groupId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID 형식입니다.' },
        { status: 400 }
      );
    }

    // 권한 확인: 현재 사용자가 그룹 관리자(소유자 또는 ADMIN)인지 확인
    const permissionResult = await checkPermission(
      user.id,
      groupId,
      'ADMIN', // ADMIN 권한 필요
      user.id
    );

    if (!permissionResult.success) {
      return NextResponse.json(
        { error: '그룹 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 자기 자신의 역할은 변경 불가
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: '자기 자신의 역할은 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 그룹 소유자 확인 (소유자의 역할은 변경 불가)
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 그룹 소유자의 역할은 변경 불가
    if (group.owner_id === targetUserId) {
      return NextResponse.json(
        { error: '그룹 소유자의 역할은 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 대상 사용자가 그룹 멤버인지 확인
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', targetUserId)
      .eq('group_id', groupId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: '해당 사용자는 그룹 멤버가 아닙니다.' },
        { status: 404 }
      );
    }

    // 이미 같은 역할인지 확인
    if (membership.role === newRole) {
      return NextResponse.json(
        { error: `이미 ${newRole === 'ADMIN' ? '관리자' : '멤버'} 역할입니다.` },
        { status: 400 }
      );
    }

    // ✅ SECURITY: 사용자 JWT 토큰으로 Supabase 클라이언트 생성
    // SQL 함수 내부에서 auth.uid()가 올바르게 작동하도록 사용자 컨텍스트 전달
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase 설정이 누락되었습니다.' },
        { status: 500 }
      );
    }
    
    // 사용자 JWT 토큰을 포함한 Supabase 클라이언트 생성
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // RPC 함수를 사용하여 역할 변경 (SQL 함수에서 auth.uid()가 올바르게 작동)
    const { data, error: rpcError } = await supabaseWithAuth.rpc('update_member_role', {
      target_user_id: targetUserId,
      target_group_id: groupId,
      new_role: newRole,
    });

    if (rpcError) {
      console.error('역할 변경 오류:', rpcError);
      return NextResponse.json(
        { error: rpcError.message || '역할 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: '역할 변경에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `멤버 역할이 ${newRole === 'ADMIN' ? '관리자' : '멤버'}로 변경되었습니다.`,
      data: {
        userId: targetUserId,
        groupId,
        newRole,
      },
    });
  } catch (error: any) {
    console.error('멤버 역할 변경 오류:', error);
    return NextResponse.json(
      { error: error.message || '멤버 역할 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

