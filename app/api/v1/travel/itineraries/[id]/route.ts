import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

/** PATCH: 일정 수정 */
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

    let existingEnd: string | null = null;
    let existingDay: string | null = null;
    if (body.end_day_date !== undefined || body.day_date !== undefined) {
      const { data: ex } = await supabase
        .from('travel_itineraries')
        .select('day_date, end_day_date')
        .eq('id', id)
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .maybeSingle();
      if (ex?.day_date) existingDay = String(ex.day_date).slice(0, 10);
      if (ex?.end_day_date) existingEnd = String(ex.end_day_date).slice(0, 10);
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
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
    if (body.title !== undefined) updatePayload.title = String(body.title).trim();
    if (body.description !== undefined) updatePayload.description = body.description ? String(body.description).trim() : null;
    if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order);
    if (body.start_time !== undefined) updatePayload.start_time = body.start_time ? String(body.start_time).trim().substring(0, 5) : null;
    if (body.end_time !== undefined) updatePayload.end_time = body.end_time ? String(body.end_time).trim().substring(0, 5) : null;
    if (body.address !== undefined) updatePayload.address = body.address ? String(body.address).trim() : null;
    if (body.place_type !== undefined) {
      const pt = body.place_type == null || body.place_type === '' ? null : String(body.place_type).trim();
      updatePayload.place_type = pt && ['attraction', 'transport_air', 'transport_car', 'transport_bike', 'other'].includes(pt) ? pt : null;
    }
    if (body.latitude !== undefined) updatePayload.latitude = body.latitude == null ? null : Number(body.latitude);
    if (body.longitude !== undefined) updatePayload.longitude = body.longitude == null ? null : Number(body.longitude);

    const { data, error } = await supabase
      .from('travel_itineraries')
      .update(updatePayload)
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('travel_itineraries PATCH:', error);
      return NextResponse.json({ error: '일정 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('PATCH /api/v1/travel/itineraries/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** DELETE: 일정 삭제 */
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
      .from('travel_itineraries')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('id', id)
      .eq('group_id', groupId);

    if (error) {
      console.error('travel_itineraries DELETE:', error);
      return NextResponse.json({ error: '일정 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/v1/travel/itineraries/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
