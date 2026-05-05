import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';

/** GET: 해당 여행의 숙소 목록 */
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
      .from('travel_accommodations')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('check_in_date', { ascending: true });

    if (error) {
      console.error('travel_accommodations GET:', error);
      return NextResponse.json({ error: '숙소 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: any) {
    console.error('GET /api/v1/travel/trips/[tripId]/accommodations:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** POST: 숙소 추가 */
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
    const {
      name,
      check_in_date,
      check_out_date,
      check_in_time,
      check_out_time,
      address,
      memo,
      place_id,
      latitude,
      longitude,
      show_in_itinerary,
    } = body as {
      name?: string;
      check_in_date?: string;
      check_out_date?: string;
      check_in_time?: string | null;
      check_out_time?: string | null;
      address?: string;
      memo?: string;
      place_id?: string | null;
      latitude?: number;
      longitude?: number;
      /** 일정 뷰에 표시 여부 */
      show_in_itinerary?: boolean;
    };

    if (!groupId || !tripId || !name || !check_in_date || !check_out_date) {
      return NextResponse.json(
        { error: 'groupId, tripId, name, check_in_date, check_out_date는 필수입니다.' },
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
      name: String(name).trim(),
      check_in_date,
      check_out_date,
      check_in_time:
        check_in_time != null && String(check_in_time).trim()
          ? String(check_in_time).trim().substring(0, 5)
          : null,
      check_out_time:
        check_out_time != null && String(check_out_time).trim()
          ? String(check_out_time).trim().substring(0, 5)
          : null,
      address: address ? String(address).trim() : null,
      memo: memo ? String(memo).trim() : null,
      place_id: place_id ? String(place_id).trim() : null,
      show_in_itinerary: show_in_itinerary === true,
      created_by: user.id,
    };
    if (latitude != null && typeof latitude === 'number') insertPayload.latitude = latitude;
    if (longitude != null && typeof longitude === 'number') insertPayload.longitude = longitude;

    const { data, error } = await supabase
      .from('travel_accommodations')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('travel_accommodations POST:', error);
      return NextResponse.json({ error: '숙소 추가에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('POST /api/v1/travel/trips/[tripId]/accommodations:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
