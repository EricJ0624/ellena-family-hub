import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { notifySystemAdminsOfDashboardAccessRequest } from '@/lib/support-ticket-notify';

/**
 * 접근 요청 목록 조회 (그룹 관리자용 - 해당 그룹의 모든 접근 요청)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json(
        { error: '그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: requests, error } = await supabase
      .from('dashboard_access_requests')
      .select('*')
      .eq('group_id', groupId)
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '접근 요청 조회 중 오류가 발생했습니다.';
    console.error('접근 요청 조회 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST:
 * - { group_id, reason } → 그룹 관리자가 시스템 관리자 대시보드 접근을 요청(생성)
 * - { id, group_id, action } → 승인/거절 (레거시·호환)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { id, group_id, action, reason, expires_hours, rejection_reason } = body || {};

    // --- 생성: 그룹 관리자 → 시스템 관리자 접근 요청 ---
    if (!action && group_id && typeof reason === 'string') {
      if (!reason.trim()) {
        return NextResponse.json(
          { error: '그룹 ID와 요청 이유는 필수입니다.' },
          { status: 400 }
        );
      }

      const adminCheck = await requireGroupAdmin(user.id, group_id);
      if (adminCheck instanceof NextResponse) return adminCheck;

      const supabase = getSupabaseServerClient();

      const { data: existingRequest } = await supabase
        .from('dashboard_access_requests')
        .select('id')
        .eq('group_id', group_id)
        .eq('requested_by', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequest) {
        return NextResponse.json(
          { error: '이미 대기중인 접근 요청이 있습니다.' },
          { status: 400 }
        );
      }

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

      void notifySystemAdminsOfDashboardAccessRequest({
        actorUserId: user.id,
        requestId: String(accessRequest.id),
        groupId: group_id,
        reason: reason.trim(),
      });

      return NextResponse.json({
        success: true,
        data: accessRequest,
      });
    }

    // --- 승인/거절 ---
    if (!id || !group_id || !action) {
      return NextResponse.json(
        { error: '요청 ID, 그룹 ID, 액션이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, group_id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    let updateData: Record<string, unknown> = {};

    if (action === 'approve') {
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
      updateData = {
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: rejection_reason || null,
      };
    }

    const { data: accessRequest, error } = await supabase
      .from('dashboard_access_requests')
      .update(updateData)
      .eq('id', id)
      .eq('group_id', group_id)
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
      data: accessRequest,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '접근 요청 처리 중 오류가 발생했습니다.';
    console.error('접근 요청 처리 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 접근 권한 취소 (그룹 관리자용) — body: { id, group_id }
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { id, group_id } = body;

    if (!id || !group_id) {
      return NextResponse.json(
        { error: '요청 ID와 그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, group_id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: accessRequest, error } = await supabase
      .from('dashboard_access_requests')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('group_id', group_id)
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
      data: accessRequest,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '접근 권한 취소 중 오류가 발생했습니다.';
    console.error('접근 권한 취소 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * pending 요청 취소 (그룹 관리자 — 본인 작성분만)
 * UI: DELETE ?id=&group_id=
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const groupId = searchParams.get('group_id');

    if (!id) {
      return NextResponse.json({ error: '요청 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('dashboard_access_requests')
      .select('id, group_id, requested_by, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: '접근 요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const effectiveGroupId = groupId || String(existing.group_id);
    const adminCheck = await requireGroupAdmin(user.id, effectiveGroupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    if (String(existing.requested_by) !== user.id) {
      return NextResponse.json({ error: '본인이 작성한 요청만 취소할 수 있습니다.' }, { status: 403 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json({ error: '대기중인 요청만 취소할 수 있습니다.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('dashboard_access_requests')
      .delete()
      .eq('id', id)
      .eq('requested_by', user.id);

    if (error) {
      console.error('접근 요청 취소 오류:', error);
      return NextResponse.json({ error: '접근 요청 취소에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '접근 요청 취소 중 오류가 발생했습니다.';
    console.error('접근 요청 취소 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
