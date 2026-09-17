import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';

/** GET: active recording track for this user+trip (session recovery) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
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

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('travel_field_tracks')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'recording')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('field-tracks GET:', error);
      return NextResponse.json({ error: '경로 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? null });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('GET field-tracks:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST: start route recording */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    const dayDate = typeof body.day_date === 'string' ? body.day_date.trim().slice(0, 10) : null;
    const startTime =
      typeof body.start_time === 'string' ? body.start_time.trim().substring(0, 5) : null;
    const startLat = body.start_lat != null ? Number(body.start_lat) : null;
    const startLng = body.start_lng != null ? Number(body.start_lng) : null;

    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();

    // One active recording per user
    const { data: existing } = await supabase
      .from('travel_field_tracks')
      .select('id, trip_id, day_date, start_time')
      .eq('user_id', user.id)
      .eq('status', 'recording')
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json(
        {
          error: '이미 기록 중인 경로가 있습니다.',
          data: {
            trackId: existing.id,
            tripId: existing.trip_id ? String(existing.trip_id) : null,
            day_date: existing.day_date ?? null,
            start_time: existing.start_time ?? null,
          },
        },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('travel_field_tracks')
      .insert({
        group_id: groupId,
        trip_id: tripId,
        user_id: user.id,
        status: 'recording',
        day_date: dayDate,
        start_time: startTime,
        start_lat: Number.isFinite(startLat as number) ? startLat : null,
        start_lng: Number.isFinite(startLng as number) ? startLng : null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('field-tracks POST:', error);
      return NextResponse.json({ error: '경로 기록 시작에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST field-tracks:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
