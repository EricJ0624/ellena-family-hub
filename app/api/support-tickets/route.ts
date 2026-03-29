import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

/**
 * 멤버 문의 목록 조회 (본인 작성 + 해당 그룹)
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

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();

    const { data: tickets, error } = await supabase
      .from('member_support_tickets')
      .select('*')
      .eq('group_id', groupId)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('멤버 문의 조회 오류:', error);
      return NextResponse.json({ error: '문의 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: tickets || [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 조회 중 오류가 발생했습니다.';
    console.error('멤버 문의 조회 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 멤버 문의 작성 (그룹 멤버)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { group_id, title, content } = body || {};

    if (!group_id || !title || !content) {
      return NextResponse.json(
        { error: '그룹 ID, 제목, 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();

    const { data: ticket, error } = await supabase
      .from('member_support_tickets')
      .insert({
        group_id,
        created_by: user.id,
        title: String(title).trim(),
        content: String(content).trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('멤버 문의 작성 오류:', error);
      return NextResponse.json({ error: '문의 작성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 작성 중 오류가 발생했습니다.';
    console.error('멤버 문의 작성 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 멤버 문의 삭제 (본인 작성 건만)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const ticketId = searchParams.get('id');
    if (!groupId || !ticketId) {
      return NextResponse.json(
        { error: '그룹 ID와 문의 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();

    const { data: row, error: fetchErr } = await supabase
      .from('member_support_tickets')
      .select('id, created_by, group_id')
      .eq('id', ticketId)
      .maybeSingle();

    if (fetchErr) {
      console.error('멤버 문의 조회 오류(삭제 전):', fetchErr);
      return NextResponse.json({ error: '문의를 확인할 수 없습니다.' }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (row.group_id !== groupId || row.created_by !== user.id) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const { error: delErr } = await supabase
      .from('member_support_tickets')
      .delete()
      .eq('id', ticketId);

    if (delErr) {
      console.error('멤버 문의 삭제 오류:', delErr);
      return NextResponse.json({ error: '문의 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '문의 삭제 중 오류가 발생했습니다.';
    console.error('멤버 문의 삭제 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
