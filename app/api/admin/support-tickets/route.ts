import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';

/**
 * 문의 목록 조회 (시스템 관리자용)
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

    // 문의 목록 조회 (최신순)
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('문의 조회 오류:', error);
      return NextResponse.json(
        { error: '문의 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const groupIds = Array.from(
      new Set((tickets || []).map((ticket: any) => ticket.group_id).filter(Boolean))
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

    const ticketsWithGroups = (tickets || []).map((ticket: any) => ({
      ...ticket,
      groups: ticket.group_id ? groupMap.get(ticket.group_id) || null : null,
    }));

    return NextResponse.json({
      success: true,
      data: ticketsWithGroups,
    });
  } catch (error: any) {
    console.error('문의 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 문의에 답변 (시스템 관리자용)
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
    const { id, answer, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: '문의 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!answer) {
      return NextResponse.json(
        { error: '답변 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 문의에 답변
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update({
        answer: answer.trim(),
        answered_by: user.id,
        answered_at: new Date().toISOString(),
        status: status || 'answered',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('문의 답변 오류:', error);
      return NextResponse.json(
        { error: '문의 답변에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'UPDATE',
      resourceType: 'support_ticket',
      resourceId: id,
      groupId: ticket?.group_id ?? null,
      details: { status: status || 'answered' },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    console.error('문의 답변 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 답변 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 문의 상태 변경 (시스템 관리자용)
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
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: '문의 ID와 상태가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!['pending', 'answered', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 문의 상태 변경
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('문의 상태 변경 오류:', error);
      return NextResponse.json(
        { error: '문의 상태 변경에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'UPDATE',
      resourceType: 'support_ticket',
      resourceId: id,
      groupId: ticket?.group_id ?? null,
      details: { status },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    console.error('문의 상태 변경 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
