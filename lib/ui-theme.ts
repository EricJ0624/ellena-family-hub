/**
 * 그룹 대시보드 UI 테마.
 * - default: Neo Brutalism (포스터 대각 스트라이프; DB 키 default 유지, 전 앱 공통)
 * - kids_friendly: Family Friendly (패밀리/일러스트형 디자인 시스템)
 * - highend_glass: 글래스모피즘
 */
export type UiTheme = 'default' | 'kids_friendly' | 'highend_glass';

export const UI_THEMES: readonly UiTheme[] = [
  'default',
  'kids_friendly',
  'highend_glass',
] as const;

export const DEFAULT_UI_THEME: UiTheme = 'kids_friendly';

/** DB/캐시에 남을 수 있는 레거시 값을 포함해 정규화 */
export function resolveUiTheme(value: unknown): UiTheme {
  if (value === 'highend_glass') return 'highend_glass';
  if (value === 'kids_friendly' || value === 'stable_glass') return 'kids_friendly';
  if (value === 'default') return 'default';
  return DEFAULT_UI_THEME;
}
