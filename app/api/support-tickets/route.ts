import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/**
 * 멤버 문의 목록 조회 (본인 작성 + 해당 그룹)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    if (!groupId) {
      return NextResponse.json({ error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }

    const permission = await checkPermission(user.id, groupId, null, user.id);
    if (!permission.success) {
      return NextResponse.json({ error: '그룹 접근 권한이 없습니다.' }, { status: 403 });
    }

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
  } catch (error: any) {
    console.error('멤버 문의 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 멤버 문의 작성 (그룹 멤버)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
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

    const permission = await checkPermission(user.id, group_id, null, user.id);
    if (!permission.success) {
      return NextResponse.json({ error: '그룹 접근 권한이 없습니다.' }, { status: 403 });
    }

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
  } catch (error: any) {
    console.error('멤버 문의 작성 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 작성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

