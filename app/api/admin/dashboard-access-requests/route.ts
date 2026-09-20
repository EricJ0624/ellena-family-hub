import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { notifyGroupAdminsOfDashboardAccessRequest } from '@/lib/support-ticket-notify';

/**
 * 대시보드 접근 요청 목록 조회 (시스템 관리자용 — 전체)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: requests, error } = await supabase
      .from('dashboard_access_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('접근 요청 조회 오류:', error);
      return NextResponse.json(
        { error: '접근 요청 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const groupIds = Array.from(
      new Set((requests || []).map((row: { group_id?: string }) => row.group_id).filter(Boolean))
    ) as string[];

    let groupMap = new Map<string, { id: string; name: string; app_id: string | null }>();
    if (groupIds.length > 0) {
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, app_id')
        .in('id', groupIds);

      if (groupsError) {
        console.warn('그룹 정보 조회 오류:', groupsError);
      } else {
        (groups || []).forEach((group: { id: string; name: string; app_id: string | null }) => {
          groupMap.set(group.id, {
            id: group.id,
            name: group.name,
            app_id: group.app_id ?? null,
          });
        });
      }
    }

    const requestsWithGroups = (requests || []).map((row: { group_id?: string }) => ({
      ...row,
      groups: row.group_id ? groupMap.get(row.group_id) || null : null,
      app_id: row.group_id ? groupMap.get(row.group_id)?.app_id ?? null : null,
    }));

    return NextResponse.json({
      success: true,
      data: requestsWithGroups,
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
 * - { group_id, reason } → 시스템 관리자가 특정 그룹 접근을 직접 신청(생성)
 * - { id, action } → 그룹 관리자가 올린 요청 승인/거절
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json();
    const { id, group_id, reason, action, expires_hours, rejection_reason } = body || {};

    // --- 승인/거절 ---
    if (action) {
      if (!id || !['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: '요청 ID와 유효한 액션(approve/reject)이 필요합니다.' },
          { status: 400 }
        );
      }

      const supabase = getSupabaseServerClient();

      const { data: existing, error: fetchErr } = await supabase
        .from('dashboard_access_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !existing) {
        return NextResponse.json({ error: '접근 요청을 찾을 수 없습니다.' }, { status: 404 });
      }

      if (existing.status !== 'pending') {
        return NextResponse.json({ error: '대기중인 요청만 처리할 수 있습니다.' }, { status: 400 });
      }

      // 상대방 승인만 허용: 본인 요청·시스템관리자끼리 요청은 그룹 관리자 승인 대상
      if (String(existing.requested_by) === user.id) {
        return NextResponse.json(
          { error: '본인이 보낸 요청은 승인/거절할 수 없습니다. 그룹 관리자 승인을 기다려 주세요.' },
          { status: 400 }
        );
      }

      const { data: requesterAdmin } = await supabase
        .from('system_admins')
        .select('user_id')
        .eq('user_id', existing.requested_by)
        .maybeSingle();

      if (requesterAdmin) {
        return NextResponse.json(
          { error: '시스템 관리자의 접근 요청은 해당 그룹 관리자가 승인해야 합니다.' },
          { status: 400 }
        );
      }

      let updateData: Record<string, unknown>;
      if (action === 'approve') {
        const expiresHours = Number(expires_hours) > 0 ? Number(expires_hours) : 24;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresHours);
        updateData = {
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          rejected_at: null,
          rejection_reason: null,
        };
      } else {
        updateData = {
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: typeof rejection_reason === 'string' ? rejection_reason.trim() || null : null,
        };
      }

      const { data: accessRequest, error } = await supabase
        .from('dashboard_access_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('접근 요청 처리 오류:', error);
        return NextResponse.json({ error: '접근 요청 처리에 실패했습니다.' }, { status: 500 });
      }

      const { ipAddress, userAgent } = getAuditRequestMeta(request);
      await writeAdminAuditLog(supabase, {
        adminId: user.id,
        action: 'UPDATE',
        resourceType: 'dashboard_access_request',
        resourceId: id,
        groupId: accessRequest?.group_id ?? existing.group_id,
        details: { kind: action, expires_hours: expires_hours ?? null },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ success: true, data: accessRequest });
    }

    // --- 생성 (시스템 관리자 직접 신청) ---
    if (!group_id || !reason || !String(reason).trim()) {
      return NextResponse.json(
        { error: '그룹 ID와 요청 이유는 필수입니다.' },
        { status: 400 }
      );
    }

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

    // 시스템 관리자 신청 → pending (그룹 관리자 승인 필요)
    const { data: accessRequest, error } = await supabase
      .from('dashboard_access_requests')
      .insert({
        group_id,
        requested_by: user.id,
        reason: String(reason).trim(),
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

    void notifyGroupAdminsOfDashboardAccessRequest({
      actorUserId: user.id,
      requestId: String(accessRequest.id),
      groupId: group_id,
      reason: String(reason).trim(),
    });

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'CREATE',
      resourceType: 'dashboard_access_request',
      resourceId: accessRequest.id,
      groupId: group_id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: accessRequest,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '접근 요청 작성 중 오류가 발생했습니다.';
    console.error('접근 요청 작성 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 대시보드 접근 요청 취소 (시스템 관리자용 - 본인이 신청한 pending만)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '요청 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: accessRequest, error: fetchError } = await supabase
      .from('dashboard_access_requests')
      .select('*')
      .eq('id', id)
      .eq('requested_by', user.id)
      .maybeSingle();

    if (fetchError || !accessRequest) {
      return NextResponse.json(
        { error: '접근 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { error: '대기중인 요청만 취소할 수 있습니다.' },
        { status: 400 }
      );
    }

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '접근 요청 취소 중 오류가 발생했습니다.';
    console.error('접근 요청 취소 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 승인된 접근 권한 철회 (시스템 관리자)
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json();
    const { id } = body || {};
    if (!id) {
      return NextResponse.json({ error: '요청 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: fetchErr } = await supabase
      .from('dashboard_access_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: '접근 요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (existing.status !== 'approved') {
      return NextResponse.json({ error: '승인된 요청만 철회할 수 있습니다.' }, { status: 400 });
    }

    const { data: accessRequest, error } = await supabase
      .from('dashboard_access_requests')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('접근 권한 철회 오류:', error);
      return NextResponse.json({ error: '접근 권한 철회에 실패했습니다.' }, { status: 500 });
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'UPDATE',
      resourceType: 'dashboard_access_request',
      resourceId: id,
      groupId: accessRequest?.group_id ?? existing.group_id,
      details: { kind: 'revoke' },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, data: accessRequest });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '접근 권한 철회 중 오류가 발생했습니다.';
    console.error('접근 권한 철회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
