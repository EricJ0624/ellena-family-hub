/** 위젯 설정 저장 후 대시보드 그리드가 즉시 재로드하도록 알림 */
export const WIDGET_CONFIGS_UPDATED_EVENT = 'ellena-widget-configs-updated';

export function dispatchWidgetConfigsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WIDGET_CONFIGS_UPDATED_EVENT));
}
