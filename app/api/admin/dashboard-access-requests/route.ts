import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';

/**
 * 대시보드 접근 요청 목록 조회 (시스템 관리자용 - 본인이 신청한 요청만)
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

    // 접근 요청 목록 조회 (본인이 신청한 요청만)
    const { data: requests, error } = await supabase
      .from('dashboard_access_requests')
      .select('*')
      .eq('requested_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('접근 요청 조회 오류:', error);
      return NextResponse.json(
        { error: '접근 요청 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const groupIds = Array.from(
      new Set((requests || []).map((request: any) => request.group_id).filter(Boolean))
    );

    let groupMap = new Map<string, { id: string; name: string }>();
    if (groupIds.length > 0) {
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);

      if (groupsError) {
        console.warn('그룹 정보 조회 오류:', groupsError);
      } else {
        (groups || []).forEach((group: any) => {
          groupMap.set(group.id, { id: group.id, name: group.name });
        });
      }
    }

    const requestsWithGroups = (requests || []).map((request: any) => ({
      ...request,
      groups: request.group_id ? groupMap.get(request.group_id) || null : null,
    }));

    return NextResponse.json({
      success: true,
      data: requestsWithGroups,
    });
  } catch (error: any) {
    console.error('접근 요청 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '접근 요청 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 대시보드 접근 요청 작성 (시스템 관리자용)
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
    const { group_id, reason } = body;

    if (!group_id || !reason) {
      return NextResponse.json(
        { error: '그룹 ID와 요청 이유는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 기존 pending 요청이 있는지 확인
    const { data: existingRequest } = await supabase
      .from('dashboard_access_requests')
      .select('id')
      .eq('group_id', group_id)
      .eq('requested_by', user.id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: '이미 대기중인 접근 요청이 있습니다.' },
        { status: 400 }
      );
    }

    // 접근 요청 작성
    const { data: accessRequest, error } = await supabase
      .from('dashboard_access_requests')
      .insert({
        group_id,
        requested_by: user.id,
        reason: reason.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('접근 요청 작성 오류:', error);
      return NextResponse.json(
        { error: '접근 요청 작성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: accessRequest,
    });
  } catch (error: any) {
    console.error('접근 요청 작성 오류:', error);
    return NextResponse.json(
      { error: error.message || '접근 요청 작성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 대시보드 접근 요청 취소 (시스템 관리자용 - 본인이 신청한 요청만)
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '요청 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 접근 요청 확인 (본인이 요청한 것만)
    const { data: accessRequest, error: fetchError } = await supabase
      .from('dashboard_access_requests')
      .select('*')
      .eq('id', id)
      .eq('requested_by', user.id)
      .single();

    if (fetchError || !accessRequest) {
      return NextResponse.json(
        { error: '접근 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // pending 상태인 경우에만 삭제 가능
    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { error: '대기중인 요청만 취소할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 접근 요청 삭제
    const { error } = await supabase
      .from('dashboard_access_requests')
      .delete()
      .eq('id', id)
      .eq('requested_by', user.id);

    if (error) {
      console.error('접근 요청 취소 오류:', error);
      return NextResponse.json(
        { error: '접근 요청 취소에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'DELETE',
      resourceType: 'dashboard_access_request',
      resourceId: id,
      groupId: accessRequest.group_id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('접근 요청 취소 오류:', error);
    return NextResponse.json(
      { error: error.message || '접근 요청 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
