import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { parseMemberSupportMessageThread } from '@/lib/member-support-ticket-thread';

/**
 * 멤버 문의 목록 조회 (그룹 관리자용 - 해당 그룹 전체)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json({ error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: tickets, error } = await supabase
      .from('member_support_tickets')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('멤버 문의 조회 오류(관리자):', error);
      return NextResponse.json({ error: '문의 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: tickets || [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 조회 중 오류가 발생했습니다.';
    console.error('멤버 문의 조회 오류(관리자):', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 멤버 문의 답변 (그룹 관리자용)
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { id, group_id, answer, status } = body || {};

    if (!id || !group_id) {
      return NextResponse.json({ error: '문의 ID와 그룹 ID가 필요합니다.' }, { status: 400 });
    }

    if (!answer) {
      return NextResponse.json({ error: '답변 내용은 필수입니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, group_id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const nextStatus = status || 'answered';
    if (!['pending', 'answered', 'closed'].includes(nextStatus)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('member_support_tickets')
      .select('*')
      .eq('id', id)
      .eq('group_id', group_id)
      .maybeSingle();

    if (fetchErr) {
      console.error('멤버 문의 조회 오류(답변 전):', fetchErr);
      return NextResponse.json({ error: '문의를 확인할 수 없습니다.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    const trimmed = String(answer).trim();
    const answeredAt = new Date().toISOString();

    let ticket: typeof existing;
    let updErr: { message: string } | null = null;

    if (!existing.answer) {
      const { data, error } = await supabase
        .from('member_support_tickets')
        .update({
          answer: trimmed,
          answered_by: user.id,
          answered_at: answeredAt,
          status: nextStatus,
        })
        .eq('id', id)
        .eq('group_id', group_id)
        .select()
        .single();
      ticket = data;
      updErr = error;
    } else {
      const thread = parseMemberSupportMessageThread(existing.message_thread);
      thread.push({
        role: 'group_admin',
        user_id: user.id,
        body: trimmed,
        created_at: answeredAt,
      });
      const { data, error } = await supabase
        .from('member_support_tickets')
        .update({
          message_thread: thread,
          answered_by: user.id,
          answered_at: answeredAt,
          status: nextStatus,
        })
        .eq('id', id)
        .eq('group_id', group_id)
        .select()
        .single();
      ticket = data;
      updErr = error;
    }

    if (updErr) {
      console.error('멤버 문의 답변 오류(관리자):', updErr);
      return NextResponse.json({ error: '문의 답변에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 답변 중 오류가 발생했습니다.';
    console.error('멤버 문의 답변 오류(관리자):', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

