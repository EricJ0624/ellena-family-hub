import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';

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
      .order('expense_date', { ascending: false });

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
    const { category, amount, currency, paid_by, memo, expense_date, entry_type } = body as {
      category?: string;
      amount?: number;
      currency?: string;
      paid_by?: string;
      memo?: string;
      expense_date?: string;
      entry_type?: 'addition' | 'expense';
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

    const { data, error } = await supabase
      .from('travel_expenses')
      .insert({
        trip_id: tripId,
        group_id: groupId,
        entry_type: resolvedEntryType,
        category: category ? String(category).trim() : null,
        amount: Number(amount),
        currency: currency ? String(currency).trim() : 'KRW',
        paid_by: paid_by || null,
        memo: memo ? String(memo).trim() : null,
        expense_date,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('travel_expenses POST:', error);
      return NextResponse.json({ error: '경비 추가에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('POST /api/v1/travel/trips/[tripId]/expenses:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
