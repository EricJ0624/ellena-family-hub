import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';

/** GET: 해당 여행의 교통 목록 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { tripId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const { user } = authResult;
    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('travel_transports')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('day_date', { ascending: true });

    if (error) {
      console.error('travel_transports GET:', error);
      return NextResponse.json({ error: '교통 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: any) {
    console.error('GET /api/v1/travel/trips/[tripId]/transports:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** POST: 교통 추가 */
export async function POST(
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
    const { transport_type, day_date, start_time, end_time, departure, arrival, distance_km, memo, show_in_itinerary } = body as {
      transport_type?: 'air' | 'train' | 'car' | 'bike';
      day_date?: string;
      start_time?: string;
      end_time?: string;
      departure?: string;
      arrival?: string;
      distance_km?: number;
      memo?: string;
      /** 일정 뷰에 표시 여부 */
      show_in_itinerary?: boolean;
    };

    if (!groupId || !tripId || !transport_type || !day_date) {
      return NextResponse.json(
        { error: 'groupId, tripId, transport_type, day_date는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!['air', 'train', 'car', 'bike'].includes(transport_type)) {
      return NextResponse.json(
        { error: 'transport_type은 air, train, car, bike 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();

    const insertPayload: Record<string, unknown> = {
      trip_id: tripId,
      group_id: groupId,
      transport_type,
      day_date,
      show_in_itinerary: show_in_itinerary === true,
      created_by: user.id,
    };
    if (start_time) insertPayload.start_time = String(start_time).trim().substring(0, 5);
    if (end_time) insertPayload.end_time = String(end_time).trim().substring(0, 5);
    if (departure) insertPayload.departure = String(departure).trim();
    if (arrival) insertPayload.arrival = String(arrival).trim();
    if (distance_km != null && typeof distance_km === 'number') insertPayload.distance_km = distance_km;
    if (memo) insertPayload.memo = String(memo).trim();

    const { data, error } = await supabase
      .from('travel_transports')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('travel_transports POST:', error);
      return NextResponse.json({ error: '교통 추가에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('POST /api/v1/travel/trips/[tripId]/transports:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
