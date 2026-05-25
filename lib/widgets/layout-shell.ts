/** 대시보드 레이아웃 쉘 — 그리드 열 수·PC 프레임 스타일의 기준 */
export type DashboardShell = 'mobile' | 'web-preview' | 'desktop';

const DESKTOP_SHELL_ENV = process.env.NEXT_PUBLIC_DASHBOARD_SHELL;

/**
 * 순수 터치 기기(스마트폰·터치만 태블릿). 터치 노트북은 제외(hover 가능).
 * 가로 회전 시에도 mobile 쉘 유지.
 */
export const TOUCH_ONLY_DEVICE_MEDIA_QUERY = '(hover: none) and (pointer: coarse)';

/** 넓은 뷰포트 — PC·태블릿 가로 */
export const WIDE_VIEWPORT_MEDIA_QUERY = '(min-width: 768px)';

/** @deprecated TOUCH_ONLY_DEVICE_MEDIA_QUERY 사용 */
export const TOUCH_PRIMARY_MEDIA_QUERY = TOUCH_ONLY_DEVICE_MEDIA_QUERY;

/** PC 웹 미리보기 후보(레거시·훅 리스너용) */
export const WEB_PREVIEW_MEDIA_QUERY = WIDE_VIEWPORT_MEDIA_QUERY;

/** hover 없는 터치 폰/패드만 true — 터치 PC(마우스 병행)는 false */
export function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(TOUCH_ONLY_DEVICE_MEDIA_QUERY).matches;
}

/** @deprecated isTouchOnlyDevice 사용 */
export function isTouchPrimaryDevice(): boolean {
  return isTouchOnlyDevice();
}

export function isWideViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(WIDE_VIEWPORT_MEDIA_QUERY).matches;
}

export function isWebPreviewEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTouchOnlyDevice()) return false;
  return isWideViewport();
}

/**
 * 현재 실행 환경의 대시보드 쉘.
 * - mobile: 순수 터치 기기·좁은 뷰포트 (세로·가로, 전체 너비)
 * - web-preview: PC·터치 노트북 브라우저 430px 프레임 (+ 가로 미리보기 토글)
 * - desktop: PC 앱·전체 창
 */
export function detectDashboardShell(): DashboardShell {
  if (typeof window === 'undefined') return 'mobile';
  if (DESKTOP_SHELL_ENV === 'desktop') return 'desktop';
  if (typeof window !== 'undefined' && (window as Window & { __ELLENA_DESKTOP_APP__?: boolean }).__ELLENA_DESKTOP_APP__) {
    return 'desktop';
  }
  if (isTouchOnlyDevice()) return 'mobile';
  if (isWideViewport()) return 'web-preview';
  return 'mobile';
}
