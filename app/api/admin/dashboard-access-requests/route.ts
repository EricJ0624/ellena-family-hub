import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

/**
 * 대시보드 접근 요청 목록 조회 (시스템 관리자용)
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

    // 접근 요청 목록 조회 (최신순)
    const { data: requests, error } = await supabase
      .from('dashboard_access_requests')
      .select(`
        *,
        groups:group_id (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('접근 요청 조회 오류:', error);
      return NextResponse.json(
        { error: '접근 요청 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: requests || [],
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
 * 대시보드 접근 요청 승인/거절 (시스템 관리자용)
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
    const { id, action, expires_hours, rejection_reason } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: '요청 ID와 액션이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    let updateData: any = {};

    if (action === 'approve') {
      // 승인: 만료 시간 설정 (기본 24시간)
      const expiresHours = expires_hours || 24;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresHours);

      updateData = {
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      };
    } else {
      // 거절
      updateData = {
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: rejection_reason || null,
      };
    }

    // 접근 요청 업데이트
    const { data: request, error } = await supabase
      .from('dashboard_access_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('접근 요청 처리 오류:', error);
      return NextResponse.json(
        { error: '접근 요청 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    console.error('접근 요청 처리 오류:', error);
    return NextResponse.json(
      { error: error.message || '접근 요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 대시보드 접근 권한 취소 (시스템 관리자용)
 */
export async function PUT(request: NextRequest) {
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: '요청 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 접근 권한 취소
    const { data: request, error } = await supabase
      .from('dashboard_access_requests')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('접근 권한 취소 오류:', error);
      return NextResponse.json(
        { error: '접근 권한 취소에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    console.error('접근 권한 취소 오류:', error);
    return NextResponse.json(
      { error: error.message || '접근 권한 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
