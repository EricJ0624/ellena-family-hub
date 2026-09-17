import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';
import { notifyTravelDetailChanged } from '@/lib/notifications/travel';

/** GET: 해당 여행의 경비 목록 */
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

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('travel_expenses')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('travel_expenses GET:', error);
      return NextResponse.json({ error: '경비 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: any) {
    console.error('GET /api/v1/travel/trips/[tripId]/expenses:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** POST: 경비 추가 */
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
    const { category, amount, paid_by, memo, expense_date, entry_type, source_kind, source_id } = body as {
      category?: string;
      amount?: number;
      paid_by?: string;
      memo?: string;
      expense_date?: string;
      entry_type?: 'addition' | 'expense';
      source_kind?: string | null;
      source_id?: string | null;
    };

    if (!groupId || !tripId || amount == null || amount < 0 || !expense_date) {
      return NextResponse.json(
        { error: 'groupId, tripId, amount(>=0), expense_date는 필수입니다.' },
        { status: 400 }
      );
    }
    const resolvedEntryType = entry_type === 'addition' ? 'addition' : 'expense';

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();

    const { data: tripRow, error: tripCurError } = await supabase
      .from('travel_trips')
      .select('currency')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (tripCurError || !tripRow) {
      return NextResponse.json({ error: '여행 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const tripCurrency =
      String((tripRow as { currency?: string }).currency || 'KRW')
        .trim()
        .toUpperCase() || 'KRW';

    const sourceKinds = new Set(['attraction', 'dining', 'accommodation', 'transport', 'itinerary']);
    let resolvedSourceKind: string | null = null;
    let resolvedSourceId: string | null = null;
    if (source_kind != null && String(source_kind).trim()) {
      const sk = String(source_kind).trim();
      if (!sourceKinds.has(sk)) {
        return NextResponse.json({ error: '유효하지 않은 source_kind입니다.' }, { status: 400 });
      }
      const sid = source_id != null ? String(source_id).trim() : '';
      if (!sid) {
        return NextResponse.json({ error: 'source_id가 필요합니다.' }, { status: 400 });
      }
      resolvedSourceKind = sk;
      resolvedSourceId = sid;
    }

    const { data, error } = await supabase
      .from('travel_expenses')
      .insert({
        trip_id: tripId,
        group_id: groupId,
        entry_type: resolvedEntryType,
        category: category ? String(category).trim() : null,
        amount: Number(amount),
        currency: tripCurrency,
        paid_by: paid_by || null,
        memo: memo ? String(memo).trim() : null,
        expense_date,
        source_kind: resolvedSourceKind,
        source_id: resolvedSourceId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('travel_expenses POST:', error);
      return NextResponse.json({ error: '경비 추가에 실패했습니다.' }, { status: 500 });
    }

    await notifyTravelDetailChanged({
      supabase,
      groupId,
      actorUserId: user.id,
      tripId,
      summary: '여행 경비가 추가되었습니다.',
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('POST /api/v1/travel/trips/[tripId]/expenses:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
