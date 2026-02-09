import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

/**
 * 공지사항 목록 조회 (시스템 관리자용)
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

    // 공지사항 목록 조회 (최신순)
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('공지사항 조회 오류:', error);
      return NextResponse.json(
        { error: '공지사항 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: announcements || [],
    });
  } catch (error: any) {
    console.error('공지사항 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '공지사항 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 공지사항 작성 (시스템 관리자용)
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
    const { title, content, is_active, target } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // target 유효성 검사
    if (target && !['ADMIN_ONLY', 'ALL_MEMBERS'].includes(target)) {
      return NextResponse.json(
        { error: '유효하지 않은 대상입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 공지사항 작성
    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        title: title.trim(),
        content: content.trim(),
        created_by: user.id,
        is_active: is_active !== false, // 기본값: true
        target: target || 'ADMIN_ONLY', // 기본값: ADMIN_ONLY
      })
      .select()
      .single();

    if (error) {
      console.error('공지사항 작성 오류:', error);
      return NextResponse.json(
        { error: '공지사항 작성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: announcement,
    });
  } catch (error: any) {
    console.error('공지사항 작성 오류:', error);
    return NextResponse.json(
      { error: error.message || '공지사항 작성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 공지사항 수정 (시스템 관리자용)
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
    const { id, title, content, is_active, target } = body;

    if (!id) {
      return NextResponse.json(
        { error: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // target 유효성 검사
    if (target && !['ADMIN_ONLY', 'ALL_MEMBERS'].includes(target)) {
      return NextResponse.json(
        { error: '유효하지 않은 대상입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 공지사항 수정
    const updateData: any = {
      title: title.trim(),
      content: content.trim(),
      is_active: is_active !== false,
    };

    if (target) {
      updateData.target = target;
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('공지사항 수정 오류:', error);
      return NextResponse.json(
        { error: '공지사항 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: announcement,
    });
  } catch (error: any) {
    console.error('공지사항 수정 오류:', error);
    return NextResponse.json(
      { error: error.message || '공지사항 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 공지사항 삭제 (시스템 관리자용)
 * - permanent=true: 실제 삭제 (비활성화된 공지사항만 가능)
 * - permanent=false 또는 없음: 비활성화 (is_active = false)
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    if (permanent) {
      // 실제 삭제 (비활성화된 공지사항만 가능)
      // 먼저 공지사항 상태 확인
      const { data: announcement } = await supabase
        .from('announcements')
        .select('is_active')
        .eq('id', id)
        .single();

      if (!announcement) {
        return NextResponse.json(
          { error: '공지사항을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      if (announcement.is_active) {
        return NextResponse.json(
          { error: '활성화된 공지사항은 삭제할 수 없습니다. 먼저 비활성화해주세요.' },
          { status: 400 }
        );
      }

      // 실제 삭제
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('공지사항 영구 삭제 오류:', error);
        return NextResponse.json(
          { error: '공지사항 삭제에 실패했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '공지사항이 영구적으로 삭제되었습니다.',
      });
    } else {
      // 비활성화 (is_active = false)
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        console.error('공지사항 비활성화 오류:', error);
        return NextResponse.json(
          { error: '공지사항 비활성화에 실패했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '공지사항이 비활성화되었습니다.',
      });
    }
  } catch (error: any) {
    console.error('공지사항 삭제 오류:', error);
    return NextResponse.json(
      { error: error.message || '공지사항 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
