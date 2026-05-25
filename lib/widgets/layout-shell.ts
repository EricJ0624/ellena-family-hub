/** 대시보드 레이아웃 쉘 — 그리드 열 수·PC 프레임 스타일의 기준 */
export type DashboardShell = 'mobile' | 'web-preview' | 'desktop';

const DESKTOP_SHELL_ENV = process.env.NEXT_PUBLIC_DASHBOARD_SHELL;

/** 순수 터치 기기(스마트폰·터치만 태블릿) */
export const TOUCH_ONLY_DEVICE_MEDIA_QUERY = '(hover: none) and (pointer: coarse)';

/** PC·마우스 환경 */
export const ANY_FINE_POINTER_MEDIA_QUERY = '(any-pointer: fine)';

/** 넓은 뷰포트 */
export const WIDE_VIEWPORT_MEDIA_QUERY = '(min-width: 768px)';

/** @deprecated */
export const TOUCH_PRIMARY_MEDIA_QUERY = TOUCH_ONLY_DEVICE_MEDIA_QUERY;

/** 레이아웃 MQ 리스너용 */
export const WEB_PREVIEW_MEDIA_QUERY = WIDE_VIEWPORT_MEDIA_QUERY;

export function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(TOUCH_ONLY_DEVICE_MEDIA_QUERY).matches;
}

/** @deprecated */
export function isTouchPrimaryDevice(): boolean {
  return isTouchOnlyDevice();
}

export function isWideViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(WIDE_VIEWPORT_MEDIA_QUERY).matches;
}

export function hasFinePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(ANY_FINE_POINTER_MEDIA_QUERY).matches;
}

export function isWebPreviewEnvironment(): boolean {
  return detectDashboardShell() === 'web-preview';
}

/**
 * - mobile: 스마트폰·순수 터치 (세로·가로)
 * - desktop: PC 브라우저·마우스 + 넓은 창 (앱 이용)
 * - web-preview: 폰 목업 미리보기(수동 전환·레거시)
 */
export function detectDashboardShell(): DashboardShell {
  if (typeof window === 'undefined') return 'mobile';
  if (DESKTOP_SHELL_ENV === 'desktop') return 'desktop';
  if (typeof window !== 'undefined' && (window as Window & { __ELLENA_DESKTOP_APP__?: boolean }).__ELLENA_DESKTOP_APP__) {
    return 'desktop';
  }
  if (isTouchOnlyDevice()) return 'mobile';
  if (isWideViewport() && hasFinePointer()) return 'desktop';
  if (isWideViewport()) return 'web-preview';
  return 'mobile';
}
