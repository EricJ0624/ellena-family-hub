import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import type { FieldTrackLatLng } from '@/lib/modules/travel-planner/field-track-path';
import {
  buildRoadSnappedPath,
  looksLikeRawGpsPath,
  parseStoredSnappedPath,
} from '@/lib/modules/travel-planner/snap-field-track-path';

type PointIn = {
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  recorded_at?: string;
  seq?: number;
};

/** GET: list points for a track (group members) + road-snapped path when available */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: trackId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !trackId) {
      return NextResponse.json({ error: 'groupId와 track id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(authResult.user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: track, error: trackErr } = await supabase
      .from('travel_field_tracks')
      .select('id, group_id, status, start_lat, start_lng, end_lat, end_lng, snapped_path')
      .eq('id', trackId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (trackErr || !track) {
      return NextResponse.json({ error: '경로를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: points, error } = await supabase
      .from('travel_field_points')
      .select('latitude, longitude, seq, recorded_at, accuracy')
      .eq('track_id', trackId)
      .order('seq', { ascending: true });

    if (error) {
      console.error('field-tracks points GET:', error);
      return NextResponse.json({ error: '포인트 조회에 실패했습니다.' }, { status: 500 });
    }

    let snappedPath = parseStoredSnappedPath(track.snapped_path);
    let roadSnapped = Boolean(snappedPath && snappedPath.length > 6);

    // Treat sparse stored path as raw GPS (failed server snap) → recompute
    if (snappedPath && looksLikeRawGpsPath(snappedPath)) {
      snappedPath = null;
      roadSnapped = false;
    }

    // Lazy backfill for completed tracks without a real road path
    if ((!snappedPath || !roadSnapped) && track.status === 'completed') {
      const raw: FieldTrackLatLng[] = [];
      for (const p of points ?? []) {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) raw.push({ lat, lng });
      }
      if (raw.length === 0) {
        const sl = track.start_lat != null ? Number(track.start_lat) : NaN;
        const sg = track.start_lng != null ? Number(track.start_lng) : NaN;
        const el = track.end_lat != null ? Number(track.end_lat) : NaN;
        const eg = track.end_lng != null ? Number(track.end_lng) : NaN;
        if (Number.isFinite(sl) && Number.isFinite(sg)) raw.push({ lat: sl, lng: sg });
        if (Number.isFinite(el) && Number.isFinite(eg)) raw.push({ lat: el, lng: eg });
      }
      if (raw.length >= 2) {
        try {
          const referer =
            request.headers.get('referer') ||
            request.headers.get('origin') ||
            process.env.NEXT_PUBLIC_APP_URL ||
            'http://localhost:3000/';
          const built = await buildRoadSnappedPath(raw, { referer });
          if (built.fromRoads && built.path.length >= 2) {
            snappedPath = built.path;
            roadSnapped = true;
            await supabase
              .from('travel_field_tracks')
              .update({
                snapped_path: built.path,
                updated_at: new Date().toISOString(),
              })
              .eq('id', trackId);
          }
        } catch (e) {
          console.warn('lazy snapToRoads:', e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: points ?? [],
      meta: {
        start_lat: track.start_lat ?? null,
        start_lng: track.start_lng ?? null,
        end_lat: track.end_lat ?? null,
        end_lng: track.end_lng ?? null,
        snapped_path: roadSnapped && snappedPath && snappedPath.length >= 2 ? snappedPath : null,
        road_snapped: roadSnapped,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('GET field-tracks points:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST: append GPS points to an active track */
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
    const points = Array.isArray(body.points) ? (body.points as PointIn[]) : [];

    if (!groupId || !trackId) {
      return NextResponse.json({ error: 'groupId와 track id가 필요합니다.' }, { status: 400 });
    }
    if (points.length === 0) {
      return NextResponse.json({ error: 'points가 필요합니다.' }, { status: 400 });
    }
    if (points.length > 200) {
      return NextResponse.json({ error: '한 번에 최대 200개까지 전송할 수 있습니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: track, error: trackErr } = await supabase
      .from('travel_field_tracks')
      .select('id, group_id, user_id, status')
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
      return NextResponse.json({ error: '기록 중이 아닌 경로입니다.' }, { status: 400 });
    }

    const { data: lastPoint } = await supabase
      .from('travel_field_points')
      .select('seq')
      .eq('track_id', trackId)
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = lastPoint?.seq != null ? Number(lastPoint.seq) + 1 : 0;
    const rows = [];
    for (const p of points) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      rows.push({
        track_id: trackId,
        group_id: groupId,
        seq: typeof p.seq === 'number' ? p.seq : seq++,
        recorded_at: p.recorded_at || new Date().toISOString(),
        latitude: lat,
        longitude: lng,
        accuracy: p.accuracy != null && Number.isFinite(Number(p.accuracy)) ? Number(p.accuracy) : null,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: '유효한 좌표가 없습니다.' }, { status: 400 });
    }

    const { error: insErr } = await supabase.from('travel_field_points').insert(rows);
    if (insErr) {
      console.error('field-tracks points POST:', insErr);
      return NextResponse.json({ error: '포인트 저장에 실패했습니다.' }, { status: 500 });
    }

    await supabase
      .from('travel_field_tracks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', trackId);

    return NextResponse.json({ success: true, data: { inserted: rows.length } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST field-tracks points:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
