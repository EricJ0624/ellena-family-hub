import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';

/** GET: place_id로 캐시 조회. 있으면 { place_id, name, latitude, longitude, formatted_address } 반환 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const placeId = request.nextUrl.searchParams.get('placeId');
    if (!placeId || !placeId.trim()) {
      return NextResponse.json({ error: 'placeId가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('place_cache')
      .select('place_id, name, latitude, longitude, formatted_address')
      .eq('place_id', placeId.trim())
      .maybeSingle();

    if (error) {
      console.warn('place_cache GET:', error);
      return NextResponse.json({ error: '캐시 조회 실패' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ cached: false }, { status: 200 });
    }

    return NextResponse.json({
      cached: true,
      place_id: data.place_id,
      name: data.name ?? undefined,
      latitude: data.latitude ?? undefined,
      longitude: data.longitude ?? undefined,
      formatted_address: data.formatted_address ?? undefined,
    });
  } catch (e) {
    console.warn('place-cache GET error:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

/** POST: Place Details 결과를 캐시에 저장(upsert). 영구 보관 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const placeId = typeof body.place_id === 'string' ? body.place_id.trim() : body.placeId;
    if (!placeId) {
      return NextResponse.json({ error: 'place_id가 필요합니다.' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name : undefined;
    const latitude = typeof body.latitude === 'number' ? body.latitude : undefined;
    const longitude = typeof body.longitude === 'number' ? body.longitude : undefined;
    const formatted_address = typeof body.formatted_address === 'string' ? body.formatted_address : undefined;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('place_cache')
      .upsert(
        {
          place_id: placeId,
          name: name ?? null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          formatted_address: formatted_address ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'place_id' }
      );

    if (error) {
      console.warn('place_cache upsert:', error);
      return NextResponse.json({ error: '캐시 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.warn('place-cache POST error:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
