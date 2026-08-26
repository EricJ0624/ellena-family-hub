import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { canWriteDiary } from '@/lib/modules/travel-planner/diary-eligibility';
import { parseShowMap } from '@/lib/modules/travel-planner/diary-types';
import {
  parseCollageAttachmentIds,
  parseCollageStyle,
  parsePhotoFocus,
} from '@/lib/modules/travel-planner/diary-collage';

function parseMoodTags(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
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
  };
}

/** PATCH: update diary entry */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId와 id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    if (body.restore === true) {
      const { data: hiddenRow, error: hiddenErr } = await supabase
        .from('travel_diary_entries')
        .select('id, trip_id, source_kind, source_id')
        .eq('id', id)
        .eq('group_id', groupId)
        .not('deleted_at', 'is', null)
        .maybeSingle();

      if (hiddenErr || !hiddenRow) {
        return NextResponse.json({ error: '숨긴 다이어리 항목을 찾을 수 없습니다.' }, { status: 404 });
      }

      const tripId = (hiddenRow as { trip_id: string }).trip_id;
      const { data: tripRow } = await supabase
        .from('travel_trips')
        .select('diary_enabled')
        .eq('id', tripId)
        .eq('group_id', groupId)
        .single();

      if (!tripRow || !canWriteDiary(tripRow as { diary_enabled?: boolean })) {
        return NextResponse.json({ error: '다이어리 작성 권한이 없습니다.' }, { status: 403 });
      }

      const kind = (hiddenRow as { source_kind?: string | null }).source_kind;
      const sourceId = (hiddenRow as { source_id?: string | null }).source_id;
      if (kind && sourceId) {
        const { data: activeDup } = await supabase
          .from('travel_diary_entries')
          .select('id')
          .eq('group_id', groupId)
          .eq('trip_id', tripId)
          .eq('source_kind', kind)
          .eq('source_id', sourceId)
          .is('deleted_at', null)
          .maybeSingle();
        if (activeDup?.id) {
          return NextResponse.json(
            { error: '이미 같은 장소의 다이어리 항목이 있습니다.' },
            { status: 409 },
          );
        }
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('travel_diary_entries')
        .update({
          deleted_at: null,
          deleted_by: null,
          updated_at: now,
          updated_by: user.id,
        })
        .eq('id', id)
        .eq('group_id', groupId)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: '다이어리 복원에 실패했습니다.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: normalizeEntryRow(data as Record<string, unknown>),
      });
    }

    const { data: existing, error: exErr } = await supabase
      .from('travel_diary_entries')
      .select('trip_id')
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (exErr || !existing) {
      return NextResponse.json({ error: '다이어리 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const tripId = (existing as { trip_id: string }).trip_id;
    const { data: tripRow } = await supabase
      .from('travel_trips')
      .select('diary_enabled')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .single();

    if (!tripRow || !canWriteDiary(tripRow as { diary_enabled?: boolean })) {
      return NextResponse.json({ error: '다이어리 작성 권한이 없습니다.' }, { status: 403 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
    if (body.note !== undefined) updatePayload.note = body.note ? String(body.note).trim() : null;
    if (body.day_date !== undefined) updatePayload.day_date = String(body.day_date).slice(0, 10);
    const moods = parseMoodTags(body.mood_tags);
    if (moods !== undefined) updatePayload.mood_tags = moods;
    if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order);
    if (body.collage_attachment_ids !== undefined) {
      updatePayload.collage_attachment_ids = parseCollageAttachmentIds(body.collage_attachment_ids);
    }
    if (body.collage_style !== undefined) {
      updatePayload.collage_style = parseCollageStyle(body.collage_style);
    }
    if (body.show_map !== undefined) {
      updatePayload.show_map = parseShowMap(body.show_map);
    }
    if (body.photo_focus !== undefined) {
      updatePayload.photo_focus = parsePhotoFocus(body.photo_focus);
    }

    const { data, error } = await supabase
      .from('travel_diary_entries')
      .update(updatePayload)
      .eq('id', id)
      .eq('group_id', groupId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: '다이어리 수정에 실패했습니다.' }, { status: 500 });
    }

    const row = data as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: normalizeEntryRow(row),
    });
  } catch (e: unknown) {
    console.error('PATCH diary-entry:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}

/** DELETE: soft delete */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId와 id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: existing, error: exErr } = await supabase
      .from('travel_diary_entries')
      .select('trip_id')
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .maybeSingle();

    if (exErr || !existing) {
      return NextResponse.json({ error: '다이어리 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: tripRow } = await supabase
      .from('travel_trips')
      .select('diary_enabled')
      .eq('id', (existing as { trip_id: string }).trip_id)
      .eq('group_id', groupId)
      .single();

    if (!tripRow || !canWriteDiary(tripRow as { diary_enabled?: boolean })) {
      return NextResponse.json({ error: '다이어리 작성 권한이 없습니다.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('travel_diary_entries')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null);

    if (error) {
      return NextResponse.json({ error: '다이어리 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('DELETE diary-entry:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}
