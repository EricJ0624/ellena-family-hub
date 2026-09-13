import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { attachFieldToItinerary } from '@/lib/modules/travel-planner/field-attach';
import {
  buildFieldRecordTitle,
  reverseGeocodeLatLng,
} from '@/lib/modules/travel-planner/reverse-geocode';
import { notifyTravelDetailChanged } from '@/lib/notifications/travel';

/** POST: complete route → attach to itinerary (create or attach) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: trackId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    const dayDate = typeof body.day_date === 'string' ? body.day_date.trim().slice(0, 10) : '';
    const startTime =
      typeof body.start_time === 'string' ? body.start_time.trim().substring(0, 5) : '';
    const endTime =
      typeof body.end_time === 'string' ? body.end_time.trim().substring(0, 5) : '';
    const endLat = body.end_lat != null ? Number(body.end_lat) : null;
    const endLng = body.end_lng != null ? Number(body.end_lng) : null;
    let address = typeof body.address === 'string' ? body.address.trim() : null;
    const customTitle =
      typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
    const attachModeRaw = typeof body.attach_mode === 'string' ? body.attach_mode : 'create';
    const attachMode = attachModeRaw === 'attach' ? 'attach' : 'create';
    const itineraryId =
      typeof body.itinerary_id === 'string' && body.itinerary_id.trim()
        ? body.itinerary_id.trim()
        : null;

    if (!groupId || !trackId || !dayDate || !startTime) {
      return NextResponse.json(
        { error: 'groupId, track id, day_date, start_time는 필수입니다.' },
        { status: 400 },
      );
    }
    if (attachMode === 'attach' && !itineraryId) {
      return NextResponse.json({ error: 'itinerary_id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: track, error: trackErr } = await supabase
      .from('travel_field_tracks')
      .select('*')
      .eq('id', trackId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (trackErr || !track) {
      return NextResponse.json({ error: '경로를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (track.user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
    if (track.status !== 'recording') {
      return NextResponse.json({ error: '이미 종료된 경로입니다.' }, { status: 400 });
    }

    const { data: points } = await supabase
      .from('travel_field_points')
      .select('latitude, longitude, seq')
      .eq('track_id', trackId)
      .order('seq', { ascending: true });

    const first = points?.[0];
    const last = points && points.length > 0 ? points[points.length - 1] : null;
    const lat =
      (Number.isFinite(endLat as number) ? (endLat as number) : null) ??
      (last ? Number(last.latitude) : null) ??
      (track.start_lat != null ? Number(track.start_lat) : null);
    const lng =
      (Number.isFinite(endLng as number) ? (endLng as number) : null) ??
      (last ? Number(last.longitude) : null) ??
      (track.start_lng != null ? Number(track.start_lng) : null);

    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: '저장할 좌표가 없습니다.' }, { status: 400 });
    }

    const endHm = endTime || startTime;
    const now = new Date().toISOString();

    const { error: upTrackErr } = await supabase
      .from('travel_field_tracks')
      .update({
        status: 'completed',
        ended_at: now,
        updated_at: now,
        day_date: dayDate,
        start_time: startTime,
        end_time: endHm,
        end_lat: lat,
        end_lng: lng,
        start_lat: track.start_lat ?? (first ? Number(first.latitude) : lat),
        start_lng: track.start_lng ?? (first ? Number(first.longitude) : lng),
      })
      .eq('id', trackId);

    if (upTrackErr) {
      console.error('field-tracks complete update:', upTrackErr);
      return NextResponse.json({ error: '경로 종료에 실패했습니다.' }, { status: 500 });
    }

    if (!address) {
      address = await reverseGeocodeLatLng(lat, lng);
    }
    const title = customTitle || buildFieldRecordTitle('route', startTime, endHm);

    const pointCount = points?.length ?? 0;
    const attach = await attachFieldToItinerary({
      supabase,
      groupId,
      tripId: String(track.trip_id),
      userId: user.id,
      dayDate,
      timeHm: startTime,
      latitude: lat,
      longitude: lng,
      address,
      title,
      fieldRecordKind: 'route',
      fieldTrackId: trackId,
      endTimeHm: endHm,
      description: pointCount > 0 ? `경로 포인트 ${pointCount}개` : null,
      attachMode,
      itineraryId,
    });

    await supabase
      .from('travel_field_tracks')
      .update({ itinerary_id: attach.itineraryId, updated_at: new Date().toISOString() })
      .eq('id', trackId);

    await notifyTravelDetailChanged({
      supabase,
      groupId,
      actorUserId: user.id,
      tripId: String(track.trip_id),
      summary: '현장 경로가 일정에 기록되었습니다.',
    });

    return NextResponse.json({
      success: true,
      data: { trackId, ...attach, pointCount },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST field-tracks complete:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
