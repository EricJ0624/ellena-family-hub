import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api-guards';
import { currencyForCountryCode } from '@/lib/modules/travel-planner/location-currency';
import { reverseGeocodeCountryCode } from '@/lib/modules/travel-planner/reverse-geocode';

/** POST: 좌표의 국가 통화. 앱이 모르는 국가면 currency는 null. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json().catch(() => ({}));
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: '유효한 좌표가 필요합니다.' }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: '유효한 좌표가 필요합니다.' }, { status: 400 });
    }

    const countryCode = await reverseGeocodeCountryCode(latitude, longitude);
    const currency = currencyForCountryCode(countryCode);
    return NextResponse.json({ success: true, currency });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST location-currency:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
