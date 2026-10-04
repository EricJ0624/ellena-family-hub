import { DASHBOARD_WIDGET_KEYS, type DashboardWidgetKey } from '@/lib/widgets/types';

const DASHBOARD_WIDGET_KEY_SET = new Set<string>(DASHBOARD_WIDGET_KEYS);

export function isDashboardWidgetKey(value: string): value is DashboardWidgetKey {
  return DASHBOARD_WIDGET_KEY_SET.has(value);
}

/** `?focus=` 또는 위치 요청 쿼리에서 대시보드 위젯 키를 읽는다. */
export function focusWidgetFromLocation(search: string): DashboardWidgetKey | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const focus = params.get('focus');
  if (focus && isDashboardWidgetKey(focus)) return focus;
  if (params.has('locationRequest')) return 'location';
  return null;
}

/**
 * 알림에 적힌 주소를 연다.
 * 대시보드 주소인데 위젯이 없으면, 알림의 widget_key 로 focus 를 붙인다.
 */
export function notificationOpenUrl(url: string, widgetKey: string): string {
  const raw = url.trim() || '/dashboard';
  let parsed: URL;
  try {
    parsed = new URL(raw, 'https://placeholder.local');
  } catch {
    return raw;
  }
  const path = parsed.pathname.replace(/\/$/, '') || '/';
  if (path !== '/dashboard') return raw;

  if (!parsed.searchParams.get('focus') && isDashboardWidgetKey(widgetKey)) {
    parsed.searchParams.set('focus', widgetKey);
  }
  if (!parsed.searchParams.get('focus') && parsed.searchParams.has('locationRequest')) {
    parsed.searchParams.set('focus', 'location');
  }
  const search = parsed.searchParams.toString();
  return search ? `${parsed.pathname}?${search}` : parsed.pathname;
}

export function scrollDashboardWidgetIntoView(widgetKey: string): boolean {
  if (!isDashboardWidgetKey(widgetKey)) return false;
  const el = document.querySelector(`[data-widget-key="${widgetKey}"]`);
  if (!(el instanceof HTMLElement)) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}
