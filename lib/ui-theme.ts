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

/**
 * 표시용 테마 결정.
 * 테마 localStorage(최근 네트워크/설정 저장)를 bootstrap groupRows(최대 24h 스톡)보다 우선한다.
 * 네트워크 select 직후 persistGroupUiTheme가 캐시를 먼저 갱신하므로 DB와 어긋나지 않는다.
 */
export function resolveEffectiveUiTheme(options: {
  hasGroupRow: boolean;
  dbValue?: unknown;
  cachedTheme?: UiTheme | null;
}): UiTheme {
  if (options.cachedTheme) {
    return resolveUiTheme(options.cachedTheme);
  }
  if (options.hasGroupRow) {
    return resolveUiTheme(options.dbValue);
  }
  return DEFAULT_UI_THEME;
}

/** DB/캐시에 저장된 명시적 테마 값인지 (null/undefined → false, DEFAULT 추론 금지) */
export function isExplicitUiTheme(value: unknown): boolean {
  return (
    value === 'highend_glass' ||
    value === 'kids_friendly' ||
    value === 'stable_glass' ||
    value === 'default'
  );
}
