import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

/** GET: 여행 일차 제목 목록 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('travel_day_titles')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('day_date', { ascending: true });

    if (error) {
      console.error('travel_day_titles GET:', error);
      return NextResponse.json({ error: '일차 제목 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('GET /api/v1/travel/trips/[tripId]/day-titles:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT: 일차 제목 upsert (body: { groupId, day_date, title }) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    const dayDate = body.day_date as string | undefined;
    const title = String(body.title ?? '').trim();

    if (!groupId || !tripId || !dayDate) {
      return NextResponse.json({ error: 'groupId, tripId, day_date가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('travel_day_titles')
      .select('id, deleted_at')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .eq('day_date', dayDate)
      .maybeSingle();

    if (existing?.id) {
      if (!title) {
        const { error } = await supabase
          .from('travel_day_titles')
          .update({ deleted_at: now, deleted_by: user.id, updated_at: now, updated_by: user.id })
          .eq('id', existing.id);
        if (error) {
          console.error('travel_day_titles soft delete:', error);
          return NextResponse.json({ error: '일차 제목 삭제에 실패했습니다.' }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: null });
      }
      const { data, error } = await supabase
        .from('travel_day_titles')
        .update({ title, updated_at: now, updated_by: user.id, deleted_at: null, deleted_by: null })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        console.error('travel_day_titles update:', error);
        return NextResponse.json({ error: '일차 제목 저장에 실패했습니다.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data });
    }

    if (!title) {
      return NextResponse.json({ success: true, data: null });
    }

    const { data, error } = await supabase
      .from('travel_day_titles')
      .insert({
        trip_id: tripId,
        group_id: groupId,
        day_date: dayDate,
        title,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('travel_day_titles insert:', error);
      return NextResponse.json({ error: '일차 제목 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('PUT /api/v1/travel/trips/[tripId]/day-titles:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
