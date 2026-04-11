/**
 * 대시보드 메인 섹션 순서·기능 플래그.
 * - NEXT_PUBLIC_DASHBOARD_WIDGET_ORDER: 쉼표로 구분 (예: tasks,calendar,chat,travel,piggy,location)
 * - NEXT_PUBLIC_FEATURE_FAMILY_LOCATION: "false" 이면 위치 기능 UI·Realtime·로드 비활성화
 */

export type DashboardWidgetId =
  | 'tasks'
  | 'calendar'
  | 'chat'
  | 'travel'
  | 'piggy'
  | 'location';

const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  'tasks',
  'calendar',
  'chat',
  'travel',
  'piggy',
  'location',
];

const VALID_WIDGET_IDS = new Set<DashboardWidgetId>(DEFAULT_DASHBOARD_WIDGET_ORDER);

function parseWidgetId(token: string): DashboardWidgetId | null {
  const id = token.trim().toLowerCase() as DashboardWidgetId;
  return VALID_WIDGET_IDS.has(id) ? id : null;
}

/** 환경 변수 기준 위젯 순서 (누락 ID는 기본 순서대로 뒤에 붙음) */
export function getDashboardWidgetOrder(): DashboardWidgetId[] {
  const raw =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_DASHBOARD_WIDGET_ORDER?.trim()
      : undefined;
  if (!raw) {
    return [...DEFAULT_DASHBOARD_WIDGET_ORDER];
  }
  const parsed = raw
    .split(',')
    .map(parseWidgetId)
    .filter((x): x is DashboardWidgetId => x !== null);
  const seen = new Set<DashboardWidgetId>();
  const ordered: DashboardWidgetId[] = [];
  for (const id of parsed) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}

/** 빌드 시점 NEXT_PUBLIC 값 기준. "false"만 끔. */
export function isFamilyLocationFeatureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_FAMILY_LOCATION !== 'false';
}
