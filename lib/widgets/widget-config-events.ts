/** 위젯 설정 저장 후 대시보드 그리드가 즉시 재로드하도록 알림 */
export const WIDGET_CONFIGS_UPDATED_EVENT = 'ellena-widget-configs-updated';

export function dispatchWidgetConfigsUpdated(): void {
  if (typeof document === 'undefined') return;
  // 대시보드 리스너가 document에 붙어 있음. window에만 쏘면 갱신이 안 됨.
  document.dispatchEvent(new Event(WIDGET_CONFIGS_UPDATED_EVENT));
}
