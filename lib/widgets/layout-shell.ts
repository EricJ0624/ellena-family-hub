/** 대시보드 레이아웃 쉘 — 그리드 열 수·PC 프레임 스타일의 기준 */
export type DashboardShell = 'mobile' | 'web-preview' | 'desktop';

const DESKTOP_SHELL_ENV = process.env.NEXT_PUBLIC_DASHBOARD_SHELL;

/**
 * 현재 실행 환경의 대시보드 쉘.
 * - mobile: 뷰포트 < 768px (전체 너비, 기존 모바일과 동일)
 * - web-preview: PC 브라우저 430px 폰 프레임
 * - desktop: PC 앱·전체 창 (NEXT_PUBLIC_DASHBOARD_SHELL=desktop 또는 추후 네이티브 플래그)
 */
export function detectDashboardShell(): DashboardShell {
  if (typeof window === 'undefined') return 'mobile';
  if (DESKTOP_SHELL_ENV === 'desktop') return 'desktop';
  if (typeof window !== 'undefined' && (window as Window & { __ELLENA_DESKTOP_APP__?: boolean }).__ELLENA_DESKTOP_APP__) {
    return 'desktop';
  }
  if (window.matchMedia('(min-width: 768px)').matches) return 'web-preview';
  return 'mobile';
}
