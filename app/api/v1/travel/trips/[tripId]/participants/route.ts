import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

/** GET: 여행 참가자 user_id 목록 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('travel_trip_participants')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('travel_trip_participants GET:', error);
      return NextResponse.json({ error: '참가자 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('GET /api/v1/travel/trips/[tripId]/participants:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT: 참가자 목록 전체 교체
 * body: { groupId, userIds: string[] }
 * - 그룹 멤버만 허용
 * - soft-delete로 제거, 재추가는 deleted_at 해제 또는 insert
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
    const requestedIds = [
      ...new Set(
        rawIds
          .map((id: unknown) => String(id ?? '').trim())
          .filter(Boolean),
      ),
    ] as string[];

    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();

    const { data: trip, error: tripErr } = await supabase
      .from('travel_trips')
      .select('id')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .maybeSingle();
    if (tripErr || !trip) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: memberships, error: memErr } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('group_id', groupId);
    if (memErr) {
      console.error('participants memberships:', memErr);
      return NextResponse.json({ error: '멤버 확인에 실패했습니다.' }, { status: 500 });
    }
    const allowed = new Set((memberships ?? []).map((m) => m.user_id as string));
    const nextIds = requestedIds.filter((id) => allowed.has(id));
    if (nextIds.length !== requestedIds.length) {
      return NextResponse.json(
        { error: '그룹 멤버가 아닌 사용자는 참가자로 지정할 수 없습니다.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const { data: existing, error: exErr } = await supabase
      .from('travel_trip_participants')
      .select('id, user_id, deleted_at')
      .eq('trip_id', tripId)
      .eq('group_id', groupId);
    if (exErr) {
      console.error('participants existing:', exErr);
      return NextResponse.json({ error: '참가자 조회에 실패했습니다.' }, { status: 500 });
    }

    const byUser = new Map(
      (existing ?? []).map((row) => [row.user_id as string, row] as const),
    );
    const nextSet = new Set(nextIds);

    for (const row of existing ?? []) {
      const uid = row.user_id as string;
      if (!nextSet.has(uid) && !row.deleted_at) {
        const { error } = await supabase
          .from('travel_trip_participants')
          .update({
            deleted_at: now,
            deleted_by: user.id,
            updated_at: now,
            updated_by: user.id,
          })
          .eq('id', row.id);
        if (error) {
          console.error('participants soft delete:', error);
          return NextResponse.json({ error: '참가자 저장에 실패했습니다.' }, { status: 500 });
        }
      }
    }

    for (const uid of nextIds) {
      const row = byUser.get(uid);
      if (row?.id) {
        if (row.deleted_at) {
          const { error } = await supabase
            .from('travel_trip_participants')
            .update({
              deleted_at: null,
              deleted_by: null,
              updated_at: now,
              updated_by: user.id,
            })
            .eq('id', row.id);
          if (error) {
            console.error('participants restore:', error);
            return NextResponse.json({ error: '참가자 저장에 실패했습니다.' }, { status: 500 });
          }
        }
      } else {
        const { error } = await supabase.from('travel_trip_participants').insert({
          trip_id: tripId,
          group_id: groupId,
          user_id: uid,
          created_by: user.id,
          updated_by: user.id,
        });
        if (error) {
          console.error('participants insert:', error);
          return NextResponse.json({ error: '참가자 저장에 실패했습니다.' }, { status: 500 });
        }
      }
    }

    const { data, error } = await supabase
      .from('travel_trip_participants')
      .select('*')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('participants reload:', error);
      return NextResponse.json({ error: '참가자 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('PUT /api/v1/travel/trips/[tripId]/participants:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
