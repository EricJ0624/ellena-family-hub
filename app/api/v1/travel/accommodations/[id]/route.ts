import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/** PATCH: 숙소 수정 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId와 id가 필요합니다.' }, { status: 400 });
    }

    const perm = await checkPermission(user.id, groupId, null, user.id);
    if (!perm.success) {
      return NextResponse.json({ error: '그룹 접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
    if (body.name !== undefined) updatePayload.name = String(body.name).trim();
    if (body.check_in_date !== undefined) updatePayload.check_in_date = body.check_in_date;
    if (body.check_out_date !== undefined) updatePayload.check_out_date = body.check_out_date;
    if (body.address !== undefined) updatePayload.address = body.address ? String(body.address).trim() : null;
    if (body.memo !== undefined) updatePayload.memo = body.memo ? String(body.memo).trim() : null;
    if (body.latitude !== undefined) updatePayload.latitude = body.latitude == null ? null : Number(body.latitude);
    if (body.longitude !== undefined) updatePayload.longitude = body.longitude == null ? null : Number(body.longitude);

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

    // 연동 일정 동기화: source_type='accommodation', source_id=id 인 일정 업데이트
    const desc = [data.address, data.memo].filter(Boolean).join(' · ') || null;
    const itineraryUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      day_date: data.check_in_date,
      title: `숙소: ${data.name}`,
      description: desc,
      address: data.address || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    };
    await supabase
      .from('travel_itineraries')
      .update(itineraryUpdate)
      .eq('trip_id', data.trip_id)
      .eq('group_id', groupId)
      .eq('source_type', 'accommodation')
      .eq('source_id', id)
      .is('deleted_at', null);

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
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId와 id가 필요합니다.' }, { status: 400 });
    }

    const perm = await checkPermission(user.id, groupId, null, user.id);
    if (!perm.success) {
      return NextResponse.json({ error: '그룹 접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();
    // 연동 일정 먼저 소프트 삭제
    await supabase
      .from('travel_itineraries')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('source_type', 'accommodation')
      .eq('source_id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null);
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
