import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/** GET: 해당 여행의 경비 목록 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
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
      .single();
    if (!trip) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('travel_expenses')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
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
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    const { category, amount, currency, paid_by, memo, expense_date } = body as {
      category?: string;
      amount?: number;
      currency?: string;
      paid_by?: string;
      memo?: string;
      expense_date?: string;
    };

    if (!groupId || !tripId || amount == null || amount < 0 || !expense_date) {
      return NextResponse.json(
        { error: 'groupId, tripId, amount(>=0), expense_date는 필수입니다.' },
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
      .single();
    if (!trip) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('travel_expenses')
      .insert({
        trip_id: tripId,
        group_id: groupId,
        category: category ? String(category).trim() : null,
        amount: Number(amount),
        currency: currency ? String(currency).trim() : 'KRW',
        paid_by: paid_by || null,
        memo: memo ? String(memo).trim() : null,
        expense_date,
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
