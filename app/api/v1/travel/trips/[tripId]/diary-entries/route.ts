import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';
import { canWriteDiary } from '@/lib/modules/travel-planner/diary-eligibility';
import { syncPlaceFeedbackWithExpense } from '@/lib/modules/travel-planner/place-feedback-sync';
import type { TravelPlaceSourceKind } from '@/lib/modules/travel-planner/unified-itinerary';

const SOURCE_KINDS = new Set([
  'attraction',
  'dining',
  'accommodation',
  'transport',
  'itinerary',
]);

function parseMoodTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
}

function normalizeEntryRow(row: Record<string, unknown>) {
  const moods = row.mood_tags;
  return {
    ...row,
    mood_tags: Array.isArray(moods) ? moods.map(String) : [],
  };
}

/** GET: diary entries for trip */
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
      .from('travel_diary_entries')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('day_date', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('travel_diary_entries GET:', error);
      return NextResponse.json({ error: '다이어리 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((r) => normalizeEntryRow(r as Record<string, unknown>)),
    });
  } catch (e: unknown) {
    console.error('GET diary-entries:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}

/** POST: create or update diary entry (+ optional place feedback sync) */
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

    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    const supabase = getSupabaseServerClient();
    const { data: tripRow, error: tripErr } = await supabase
      .from('travel_trips')
      .select('id, diary_enabled, status, currency')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (tripErr || !tripRow) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!canWriteDiary(tripRow as { diary_enabled?: boolean })) {
      return NextResponse.json(
        { error: '다이어리 작성 권한이 없습니다. 여행 다이어리를 먼저 시작해 주세요.' },
        { status: 403 },
      );
    }

    const dayDate = body.day_date ? String(body.day_date).slice(0, 10) : '';
    if (!dayDate) {
      return NextResponse.json({ error: 'day_date가 필요합니다.' }, { status: 400 });
    }

    const sourceKindRaw = body.source_kind;
    const sourceKind =
      sourceKindRaw == null || sourceKindRaw === ''
        ? null
        : SOURCE_KINDS.has(String(sourceKindRaw))
          ? (String(sourceKindRaw) as TravelPlaceSourceKind)
          : null;
    if (sourceKindRaw != null && sourceKindRaw !== '' && !sourceKind) {
      return NextResponse.json({ error: '유효하지 않은 source_kind입니다.' }, { status: 400 });
    }

    const sourceId = body.source_id ? String(body.source_id) : null;
    const now = new Date().toISOString();
    const moodTags = parseMoodTags(body.mood_tags);
    const note = body.note != null ? (body.note ? String(body.note).trim() : null) : null;

    const payload = {
      group_id: groupId,
      trip_id: tripId,
      source_kind: sourceKind,
      source_id: sourceId,
      day_date: dayDate,
      note,
      mood_tags: moodTags,
      sort_order: body.sort_order != null ? Number(body.sort_order) : 0,
      updated_at: now,
      updated_by: user.id,
    };

    let saved: Record<string, unknown> | null = null;

    if (body.id) {
      const { data, error } = await supabase
        .from('travel_diary_entries')
        .update(payload)
        .eq('id', String(body.id))
        .eq('group_id', groupId)
        .eq('trip_id', tripId)
        .is('deleted_at', null)
        .select('*')
        .single();
      if (error) throw error;
      saved = data as Record<string, unknown>;
    } else if (sourceKind && sourceId) {
      const { data: existing } = await supabase
        .from('travel_diary_entries')
        .select('id')
        .eq('group_id', groupId)
        .eq('trip_id', tripId)
        .eq('source_kind', sourceKind)
        .eq('source_id', sourceId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await supabase
          .from('travel_diary_entries')
          .update(payload)
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        saved = data as Record<string, unknown>;
      } else {
        const { data, error } = await supabase
          .from('travel_diary_entries')
          .insert({ ...payload, created_by: user.id, created_at: now })
          .select('*')
          .single();
        if (error) throw error;
        saved = data as Record<string, unknown>;
      }
    } else {
      const { data, error } = await supabase
        .from('travel_diary_entries')
        .insert({ ...payload, created_by: user.id, created_at: now })
        .select('*')
        .single();
      if (error) throw error;
      saved = data as Record<string, unknown>;
    }

    if (sourceKind && sourceId && (body.rating != null || body.actual_expense != null || body.is_revisit != null)) {
      await syncPlaceFeedbackWithExpense(supabase, {
        groupId,
        tripId,
        sourceKind,
        sourceId,
        userId: user.id,
        rating: body.rating != null ? Number(body.rating) : undefined,
        isRevisit: body.is_revisit,
        feedbackNote: note,
        actualExpense: body.actual_expense,
        expenseDate: dayDate,
        placeTitle: body.place_title,
        tripCurrency: (tripRow as { currency?: string }).currency,
      });
    }

    return NextResponse.json({ success: true, data: normalizeEntryRow(saved!) });
  } catch (e: unknown) {
    console.error('POST diary-entries:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}
