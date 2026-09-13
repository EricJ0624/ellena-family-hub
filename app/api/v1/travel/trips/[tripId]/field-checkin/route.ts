import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember, assertTripInGroup } from '@/lib/api-guards';
import { attachFieldToItinerary, type FieldAttachMode } from '@/lib/modules/travel-planner/field-attach';
import {
  buildFieldRecordTitle,
  reverseGeocodeLatLng,
} from '@/lib/modules/travel-planner/reverse-geocode';
import { notifyTravelDetailChanged } from '@/lib/notifications/travel';

/** POST: one-tap current location → create or attach itinerary */
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
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const dayDate = typeof body.day_date === 'string' ? body.day_date.trim().slice(0, 10) : '';
    const timeHm =
      typeof body.time_hm === 'string' ? body.time_hm.trim().substring(0, 5) : '';
    let address = typeof body.address === 'string' ? body.address.trim() : null;
    const customTitle =
      typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
    const attachModeRaw = typeof body.attach_mode === 'string' ? body.attach_mode : 'create';
    const attachMode: FieldAttachMode = attachModeRaw === 'attach' ? 'attach' : 'create';
    const itineraryId =
      typeof body.itinerary_id === 'string' && body.itinerary_id.trim()
        ? body.itinerary_id.trim()
        : null;

    if (!groupId || !tripId || !dayDate || !timeHm) {
      return NextResponse.json(
        { error: 'groupId, tripId, day_date, time_hm는 필수입니다.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: '유효한 좌표가 필요합니다.' }, { status: 400 });
    }
    if (attachMode === 'attach' && !itineraryId) {
      return NextResponse.json({ error: 'itinerary_id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const tripCheck = await assertTripInGroup(tripId, groupId);
    if (tripCheck instanceof NextResponse) return tripCheck;

    if (!address) {
      address = await reverseGeocodeLatLng(latitude, longitude);
    }
    const title = customTitle || buildFieldRecordTitle('checkin', timeHm);

    const supabase = getSupabaseServerClient();
    const result = await attachFieldToItinerary({
      supabase,
      groupId,
      tripId,
      userId: user.id,
      dayDate,
      timeHm,
      latitude,
      longitude,
      address,
      title,
      fieldRecordKind: 'checkin',
      description: null,
      attachMode,
      itineraryId,
    });

    await notifyTravelDetailChanged({
      supabase,
      groupId,
      actorUserId: user.id,
      tripId,
      summary: '현장 위치가 일정에 기록되었습니다.',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST field-checkin:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
