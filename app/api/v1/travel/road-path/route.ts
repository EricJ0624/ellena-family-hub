import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import type { FieldTrackLatLng } from '@/lib/modules/travel-planner/field-track-path';
import { computeWalkingRoutePath } from '@/lib/modules/travel-planner/routes-compute';

function mapsKey(): string {
  return (
    (process.env.GOOGLE_MAPS_SERVER_API_KEY || '').trim() ||
    (process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || '').trim()
  );
}

/**
 * POST: proxy Routes API so browser-restricted keys work (forwards Referer)
 * and CORS is avoided.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = typeof body.groupId === 'string' ? body.groupId : '';
    const rawPoints = Array.isArray(body.points) ? body.points : [];

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(authResult.user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const points: FieldTrackLatLng[] = [];
    for (const p of rawPoints) {
      const lat = Number((p as { lat?: unknown })?.lat);
      const lng = Number((p as { lng?: unknown })?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      points.push({ lat, lng });
    }
    if (points.length < 2) {
      return NextResponse.json({ error: 'points가 부족합니다.' }, { status: 400 });
    }
    if (points.length > 50) {
      return NextResponse.json({ error: 'points가 너무 많습니다.' }, { status: 400 });
    }

    const key = mapsKey();
    if (!key) {
      return NextResponse.json({ error: '지도 API 키가 없습니다.' }, { status: 500 });
    }

    const referer =
      request.headers.get('referer') ||
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000/';

    const path = await computeWalkingRoutePath(points, key, { referer });
    if (path.length < 2) {
      return NextResponse.json({
        success: true,
        data: { path: [], fromRoads: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: { path, fromRoads: true },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST road-path:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
