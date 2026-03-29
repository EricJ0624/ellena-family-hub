import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { parseMessageThread } from '@/lib/support-ticket-thread';

/**
 * 문의 목록 조회 (시스템 관리자용)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 조회 중 오류가 발생했습니다.';
    console.error('문의 조회 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 문의에 답변 (시스템 관리자용)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

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

    const { data: existing, error: fetchErr } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('문의 조회 오류(답변 전):', fetchErr);
      return NextResponse.json(
        { error: '문의를 확인할 수 없습니다.' },
        { status: 500 }
      );
    }
    if (!existing) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    const trimmed = answer.trim();
    const answeredAt = new Date().toISOString();
    const nextStatus = (status || 'answered') as 'pending' | 'answered' | 'closed';

    let ticket: typeof existing;
    let updateError: { message: string } | null = null;

    if (!existing.answer) {
      const { data, error } = await supabase
        .from('support_tickets')
        .update({
          answer: trimmed,
          answered_by: user.id,
          answered_at: answeredAt,
          status: nextStatus,
        })
        .eq('id', id)
        .select()
        .single();
      ticket = data;
      updateError = error;
    } else {
      const thread = parseMessageThread(existing.message_thread);
      thread.push({
        role: 'system_admin',
        user_id: user.id,
        body: trimmed,
        created_at: answeredAt,
      });
      const { data, error } = await supabase
        .from('support_tickets')
        .update({
          message_thread: thread,
          answered_by: user.id,
          answered_at: answeredAt,
          status: nextStatus,
        })
        .eq('id', id)
        .select()
        .single();
      ticket = data;
      updateError = error;
    }

    if (updateError) {
      console.error('문의 답변 오류:', updateError);
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
      details: { status: nextStatus, followUp: !!existing.answer },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 답변 중 오류가 발생했습니다.';
    console.error('문의 답변 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 문의 상태 변경 (시스템 관리자용)
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 상태 변경 중 오류가 발생했습니다.';
    console.error('문의 상태 변경 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 문의 삭제 (시스템 관리자용)
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
      return NextResponse.json({ error: '문의 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: row, error: fetchErr } = await supabase
      .from('support_tickets')
      .select('id, group_id, title')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('문의 조회 오류(삭제 전):', fetchErr);
      return NextResponse.json({ error: '문의를 확인할 수 없습니다.' }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { error: delErr } = await supabase.from('support_tickets').delete().eq('id', id);

    if (delErr) {
      console.error('문의 삭제 오류:', delErr);
      return NextResponse.json({ error: '문의 삭제에 실패했습니다.' }, { status: 500 });
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'DELETE',
      resourceType: 'support_ticket',
      resourceId: id,
      groupId: row.group_id,
      details: { title: row.title },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 삭제 중 오류가 발생했습니다.';
    console.error('문의 삭제 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
