import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const REMINDER_COLUMNS =
  'id, baby_id, group_id, reminder_type, remind_at, reference_key, is_dismissed, created_by, created_at';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
    const babyId = request.nextUrl.searchParams.get('babyId')?.trim() ?? '';
    const includeDismissed = request.nextUrl.searchParams.get('includeDismissed') === 'true';

    if (!groupId || !babyId) {
      return NextResponse.json({ error: 'groupId, babyId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from('baby_reminders')
      .select(REMINDER_COLUMNS)
      .eq('baby_id', babyId)
      .eq('group_id', groupId)
      .order('remind_at', { ascending: true });

    if (!includeDismissed) {
      query = query.eq('is_dismissed', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GET baby-growth/reminders]', error);
      return NextResponse.json({ error: '알림 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { group_id, baby_id, reminder_type, remind_at, reference_key } = body;

    if (!group_id || !baby_id || !reminder_type || !remind_at) {
      return NextResponse.json({ error: 'group_id, baby_id, reminder_type, remind_at는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_reminders')
      .insert({
        baby_id, group_id, reminder_type, remind_at,
        reference_key: reference_key ?? null,
        created_by: user.id,
      })
      .select(REMINDER_COLUMNS)
      .single();

    if (error) {
      console.error('[POST baby-growth/reminders]', error);
      return NextResponse.json({ error: '알림 생성 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { id, group_id, is_dismissed } = body;

    if (!id || !group_id) {
      return NextResponse.json({ error: 'id, group_id는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_reminders')
      .update({ is_dismissed: is_dismissed ?? true })
      .eq('id', id)
      .select(REMINDER_COLUMNS)
      .single();

    if (error) {
      console.error('[PATCH baby-growth/reminders]', error);
      return NextResponse.json({ error: '알림 수정 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
