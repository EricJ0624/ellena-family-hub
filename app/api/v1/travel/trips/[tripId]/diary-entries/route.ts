import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';
import { canWriteDiary } from '@/lib/modules/travel-planner/diary-eligibility';
import { syncPlaceFeedbackWithExpense } from '@/lib/modules/travel-planner/place-feedback-sync';
import { parseShowMap } from '@/lib/modules/travel-planner/diary-types';
import type { TravelPlaceSourceKind } from '@/lib/modules/travel-planner/unified-itinerary';
import {
  parseCollageAttachmentIds,
  parseCollageStyle,
  parsePhotoFocus,
} from '@/lib/modules/travel-planner/diary-collage';
import { DIARY_PURGE_TAG } from '@/lib/modules/travel-planner/diary-purge';

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
    collage_attachment_ids: parseCollageAttachmentIds(row.collage_attachment_ids),
    collage_style: parseCollageStyle(row.collage_style),
    photo_focus: parsePhotoFocus(row.photo_focus),
    show_map: parseShowMap(row.show_map),
    deleted_at: (row.deleted_at as string | null | undefined) ?? null,
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

    const includeDeleted = request.nextUrl.searchParams.get('includeDeleted') === '1';
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from('travel_diary_entries')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .order('day_date', { ascending: true })
      .order('sort_order', { ascending: true });
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('travel_diary_entries GET:', error);
      return NextResponse.json({ error: '다이어리 조회에 실패했습니다.' }, { status: 500 });
    }

    const rows = (data ?? []).map((r) => normalizeEntryRow(r as Record<string, unknown>));
    if (!includeDeleted) {
      return NextResponse.json({ success: true, data: rows });
    }

    const active = rows.filter((r) => !r.deleted_at);
    const hidden = rows.filter((r) => Boolean(r.deleted_at));
    return NextResponse.json({ success: true, data: active, hidden });
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

    /** 다이어리 전체삭제(복구 불가). 플래너 원본 일정은 삭제하지 않음. */
    if (body.hideAll === true) {
      const now = new Date().toISOString();
      const purgeTags = [DIARY_PURGE_TAG];

      const { error: softAllErr } = await supabase
        .from('travel_diary_entries')
        .update({
          deleted_at: now,
          deleted_by: user.id,
          updated_at: now,
          updated_by: user.id,
          mood_tags: purgeTags,
        })
        .eq('group_id', groupId)
        .eq('trip_id', tripId)
        .is('deleted_at', null);
      if (softAllErr) throw softAllErr;

      const { error: markHiddenErr } = await supabase
        .from('travel_diary_entries')
        .update({
          mood_tags: purgeTags,
          updated_at: now,
          updated_by: user.id,
        })
        .eq('group_id', groupId)
        .eq('trip_id', tripId)
        .not('deleted_at', 'is', null);
      if (markHiddenErr) throw markHiddenErr;

      type PlaceStub = {
        source_kind: TravelPlaceSourceKind;
        source_id: string;
        day_date: string;
      };
      const stubs: PlaceStub[] = [];

      const pushRows = (
        kind: TravelPlaceSourceKind,
        rows: { id?: string; day_date?: string; check_in_date?: string }[] | null,
        dayKey: 'day_date' | 'check_in_date',
      ) => {
        for (const row of rows ?? []) {
          const id = row.id ? String(row.id) : '';
          const day = String(row[dayKey] || '').slice(0, 10);
          if (!id || !day) continue;
          stubs.push({ source_kind: kind, source_id: id, day_date: day });
        }
      };

      const [accRes, dinRes, attRes, trRes, itRes] = await Promise.all([
        supabase
          .from('travel_accommodations')
          .select('id, check_in_date')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .is('deleted_at', null),
        supabase
          .from('travel_dining')
          .select('id, day_date')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .is('deleted_at', null),
        supabase
          .from('travel_attractions')
          .select('id, day_date')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .is('deleted_at', null),
        supabase
          .from('travel_transports')
          .select('id, day_date')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .is('deleted_at', null),
        supabase
          .from('travel_itineraries')
          .select('id, day_date')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .is('deleted_at', null),
      ]);

      if (accRes.error) throw accRes.error;
      if (dinRes.error) throw dinRes.error;
      if (attRes.error) throw attRes.error;
      if (trRes.error) throw trRes.error;
      if (itRes.error) throw itRes.error;

      pushRows('accommodation', accRes.data as { id?: string; check_in_date?: string }[], 'check_in_date');
      pushRows('dining', dinRes.data as { id?: string; day_date?: string }[], 'day_date');
      pushRows('attraction', attRes.data as { id?: string; day_date?: string }[], 'day_date');
      pushRows('transport', trRes.data as { id?: string; day_date?: string }[], 'day_date');
      pushRows('itinerary', itRes.data as { id?: string; day_date?: string }[], 'day_date');

      const { data: existingRows, error: existingErr } = await supabase
        .from('travel_diary_entries')
        .select('id, source_kind, source_id')
        .eq('group_id', groupId)
        .eq('trip_id', tripId);
      if (existingErr) throw existingErr;

      const existingKeys = new Set(
        (existingRows ?? [])
          .map((r) =>
            r.source_kind && r.source_id ? `${r.source_kind}:${r.source_id}` : '',
          )
          .filter(Boolean),
      );

      const toInsert = stubs
        .filter((s) => !existingKeys.has(`${s.source_kind}:${s.source_id}`))
        .map((s) => ({
          group_id: groupId,
          trip_id: tripId,
          source_kind: s.source_kind,
          source_id: s.source_id,
          day_date: s.day_date,
          note: null,
          mood_tags: purgeTags,
          sort_order: 0,
          created_by: user.id,
          created_at: now,
          updated_at: now,
          updated_by: user.id,
          deleted_at: now,
          deleted_by: user.id,
        }));

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('travel_diary_entries').insert(toInsert);
        if (insErr) throw insErr;
      }

      // 다이어리 위젯 목록에서 이 여행 제거 (플래너 여행 자체는 유지)
      const { error: disableErr } = await supabase
        .from('travel_trips')
        .update({ diary_enabled: false, updated_at: now })
        .eq('id', tripId)
        .eq('group_id', groupId);
      if (disableErr) throw disableErr;

      return NextResponse.json({ success: true, purged: stubs.length, diary_enabled: false });
    }

    if (body.hide === true) {
      const hideDay = body.day_date ? String(body.day_date).slice(0, 10) : '';
      if (!hideDay) {
        return NextResponse.json({ error: 'day_date가 필요합니다.' }, { status: 400 });
      }
      const hideKindRaw = body.source_kind;
      const hideKind =
        hideKindRaw == null || hideKindRaw === ''
          ? null
          : SOURCE_KINDS.has(String(hideKindRaw))
            ? (String(hideKindRaw) as TravelPlaceSourceKind)
            : null;
      if (hideKindRaw != null && hideKindRaw !== '' && !hideKind) {
        return NextResponse.json({ error: '유효하지 않은 source_kind입니다.' }, { status: 400 });
      }
      const hideSourceId = body.source_id ? String(body.source_id) : null;
      const now = new Date().toISOString();

      const applySoftDelete = async (id: string) => {
        const { data, error } = await supabase
          .from('travel_diary_entries')
          .update({ deleted_at: now, deleted_by: user.id, updated_at: now, updated_by: user.id })
          .eq('id', id)
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        return data as Record<string, unknown> | null;
      };

      if (body.id) {
        const deleted = await applySoftDelete(String(body.id));
        return NextResponse.json({
          success: true,
          data: deleted ? normalizeEntryRow(deleted) : null,
        });
      }

      if (hideKind && hideSourceId) {
        const { data: active } = await supabase
          .from('travel_diary_entries')
          .select('id')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .eq('source_kind', hideKind)
          .eq('source_id', hideSourceId)
          .is('deleted_at', null)
          .maybeSingle();
        if (active?.id) {
          const deleted = await applySoftDelete(active.id);
          return NextResponse.json({
            success: true,
            data: deleted ? normalizeEntryRow(deleted) : null,
          });
        }
        const { data: alreadyHidden } = await supabase
          .from('travel_diary_entries')
          .select('*')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .eq('source_kind', hideKind)
          .eq('source_id', hideSourceId)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (alreadyHidden?.id) {
          return NextResponse.json({ success: true, data: normalizeEntryRow(alreadyHidden as Record<string, unknown>) });
        }
        const { data: inserted, error: insErr } = await supabase
          .from('travel_diary_entries')
          .insert({
            group_id: groupId,
            trip_id: tripId,
            source_kind: hideKind,
            source_id: hideSourceId,
            day_date: hideDay,
            note: null,
            mood_tags: [],
            sort_order: 0,
            created_by: user.id,
            created_at: now,
            updated_at: now,
            updated_by: user.id,
            deleted_at: now,
            deleted_by: user.id,
          })
          .select('*')
          .single();
        if (insErr) throw insErr;
        return NextResponse.json({
          success: true,
          data: normalizeEntryRow(inserted as Record<string, unknown>),
        });
      }

      return NextResponse.json({ error: '숨길 다이어리 항목이 없습니다.' }, { status: 400 });
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

    const payload: Record<string, unknown> = {
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
    if (body.collage_attachment_ids !== undefined) {
      payload.collage_attachment_ids = parseCollageAttachmentIds(body.collage_attachment_ids);
    }
    if (body.collage_style !== undefined) {
      payload.collage_style = parseCollageStyle(body.collage_style);
    }
    if (body.show_map !== undefined) {
      payload.show_map = parseShowMap(body.show_map);
    }

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
