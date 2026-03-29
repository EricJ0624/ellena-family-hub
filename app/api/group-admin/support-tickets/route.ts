import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { parseMessageThread } from '@/lib/support-ticket-thread';

/**
 * 문의 목록 조회 (그룹 관리자용)
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

    // 문의 목록 조회 (해당 그룹의 모든 문의)
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('문의 조회 오류:', error);
      return NextResponse.json(
        { error: '문의 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tickets || [],
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
 * 문의 작성 (그룹 관리자용)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { group_id, title, content } = body;

    if (!group_id || !title || !content) {
      return NextResponse.json(
        { error: '그룹 ID, 제목, 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, group_id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    // 문의 작성
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        group_id,
        created_by: user.id,
        title: title.trim(),
        content: content.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('문의 작성 오류:', error);
      return NextResponse.json(
        { error: '문의 작성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 작성 중 오류가 발생했습니다.';
    console.error('문의 작성 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 문의에 답변 (그룹 관리자용)
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { id, group_id, answer, status } = body;

    if (!id || !group_id) {
      return NextResponse.json(
        { error: '문의 ID와 그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!answer) {
      return NextResponse.json(
        { error: '답변 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, group_id);
    if (adminCheck instanceof NextResponse) return adminCheck;

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
      .eq('group_id', group_id)
      .select()
      .single();

    if (error) {
      console.error('문의 답변 오류:', error);
      return NextResponse.json(
        { error: '문의 답변에 실패했습니다.' },
        { status: 500 }
      );
    }

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
 * 첫 답변 이후 추가 문의 (그룹 관리자 → 시스템 관리자)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { id, group_id, follow_up } = body;

    if (!id || !group_id || !follow_up || !String(follow_up).trim()) {
      return NextResponse.json(
        { error: '문의 ID, 그룹 ID, 추가 문의 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, group_id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('group_id', group_id)
      .maybeSingle();

    if (fetchErr) {
      console.error('문의 조회 오류(추가 문의 전):', fetchErr);
      return NextResponse.json({ error: '문의를 확인할 수 없습니다.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!existing.answer) {
      return NextResponse.json(
        { error: '첫 답변이 완료된 뒤에만 추가 문의를 남길 수 있습니다.' },
        { status: 400 }
      );
    }

    if (existing.status === 'pending') {
      return NextResponse.json(
        { error: '답변 대기 중에는 추가 문의를 남길 수 없습니다.' },
        { status: 400 }
      );
    }

    if (!['answered', 'closed'].includes(existing.status)) {
      return NextResponse.json({ error: '추가 문의를 남길 수 없는 상태입니다.' }, { status: 400 });
    }

    const thread = parseMessageThread(existing.message_thread);
    const createdAt = new Date().toISOString();
    thread.push({
      role: 'group_admin',
      user_id: user.id,
      body: String(follow_up).trim(),
      created_at: createdAt,
    });

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update({
        message_thread: thread,
        status: 'pending',
      })
      .eq('id', id)
      .eq('group_id', group_id)
      .select()
      .single();

    if (error) {
      console.error('추가 문의 저장 오류:', error);
      return NextResponse.json({ error: '추가 문의 저장에 실패했습니다.' }, { status: 500 });
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'UPDATE',
      resourceType: 'support_ticket',
      resourceId: id,
      groupId: group_id,
      details: { kind: 'group_follow_up' },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '추가 문의 처리 중 오류가 발생했습니다.';
    console.error('추가 문의 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 문의 삭제 (그룹 관리자용, 해당 그룹 문의만)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const groupId = searchParams.get('group_id');

    if (!id || !groupId) {
      return NextResponse.json(
        { error: '문의 ID와 그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: row, error: fetchErr } = await supabase
      .from('support_tickets')
      .select('id, group_id, title')
      .eq('id', id)
      .eq('group_id', groupId)
      .maybeSingle();

    if (fetchErr) {
      console.error('문의 조회 오류(삭제 전):', fetchErr);
      return NextResponse.json({ error: '문의를 확인할 수 없습니다.' }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { error: delErr } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', id)
      .eq('group_id', groupId);

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
      groupId: groupId,
      details: { title: row.title, actor: 'group_admin' },
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
