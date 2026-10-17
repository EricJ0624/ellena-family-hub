import { fetchProfilePreferences } from '@/lib/profile-preferences';
import { getTopCurrencyCodes, isAllowedCurrency, normalizeCurrencyCode } from '@/lib/currencies';
import { currencyForCountryCode } from '@/lib/modules/travel-planner/location-currency';
import { supabase } from '@/lib/supabase';

function acceptSelectableCurrency(raw: unknown): string | null {
  const code = normalizeCurrencyCode(typeof raw === 'string' ? raw : null);
  if (!code || !isAllowedCurrency(code)) return null;
  if (!getTopCurrencyCodes().includes(code)) return null;
  return code;
}

async function readCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** 좌표의 국가 통화. 모르면 null. 로그인 세션이 있을 때만 조회한다. */
export async function fetchLocationCurrency(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch('/api/v1/travel/location-currency', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude }),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { currency?: unknown } | null;
    return acceptSelectableCurrency(json?.currency);
  } catch {
    return null;
  }
}

/**
 * 새 여행 기본 통화.
 * 거주 국가 → 없으면 현재 위치 국가 → 없으면 KRW.
 */
export async function resolveDefaultTripCurrency(): Promise<string> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (userId) {
      const prefs = await fetchProfilePreferences(userId);
      const fromCountry = currencyForCountryCode(prefs?.country_code);
      if (fromCountry) return fromCountry;
    }
  } catch {
    /* 거주 국가를 못 읽으면 현재 위치로 넘어간다. */
  }

  const pos = await readCurrentPosition();
  if (pos) {
    const fromLocation = await fetchLocationCurrency(pos.latitude, pos.longitude);
    if (fromLocation) return fromLocation;
  }
  return 'KRW';
}
