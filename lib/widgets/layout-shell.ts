/** 대시보드 레이아웃 쉘 — 그리드 열 수·PC 프레임 스타일의 기준 */
export type DashboardShell = 'mobile' | 'web-preview' | 'desktop';

const DESKTOP_SHELL_ENV = process.env.NEXT_PUBLIC_DASHBOARD_SHELL;

/** 터치(스마트폰·태블릿) 기기 — 가로 회전 시에도 mobile 쉘 유지 */
export const TOUCH_PRIMARY_MEDIA_QUERY = '(pointer: coarse)';

/** PC 브라우저(마우스·fine pointer). 터치 primary는 제외 */
export const WEB_PREVIEW_MEDIA_QUERY = '(min-width: 768px) and (pointer: fine)';

export function isTouchPrimaryDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(TOUCH_PRIMARY_MEDIA_QUERY).matches;
}

export function isWebPreviewEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTouchPrimaryDevice()) return false;
  return window.matchMedia(WEB_PREVIEW_MEDIA_QUERY).matches;
}

/**
 * 현재 실행 환경의 대시보드 쉘.
 * - mobile: 터치 기기·좁은 뷰포트 (세로·가로 포함, 전체 너비)
 * - web-preview: PC 브라우저 430px 폰 프레임 (+ 가로 미리보기 토글)
 * - desktop: PC 앱·전체 창 (NEXT_PUBLIC_DASHBOARD_SHELL=desktop 또는 추후 네이티브 플래그)
 */
export function detectDashboardShell(): DashboardShell {
  if (typeof window === 'undefined') return 'mobile';
  if (DESKTOP_SHELL_ENV === 'desktop') return 'desktop';
  if (typeof window !== 'undefined' && (window as Window & { __ELLENA_DESKTOP_APP__?: boolean }).__ELLENA_DESKTOP_APP__) {
    return 'desktop';
  }
  if (isTouchPrimaryDevice()) return 'mobile';
  if (window.matchMedia('(min-width: 768px)').matches) return 'web-preview';
  return 'mobile';
}
