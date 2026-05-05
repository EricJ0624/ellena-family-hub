import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

/** PATCH: 숙소 수정 */
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
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
    if (body.name !== undefined) updatePayload.name = String(body.name).trim();
    if (body.check_in_date !== undefined) updatePayload.check_in_date = body.check_in_date;
    if (body.check_out_date !== undefined) updatePayload.check_out_date = body.check_out_date;
    if (body.check_in_time !== undefined) {
      updatePayload.check_in_time = body.check_in_time ? String(body.check_in_time).trim().substring(0, 5) : null;
    }
    if (body.check_out_time !== undefined) {
      updatePayload.check_out_time = body.check_out_time ? String(body.check_out_time).trim().substring(0, 5) : null;
    }
    if (body.address !== undefined) updatePayload.address = body.address ? String(body.address).trim() : null;
    if (body.memo !== undefined) updatePayload.memo = body.memo ? String(body.memo).trim() : null;
    if (body.place_id !== undefined) updatePayload.place_id = body.place_id ? String(body.place_id).trim() : null;
    if (body.latitude !== undefined) updatePayload.latitude = body.latitude == null ? null : Number(body.latitude);
    if (body.longitude !== undefined) updatePayload.longitude = body.longitude == null ? null : Number(body.longitude);
    if (body.show_in_itinerary !== undefined) updatePayload.show_in_itinerary = body.show_in_itinerary === true;

    const { data, error } = await supabase
      .from('travel_accommodations')
      .update(updatePayload)
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('travel_accommodations PATCH:', error);
      return NextResponse.json({ error: '숙소 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('PATCH /api/v1/travel/accommodations/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** DELETE: 숙소 삭제 */
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
      .from('travel_accommodations')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('id', id)
      .eq('group_id', groupId);

    if (error) {
      console.error('travel_accommodations DELETE:', error);
      return NextResponse.json({ error: '숙소 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/v1/travel/accommodations/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
