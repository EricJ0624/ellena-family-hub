import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { canWriteDiary } from '@/lib/modules/travel-planner/diary-eligibility';

function parseMoodTags(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
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
      data: { ...row, mood_tags: Array.isArray(row.mood_tags) ? row.mood_tags : [] },
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
