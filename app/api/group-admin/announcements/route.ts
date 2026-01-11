import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';

/**
 * 공지사항 목록 조회 (그룹 관리자용 - 읽음 상태 포함)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const supabase = getSupabaseServerClient();

    // 공지사항 목록 조회 (활성 공지만)
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('공지사항 조회 오류:', error);
      return NextResponse.json(
        { error: '공지사항 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 읽음 상태 조회
    const announcementIds = announcements?.map(a => a.id) || [];
    let readStatus: Record<string, boolean> = {};

    if (announcementIds.length > 0) {
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id)
        .in('announcement_id', announcementIds);

      if (reads) {
        reads.forEach(read => {
          readStatus[read.announcement_id] = true;
        });
      }
    }

    // 공지사항에 읽음 상태 추가
    const announcementsWithReadStatus = announcements?.map(announcement => ({
      ...announcement,
      is_read: readStatus[announcement.id] || false,
    }));

    return NextResponse.json({
      success: true,
      data: announcementsWithReadStatus || [],
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
 * 공지사항 읽음 처리 (그룹 관리자용)
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
    const { announcement_id } = body;

    if (!announcement_id) {
      return NextResponse.json(
        { error: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 읽음 상태 추가 (중복 방지)
    const { error } = await supabase
      .from('announcement_reads')
      .upsert({
        announcement_id,
        user_id: user.id,
        read_at: new Date().toISOString(),
      }, {
        onConflict: 'announcement_id,user_id',
      });

    if (error) {
      console.error('공지사항 읽음 처리 오류:', error);
      return NextResponse.json(
        { error: '공지사항 읽음 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('공지사항 읽음 처리 오류:', error);
    return NextResponse.json(
      { error: error.message || '공지사항 읽음 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
