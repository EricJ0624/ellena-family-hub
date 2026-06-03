import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { isAllowedCurrency, normalizeCurrencyCode } from '@/lib/currencies';
import { enrichTripsWithAutoStatus } from '@/lib/modules/travel-planner/trip-enrich';
import { computeAutoTripStatus } from '@/lib/modules/travel-planner/trip-status';

/** GET: 해당 그룹의 여행 목록 (tenant = groupId) */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('travel_trips')
      .select('*')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('travel_trips GET:', error);
      return NextResponse.json({ error: '여행 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const enriched = await enrichTripsWithAutoStatus(supabase, (data ?? []) as Parameters<typeof enrichTripsWithAutoStatus>[1]);
    return NextResponse.json({ success: true, data: enriched });
  } catch (e: any) {
    console.error('GET /api/v1/travel/trips:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** POST: 여행 생성 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const { groupId, title, destination, start_date, end_date, currency: bodyCurrency } = body as {
      groupId?: string;
      title?: string;
      destination?: string;
      start_date?: string;
      end_date?: string;
      currency?: string;
    };

    if (!groupId || !title || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'groupId, title, start_date, end_date는 필수입니다.' },
        { status: 400 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const isAdmin = memberCheck.role === 'ADMIN' || memberCheck.isOwner;
    let tripCurrency = 'KRW';
    if (bodyCurrency != null && String(bodyCurrency).trim()) {
      const c = normalizeCurrencyCode(String(bodyCurrency));
      if (!c || !isAllowedCurrency(c)) {
        return NextResponse.json({ error: '유효하지 않은 통화 코드입니다.' }, { status: 400 });
      }
      tripCurrency = isAdmin ? c : 'KRW';
    }

    const supabase = getSupabaseServerClient();
    const initialStatus = computeAutoTripStatus(start_date, end_date);

    const { data, error } = await supabase
      .from('travel_trips')
      .insert({
        group_id: groupId,
        title: String(title).trim(),
        destination: destination ? String(destination).trim() : null,
        start_date,
        end_date,
        created_by: user.id,
        currency: tripCurrency,
        status: initialStatus,
        status_source: 'auto',
        diary_enabled: false,
      })
      .select()
      .single();

    if (error) {
      console.error('travel_trips POST:', error);
      return NextResponse.json({ error: '여행 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('POST /api/v1/travel/trips:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
