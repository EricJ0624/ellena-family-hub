import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import {
  buildFieldRecordTitle,
  reverseGeocodeLatLng,
} from '@/lib/modules/travel-planner/reverse-geocode';
import {
  FAMILY_LOG_CARD_COLUMNS,
  normalizeFamilyLogCard,
} from '@/app/features/family-log/card-record';

function localDayDate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function localHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
    if (!groupId) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }
    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('family_log_cards')
      .select(FAMILY_LOG_CARD_COLUMNS)
      .eq('group_id', groupId)
      .order('day_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('GET family-log cards:', error);
      return NextResponse.json({ error: '기록을 불러오지 못했습니다.' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => normalizeFamilyLogCard(row as Record<string, unknown>)),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('GET family-log cards:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    const kind =
      body.kind === 'route' ? 'route' : body.kind === 'checkin' ? 'checkin' : body.kind === 'note' ? 'note' : '';
    const dayDate =
      typeof body.day_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day_date)
        ? body.day_date
        : localDayDate();
    const timeHm =
      typeof body.time_hm === 'string' && body.time_hm.trim()
        ? body.time_hm.trim().substring(0, 5)
        : localHm();
    const endHm =
      typeof body.end_hm === 'string' && body.end_hm.trim()
        ? body.end_hm.trim().substring(0, 5)
        : null;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude);
    let address = typeof body.address === 'string' ? body.address.trim() : '';
    const requestedTitle = typeof body.title === 'string' ? body.title.trim() : '';
    const fallbackTitle = typeof body.fallback_title === 'string' ? body.fallback_title.trim() : '';

    if (!groupId || !kind) {
      return NextResponse.json({ error: 'groupId와 kind는 필수입니다.' }, { status: 400 });
    }
    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    if (!address && hasPoint && kind === 'checkin') {
      address = (await reverseGeocodeLatLng(latitude, longitude)) ?? '';
    }
    const title =
      requestedTitle ||
      (kind === 'checkin' && address ? address : '') ||
      fallbackTitle ||
      (kind === 'note' ? '새 일상' : buildFieldRecordTitle(kind, timeHm, endHm));

    const routePoints = Array.isArray(body.route_points) ? body.route_points : null;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('family_log_cards')
      .insert({
        group_id: groupId,
        title,
        kind,
        day_date: dayDate,
        latitude: hasPoint ? latitude : null,
        longitude: hasPoint ? longitude : null,
        address: address || null,
        route_points: routePoints,
        created_by: user.id,
      })
      .select(FAMILY_LOG_CARD_COLUMNS)
      .single();
    if (error) {
      console.error('POST family-log cards:', error);
      return NextResponse.json({ error: '기록을 저장하지 못했습니다.' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      data: normalizeFamilyLogCard(data as Record<string, unknown>),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST family-log cards:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
