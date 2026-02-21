import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/** GET: 해당 여행의 먹거리 목록 */
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
      .from('travel_dining')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('day_date', { ascending: true })
      .order('time_at', { ascending: true });

    if (error) {
      console.error('travel_dining GET:', error);
      return NextResponse.json({ error: '먹거리 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: any) {
    console.error('GET /api/v1/travel/trips/[tripId]/dining:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** POST: 먹거리 추가 */
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
    const { name, day_date, time_at, category, memo } = body as {
      name?: string;
      day_date?: string;
      time_at?: string;
      category?: string;
      memo?: string;
    };

    if (!groupId || !tripId || !name || !day_date) {
      return NextResponse.json(
        { error: 'groupId, tripId, name, day_date는 필수입니다.' },
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
      day_date,
      created_by: user.id,
    };
    if (time_at != null && String(time_at).trim()) insertPayload.time_at = String(time_at).trim().substring(0, 5);
    if (category != null && String(category).trim()) insertPayload.category = String(category).trim();
    if (memo != null && String(memo).trim()) insertPayload.memo = String(memo).trim();

    const { data, error } = await supabase
      .from('travel_dining')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('travel_dining POST:', error);
      return NextResponse.json({ error: '먹거리 추가에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('POST /api/v1/travel/trips/[tripId]/dining:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
