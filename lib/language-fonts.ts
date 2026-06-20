/**
 * 앱 표시 언어 코드 (profiles.preferred_language 및 폰트 매핑용)
 */
export type LangCode = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'es' | 'fr' | 'de' | 'it' | 'pt';

export type LangOption = { code: LangCode; label: string };

/** 언어 선택 UI·검증·i18n 루프의 단일 소스 */
export const LANG_OPTIONS: readonly LangOption[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

export const LANG_CODES: LangCode[] = LANG_OPTIONS.map((o) => o.code);

/** 공지 작성: 기본 직접 입력 언어 */
export const ANNOUNCEMENT_PRIMARY_LANG_CODES: LangCode[] = ['ko', 'en'];

/** 공지 작성: 선택적 추가 언어 */
export const ANNOUNCEMENT_EXTRA_LANG_CODES: LangCode[] = LANG_CODES.filter(
  (c) => c !== 'ko' && c !== 'en',
);

export const LANG_LABELS: Record<LangCode, string> = Object.fromEntries(
  LANG_OPTIONS.map(({ code, label }) => [code, label]),
) as Record<LangCode, string>;

export function isValidLang(v: unknown): v is LangCode {
  return typeof v === 'string' && (LANG_CODES as readonly string[]).includes(v);
}

export function getLangLabel(lang: LangCode): string {
  return LANG_LABELS[lang] ?? lang;
}

/**
 * 언어별 타이틀/본문 폰트 (CDN 로드된 폰트명)
 * - 한국어: 타이틀 Pretendard Bold, 본문 Pretendard Regular
 * - 영어: 타이틀 Inter Bold, 본문 Inter Regular
 * - 일본어: 타이틀 Pretendard JP Bold, 본문 Noto Sans JP Regular
 * - 중국어 간체: 타이틀 Noto Sans SC Bold, 본문 Noto Sans SC Regular
 * - 중국어 번체: 타이틀 Noto Sans TC Bold, 본문 Noto Sans SC Regular
 * - es/fr/de/it: Inter (영어와 동일, 라틴 문자)
 */
export function getFontStyle(
  lang: LangCode,
  type: 'title' | 'body'
): { fontFamily: string; fontWeight: number } {
  const map: Record<LangCode, { title: { fontFamily: string; fontWeight: number }; body: { fontFamily: string; fontWeight: number } }> = {
    ko: { title: { fontFamily: 'Pretendard, sans-serif', fontWeight: 700 }, body: { fontFamily: 'Pretendard, sans-serif', fontWeight: 400 } },
    en: { title: { fontFamily: 'Inter, sans-serif', fontWeight: 700 }, body: { fontFamily: 'Inter, sans-serif', fontWeight: 400 } },
    ja: { title: { fontFamily: '"Pretendard JP", sans-serif', fontWeight: 700 }, body: { fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 400 } },
    'zh-CN': { title: { fontFamily: '"Noto Sans SC", sans-serif', fontWeight: 700 }, body: { fontFamily: '"Noto Sans SC", sans-serif', fontWeight: 400 } },
    'zh-TW': { title: { fontFamily: '"Noto Sans TC", sans-serif', fontWeight: 700 }, body: { fontFamily: '"Noto Sans TC", sans-serif', fontWeight: 400 } },
    es: { title: { fontFamily: 'Inter, sans-serif', fontWeight: 700 }, body: { fontFamily: 'Inter, sans-serif', fontWeight: 400 } },
    fr: { title: { fontFamily: 'Inter, sans-serif', fontWeight: 700 }, body: { fontFamily: 'Inter, sans-serif', fontWeight: 400 } },
    de: { title: { fontFamily: 'Inter, sans-serif', fontWeight: 700 }, body: { fontFamily: 'Inter, sans-serif', fontWeight: 400 } },
    it: { title: { fontFamily: 'Inter, sans-serif', fontWeight: 700 }, body: { fontFamily: 'Inter, sans-serif', fontWeight: 400 } },
    pt: { title: { fontFamily: 'Inter, sans-serif', fontWeight: 700 }, body: { fontFamily: 'Inter, sans-serif', fontWeight: 400 } },
  };
  return map[lang]?.[type] ?? map.en[type];
}

/**
 * 브라우저/시스템 locale을 LangCode로 매핑 (기본값용)
 */
export function localeToLangCode(locale: string): LangCode {
  const lower = locale.toLowerCase();
  if (lower.startsWith('ko')) return 'ko';
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hant')) return 'zh-TW';
  if (lower.startsWith('zh') || lower.startsWith('zh-cn') || lower.startsWith('zh-hans')) return 'zh-CN';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('it')) return 'it';
  if (lower.startsWith('pt')) return 'pt';
  return 'en';
}

/** Intl / toLocaleDateString용 BCP 47 태그 */
export function intlLocaleForLang(lang: LangCode): string {
  const map: Record<LangCode, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-BR',
  };
  return map[lang] ?? 'en-US';
}
