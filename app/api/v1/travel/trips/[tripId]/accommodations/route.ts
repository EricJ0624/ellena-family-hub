import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/** GET: 해당 여행의 숙소 목록 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { tripId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const { user } = authResult;
    const perm = await checkPermission(user.id, groupId, null, user.id);
    if (!perm.success) {
      return NextResponse.json({ error: '그룹 접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const { data: trip } = await supabase
      .from('travel_trips')
      .select('id')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();
    if (!trip) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

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
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    const { name, check_in_date, check_out_date, address, memo, latitude, longitude } = body as {
      name?: string;
      check_in_date?: string;
      check_out_date?: string;
      address?: string;
      memo?: string;
      latitude?: number;
      longitude?: number;
    };

    if (!groupId || !tripId || !name || !check_in_date || !check_out_date) {
      return NextResponse.json(
        { error: 'groupId, tripId, name, check_in_date, check_out_date는 필수입니다.' },
        { status: 400 }
      );
    }

    const perm = await checkPermission(user.id, groupId, null, user.id);
    if (!perm.success) {
      return NextResponse.json({ error: '그룹 접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const { data: trip } = await supabase
      .from('travel_trips')
      .select('id')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();
    if (!trip) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

    const insertPayload: Record<string, unknown> = {
      trip_id: tripId,
      group_id: groupId,
      name: String(name).trim(),
      check_in_date,
      check_out_date,
      address: address ? String(address).trim() : null,
      memo: memo ? String(memo).trim() : null,
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

    // 숙소 추가 시 일정 1건 자동 생성 (체크인 날짜, 제목 '숙소: 이름')
    const desc = [address, memo].filter(Boolean).join(' · ') || null;
    const itineraryPayload: Record<string, unknown> = {
      trip_id: tripId,
      group_id: groupId,
      day_date: check_in_date,
      title: `숙소: ${String(name).trim()}`,
      description: desc,
      sort_order: 0,
      created_by: user.id,
      source_type: 'accommodation',
      source_id: data.id,
    };
    if (address) itineraryPayload.address = String(address).trim();
    if (latitude != null && typeof latitude === 'number') itineraryPayload.latitude = latitude;
    if (longitude != null && typeof longitude === 'number') itineraryPayload.longitude = longitude;
    const { error: itineraryError } = await supabase.from('travel_itineraries').insert(itineraryPayload);
    if (itineraryError) console.error('travel_itineraries sync (accommodation):', itineraryError);

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('POST /api/v1/travel/trips/[tripId]/accommodations:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
