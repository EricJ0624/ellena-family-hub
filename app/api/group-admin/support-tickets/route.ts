import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/**
 * 문의 목록 조회 (그룹 관리자용)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json(
        { error: '그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 권한 확인
    const permissionResult = await checkPermission(
      user.id,
      groupId,
      'ADMIN',
      user.id
    );

    if (!permissionResult.success) {
      return NextResponse.json(
        { error: '그룹 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

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
  } catch (error: any) {
    console.error('문의 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 문의 작성 (그룹 관리자용)
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { group_id, title, content } = body;

    if (!group_id || !title || !content) {
      return NextResponse.json(
        { error: '그룹 ID, 제목, 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 권한 확인
    const permissionResult = await checkPermission(
      user.id,
      group_id,
      'ADMIN',
      user.id
    );

    if (!permissionResult.success) {
      return NextResponse.json(
        { error: '그룹 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

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
  } catch (error: any) {
    console.error('문의 작성 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 작성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 문의에 답변 (그룹 관리자용)
 */
export async function PUT(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
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

    // 권한 확인
    const permissionResult = await checkPermission(
      user.id,
      group_id,
      'ADMIN',
      user.id
    );

    if (!permissionResult.success) {
      return NextResponse.json(
        { error: '그룹 관리자 권한이 필요합니다.' },
        { status: 403 }
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
  } catch (error: any) {
    console.error('문의 답변 오류:', error);
    return NextResponse.json(
      { error: error.message || '문의 답변 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
