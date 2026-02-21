import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/** GET: 단일 여행 조회 (tenant 일치 검증) */
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
    const { data, error } = await supabase
      .from('travel_trips')
      .select('*')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('GET /api/v1/travel/trips/[tripId]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** PATCH: 여행 수정 */
export async function PATCH(
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
    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
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
    if (body.title !== undefined) updatePayload.title = String(body.title).trim();
    if (body.destination !== undefined) updatePayload.destination = body.destination ? String(body.destination).trim() : null;
    if (body.start_date !== undefined) updatePayload.start_date = body.start_date;
    if (body.end_date !== undefined) updatePayload.end_date = body.end_date;
    if (body.budget !== undefined) updatePayload.budget = body.budget == null ? null : Number(body.budget);

    const { data, error } = await supabase
      .from('travel_trips')
      .update(updatePayload)
      .eq('id', tripId)
      .eq('group_id', groupId)
      .select()
      .single();

    if (error) {
      console.error('travel_trips PATCH:', error);
      return NextResponse.json({ error: '여행 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('PATCH /api/v1/travel/trips/[tripId]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** DELETE: 여행 소프트 삭제 (deleted_at, deleted_by 기록) + 하위 일정/경비 동일 처리 */
export async function DELETE(
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
    const now = new Date().toISOString();

    const { error: tripError } = await supabase
      .from('travel_trips')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('id', tripId)
      .eq('group_id', groupId);

    if (tripError) {
      console.error('travel_trips DELETE:', tripError);
      return NextResponse.json({ error: '여행 삭제에 실패했습니다.' }, { status: 500 });
    }

    await supabase
      .from('travel_itineraries')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('trip_id', tripId)
      .eq('group_id', groupId);
    await supabase
      .from('travel_expenses')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('trip_id', tripId)
      .eq('group_id', groupId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/v1/travel/trips/[tripId]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
