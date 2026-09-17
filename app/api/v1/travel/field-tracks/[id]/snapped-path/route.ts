import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import type { FieldTrackLatLng } from '@/lib/modules/travel-planner/field-track-path';

/** PUT: persist client-computed road path when server snap is blocked */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: trackId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as
      | string
      | undefined;
    const rawPath = Array.isArray(body.path) ? body.path : [];

    if (!groupId || !trackId) {
      return NextResponse.json({ error: 'groupId와 track id는 필수입니다.' }, { status: 400 });
    }

    const path: FieldTrackLatLng[] = [];
    for (const p of rawPath) {
      const lat = Number((p as { lat?: unknown })?.lat);
      const lng = Number((p as { lng?: unknown })?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      path.push({ lat, lng });
    }
    if (path.length < 2) {
      return NextResponse.json({ error: 'path에 좌표가 부족합니다.' }, { status: 400 });
    }
    if (path.length > 5000) {
      return NextResponse.json({ error: 'path가 너무 깁니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(authResult.user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: track, error: trackErr } = await supabase
      .from('travel_field_tracks')
      .select('id, group_id, status')
      .eq('id', trackId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (trackErr || !track) {
      return NextResponse.json({ error: '경로를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (track.status !== 'completed') {
      return NextResponse.json({ error: '종료된 경로만 저장할 수 있습니다.' }, { status: 400 });
    }

    const { error: upErr } = await supabase
      .from('travel_field_tracks')
      .update({
        snapped_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackId);

    if (upErr) {
      console.error('snapped-path PUT:', upErr);
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { pointCount: path.length } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('PUT field-tracks snapped-path:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
