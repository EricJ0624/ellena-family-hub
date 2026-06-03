import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';
import { syncPlaceFeedbackWithExpense } from '@/lib/modules/travel-planner/place-feedback-sync';
import type { TravelPlaceSourceKind } from '@/lib/modules/travel-planner/unified-itinerary';

const SOURCE_KINDS = new Set([
  'attraction',
  'dining',
  'accommodation',
  'transport',
  'itinerary',
]);

function parseSourceKind(raw: unknown): TravelPlaceSourceKind | null {
  const s = String(raw ?? '').trim();
  return SOURCE_KINDS.has(s) ? (s as TravelPlaceSourceKind) : null;
}

/** GET: trip place feedback list */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { tripId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(authResult.user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('travel_place_feedback')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('travel_place_feedback GET:', error);
      return NextResponse.json({ error: '장소 피드백 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: unknown) {
    console.error('GET place-feedback:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}

/** POST: upsert place feedback + optional expense sync */
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
    const sourceKind = parseSourceKind(body.sourceKind ?? body.source_kind);
    const sourceId = body.sourceId ?? body.source_id;

    if (!groupId || !tripId || !sourceKind || !sourceId) {
      return NextResponse.json(
        { error: 'groupId, tripId, sourceKind, sourceId가 필요합니다.' },
        { status: 400 },
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();

    const { data: tripRow, error: tripErr } = await supabase
      .from('travel_trips')
      .select('currency')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (tripErr || !tripRow) {
      return NextResponse.json({ error: '여행 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    let rating: number | null = null;
    if (body.rating !== undefined && body.rating !== null) {
      const r = Number(body.rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json({ error: 'rating은 1~5 정수여야 합니다.' }, { status: 400 });
      }
      rating = r;
    }

    const data = await syncPlaceFeedbackWithExpense(supabase, {
      groupId,
      tripId,
      sourceKind,
      sourceId: String(sourceId),
      userId: user.id,
      rating,
      isRevisit: body.isRevisit ?? body.is_revisit ?? null,
      feedbackNote: body.feedbackNote ?? body.feedback_note ?? null,
      actualExpense:
        body.actualExpense !== undefined
          ? body.actualExpense
          : body.actual_expense !== undefined
            ? body.actual_expense
            : undefined,
      expenseDate: body.expenseDate ?? body.expense_date,
      placeTitle: body.placeTitle ?? body.place_title,
      tripCurrency: (tripRow as { currency?: string }).currency,
    });

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    console.error('POST place-feedback:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}
