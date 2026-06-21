/**
 * 외부 지도 앱 길안내 딥링크 (Maps Platform API 과금 없음)
 */

export type NavMapApp = 'google' | 'kakao' | 'naver';

export const NAV_MAP_STORAGE_KEY = 'family-hub.nav-map-app';

export function getDefaultNavMapApp(lang: string): NavMapApp {
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

export function buildNavMapUrl(app: NavMapApp, lat: number, lng: number): string {
  const latStr = String(lat);
  const lngStr = String(lng);

  switch (app) {
    case 'kakao':
      return `https://m.map.kakao.com/scheme/route?ep=${latStr},${lngStr}&by=car`;
    case 'naver':
      return `https://map.naver.com/p/directions/-/-/${lngStr},${latStr}/car?c=15.00,0,0,0,dh`;
    case 'google':
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${latStr},${lngStr}&travelmode=driving&dir_action=navigate`;
  }
}

export function openNavMapApp(app: NavMapApp, lat: number, lng: number): void {
  const url = buildNavMapUrl(app, lat, lng);
  window.open(url, '_blank', 'noopener,noreferrer');
}
