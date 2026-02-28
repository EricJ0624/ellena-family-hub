/**
 * 앱 표시 언어 코드 (profiles.preferred_language 및 폰트 매핑용)
 */
export type LangCode = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW';

export const LANG_CODES: LangCode[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];

/**
 * 언어별 타이틀/본문 폰트 (CDN 로드된 폰트명)
 * - 한국어: 타이틀 Pretendard Bold, 본문 Pretendard Regular
 * - 영어: 타이틀 Inter Bold, 본문 Inter Regular
 * - 일본어: 타이틀 Pretendard JP Bold, 본문 Noto Sans JP Regular
 * - 중국어 간체: 타이틀 Noto Sans SC Bold, 본문 Noto Sans SC Regular
 * - 중국어 번체: 타이틀 Noto Sans TC Bold, 본문 Noto Sans TC Regular
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
  return 'en';
}
