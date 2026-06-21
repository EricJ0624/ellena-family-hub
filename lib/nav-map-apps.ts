/**
 * 외부 지도 앱 길안내 딥링크 (Maps Platform API 과금 없음)
 */

export type NavMapApp = 'google' | 'kakao' | 'naver';

export const NAV_MAP_STORAGE_KEY = 'family-hub.nav-map-app';

/** 대한민국(제주 포함) 대략적 경계 — 해외/국내 지도앱 분기용 */
const KOREA_LAT_MIN = 33.0;
const KOREA_LAT_MAX = 38.7;
const KOREA_LNG_MIN = 124.5;
const KOREA_LNG_MAX = 132.1;

export function isLocationInSouthKorea(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= KOREA_LAT_MIN &&
    lat <= KOREA_LAT_MAX &&
    lng >= KOREA_LNG_MIN &&
    lng <= KOREA_LNG_MAX
  );
}

export const NAV_MAP_APPS_IN_KOREA: NavMapApp[] = ['google', 'kakao', 'naver'];
export const NAV_MAP_APPS_ABROAD: NavMapApp[] = ['google'];

export function getAvailableNavMapApps(inKorea: boolean): NavMapApp[] {
  return inKorea ? NAV_MAP_APPS_IN_KOREA : NAV_MAP_APPS_ABROAD;
}

/** 한국 밖이면 카카오/네이버 선택을 Google로 강제 */
export function resolveNavMapApp(
  preferred: NavMapApp,
  userLat?: number | null,
  userLng?: number | null,
): NavMapApp {
  if (
    userLat != null &&
    userLng != null &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLng)
  ) {
    return isLocationInSouthKorea(userLat, userLng) ? preferred : 'google';
  }
  return preferred;
}

export type NavMapUrls = {
  web: string;
  app?: string;
  androidIntent?: string;
};

export function getDefaultNavMapApp(lang: string, inKorea = true): NavMapApp {
  if (!inKorea) return 'google';
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(NAV_MAP_STORAGE_KEY);
    if (saved === 'google' || saved === 'kakao' || saved === 'naver') {
      return saved;
    }
  }
  return lang === 'ko' ? 'kakao' : 'google';
}

export function saveNavMapAppPreference(app: NavMapApp): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NAV_MAP_STORAGE_KEY, app);
}

function getNavAppName(): string {
  if (typeof window === 'undefined') return 'ellena-family-hub';
  return window.location.origin || 'ellena-family-hub';
}

function isMobileUserAgent(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isAndroidUserAgent(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export type NavMapStart = { lat: number; lng: number };

export function buildNavMapUrls(
  app: NavMapApp,
  lat: number,
  lng: number,
  start?: NavMapStart,
): NavMapUrls {
  const latStr = String(lat);
  const lngStr = String(lng);
  const appName = encodeURIComponent(getNavAppName());
  const hasStart =
    start != null && Number.isFinite(start.lat) && Number.isFinite(start.lng);

  switch (app) {
    case 'kakao': {
      const ep = `${latStr},${lngStr}`;
      const routeQuery =
        hasStart
          ? `sp=${start!.lat},${start!.lng}&ep=${ep}&by=car`
          : `ep=${ep}&by=car`;
      const web = `https://m.map.kakao.com/scheme/route?${routeQuery}`;
      const appScheme = `kakaomap://route?${routeQuery}`;
      const androidIntent =
        `intent://route?${routeQuery}#Intent;scheme=kakaomap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=net.daum.android.map;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      return { web, app: appScheme, androidIntent };
    }
    case 'naver': {
      const web = `https://map.naver.com/p/directions/-/-/${lngStr},${latStr}/car?c=15.00,0,0,0,dh`;
      const appScheme = `nmap://route/car?dlat=${latStr}&dlng=${lngStr}&appname=${appName}`;
      const androidIntent =
        `intent://route/car?dlat=${latStr}&dlng=${lngStr}&appname=${appName}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      return { web, app: appScheme, androidIntent };
    }
    case 'google':
    default: {
      const destCoord = encodeURIComponent(`${latStr},${lngStr}`);
      const originParam = hasStart
        ? `&origin=${encodeURIComponent(`${start!.lat},${start!.lng}`)}`
        : '';
      // Maps URL API — iOS/Android 앱이 https 를 intercept (google.navigation 은 Android 전용)
      const web =
        `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destCoord}&travelmode=driving&dir_action=navigate`;
      const daddr = encodeURIComponent(`${latStr},${lngStr}`);
      const iosScheme = hasStart
        ? `comgooglemaps://?saddr=${encodeURIComponent(`${start!.lat},${start!.lng}`)}&daddr=${daddr}&directionsmode=driving`
        : `comgooglemaps://?daddr=${daddr}&directionsmode=driving`;
      const androidIntent =
        `intent://www.google.com/maps/dir/?api=1${originParam}&destination=${destCoord}&travelmode=driving&dir_action=navigate#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      return { web, app: iosScheme, androidIntent };
    }
  }
}

export function buildNavMapUrl(
  app: NavMapApp,
  lat: number,
  lng: number,
  start?: NavMapStart,
): string {
  return buildNavMapUrls(app, lat, lng, start).web;
}

function isIosUserAgent(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openAppScheme(url: string): void {
  if (isIosUserAgent()) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 2000);
    return;
  }
  window.location.assign(url);
}

/** 사용자 제스처 직후 호출해야 모바일에서 앱 전환이 안정적입니다. */
export function openNavMapApp(
  app: NavMapApp,
  lat: number,
  lng: number,
  start?: NavMapStart,
): void {
  if (typeof window === 'undefined') return;

  const userLat = start?.lat;
  const userLng = start?.lng;
  const resolvedApp = resolveNavMapApp(app, userLat, userLng);
  const urls = buildNavMapUrls(resolvedApp, lat, lng, start);

  if (resolvedApp === 'google') {
    if (isMobileUserAgent()) {
      // Android: GMM intent → Maps URL API 길찾기. iOS 등: https (앱 intercept)
      if (isAndroidUserAgent() && urls.androidIntent) {
        window.location.assign(urls.androidIntent);
        return;
      }
      window.location.assign(urls.web);
      return;
    }
    window.open(urls.web, '_blank', 'noopener,noreferrer');
    return;
  }

  if (isMobileUserAgent()) {
    if (isAndroidUserAgent() && urls.androidIntent) {
      window.location.assign(urls.androidIntent);
      return;
    }
    if (urls.app) {
      openAppScheme(urls.app);
      return;
    }
  }

  window.open(urls.web, '_blank', 'noopener,noreferrer');
}
