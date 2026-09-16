import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { notifyTravelDetailChanged } from '@/lib/notifications/travel';
import { enrichMissingPlaceCoordinates } from '@/lib/modules/travel-planner/resolve-place-coordinates';

/** PATCH: 먹거리 수정 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { data: existing } = await supabase
      .from('travel_dining')
      .select('day_date, end_day_date, name, address, place_id, latitude, longitude')
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .maybeSingle();

    let existingEnd: string | null = null;
    let existingDay: string | null = null;
    if (existing?.day_date) existingDay = String(existing.day_date).slice(0, 10);
    if (existing?.end_day_date) existingEnd = String(existing.end_day_date).slice(0, 10);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
    if (body.name !== undefined) updatePayload.name = String(body.name).trim();
    if (body.day_date !== undefined) updatePayload.day_date = body.day_date;
    if (body.day_date !== undefined && body.end_day_date === undefined) {
      const nd = String(body.day_date).trim().slice(0, 10);
      if (existingEnd && existingEnd < nd) updatePayload.end_day_date = null;
    }
    if (body.end_day_date !== undefined) {
      const dayForEnd =
        typeof body.day_date === 'string'
          ? String(body.day_date).trim().slice(0, 10)
          : existingDay ?? undefined;
      const ed =
        body.end_day_date == null || body.end_day_date === ''
          ? null
          : String(body.end_day_date).trim().slice(0, 10);
      if (!ed || !dayForEnd || ed <= dayForEnd) updatePayload.end_day_date = null;
      else updatePayload.end_day_date = ed;
    }
    if (body.time_at !== undefined) updatePayload.time_at = body.time_at ? String(body.time_at).trim().substring(0, 5) : null;
    if (body.category !== undefined) updatePayload.category = body.category ? String(body.category).trim() : null;
    if (body.memo !== undefined) updatePayload.memo = body.memo ? String(body.memo).trim() : null;
    if (body.address !== undefined) updatePayload.address = body.address ? String(body.address).trim() : null;
    if (body.place_id !== undefined) updatePayload.place_id = body.place_id ? String(body.place_id).trim() : null;
    if (body.latitude !== undefined) updatePayload.latitude = body.latitude == null ? null : Number(body.latitude);
    if (body.longitude !== undefined) updatePayload.longitude = body.longitude == null ? null : Number(body.longitude);
    if (body.show_in_itinerary !== undefined) updatePayload.show_in_itinerary = body.show_in_itinerary === true;

    const enriched = await enrichMissingPlaceCoordinates(supabase, {
      place_id:
        (updatePayload.place_id as string | null | undefined) ??
        (existing?.place_id as string | null | undefined) ??
        null,
      name:
        (updatePayload.name as string | undefined) ??
        (existing?.name as string | undefined) ??
        null,
      address:
        (updatePayload.address as string | null | undefined) ??
        (existing?.address as string | null | undefined) ??
        null,
      latitude:
        updatePayload.latitude !== undefined
          ? (updatePayload.latitude as number | null)
          : ((existing?.latitude as number | null | undefined) ?? null),
      longitude:
        updatePayload.longitude !== undefined
          ? (updatePayload.longitude as number | null)
          : ((existing?.longitude as number | null | undefined) ?? null),
    });
    if (enriched.latitude != null && updatePayload.latitude === undefined) {
      updatePayload.latitude = enriched.latitude;
    }
    if (enriched.longitude != null && updatePayload.longitude === undefined) {
      updatePayload.longitude = enriched.longitude;
    }
    if (enriched.place_id && updatePayload.place_id === undefined && !existing?.place_id) {
      updatePayload.place_id = enriched.place_id;
    }

    const { data, error } = await supabase
      .from('travel_dining')
      .update(updatePayload)
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('travel_dining PATCH:', error);
      return NextResponse.json({ error: '먹거리 수정에 실패했습니다.' }, { status: 500 });
    }

    await notifyTravelDetailChanged({
      supabase,
      groupId,
      actorUserId: user.id,
      tripId: data?.trip_id ? String(data.trip_id) : null,
      summary: '여행 식당이 수정되었습니다.',
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('PATCH /api/v1/travel/dining/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** DELETE: 먹거리 삭제 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      .from('travel_dining')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('id', id)
      .eq('group_id', groupId);

    if (error) {
      console.error('travel_dining DELETE:', error);
      return NextResponse.json({ error: '먹거리 삭제에 실패했습니다.' }, { status: 500 });
    }

    await notifyTravelDetailChanged({
      supabase,
      groupId,
      actorUserId: user.id,
      tripId: null,
      summary: '여행 식당이 삭제되었습니다.',
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/v1/travel/dining/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
