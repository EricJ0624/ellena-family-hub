import type { LangCode } from '@/lib/language-fonts';

/**
 * 다국어 객체에서 표시할 문자열 선택: 요청 언어 → 영어 → 첫 번째 값
 */
export function resolveI18nText(
  i18n: Record<string, string> | null | undefined,
  legacy: string | null | undefined,
  lang: LangCode
): string {
  if (i18n && typeof i18n === 'object') {
    const o = i18n as Record<string, string>;
    if (o[lang]?.trim()) return o[lang].trim();
    if (o.en?.trim()) return o.en.trim();
    const first = Object.values(o).find((v) => typeof v === 'string' && v.trim());
    if (first) return first.trim();
  }
  return (legacy ?? '').trim() || '';
}

/**
 * 공지 한 건에 대해 현재 언어로 제목/내용 반환
 */
export function getAnnouncementTexts(
  announcement: {
    title_i18n?: Record<string, string> | null;
    content_i18n?: Record<string, string> | null;
    title?: string | null;
    content?: string | null;
  },
  lang: LangCode
): { title: string; content: string } {
  return {
    title: resolveI18nText(announcement.title_i18n, announcement.title, lang),
    content: resolveI18nText(announcement.content_i18n, announcement.content, lang),
  };
}
