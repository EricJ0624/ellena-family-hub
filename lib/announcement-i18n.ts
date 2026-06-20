import type { LangCode } from '@/lib/language-fonts';

/**
 * 공지 다국어 표시 규칙:
 * - ko 사용자: ko → en (ko는 ko 사용자에게만)
 * - 그 외: 본인 언어 → en (ko로 폴백하지 않음)
 * - 표시할 문자열 없으면 빈 문자열
 */
export function resolveAnnouncementText(
  i18n: Record<string, string> | null | undefined,
  legacy: string | null | undefined,
  lang: LangCode,
): string {
  if (i18n && typeof i18n === 'object') {
    const o = i18n as Record<string, string>;
    if (lang === 'ko') {
      if (o.ko?.trim()) return o.ko.trim();
      if (o.en?.trim()) return o.en.trim();
      return '';
    }
    if (o[lang]?.trim()) return o[lang].trim();
    if (o.en?.trim()) return o.en.trim();
    return '';
  }
  const leg = (legacy ?? '').trim();
  if (!leg) return '';
  if (lang === 'ko') return leg;
  return '';
}

/** @deprecated 공지 외 용도 없음 — resolveAnnouncementText 사용 */
export function resolveI18nText(
  i18n: Record<string, string> | null | undefined,
  legacy: string | null | undefined,
  lang: LangCode,
): string {
  return resolveAnnouncementText(i18n, legacy, lang);
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
  lang: LangCode,
): { title: string; content: string } {
  return {
    title: resolveAnnouncementText(announcement.title_i18n, announcement.title, lang),
    content: resolveAnnouncementText(announcement.content_i18n, announcement.content, lang),
  };
}

/** 사용자 언어 기준 공지 배너 표시 여부 */
export function isAnnouncementVisibleForLang(
  announcement: Parameters<typeof getAnnouncementTexts>[0],
  lang: LangCode,
): boolean {
  const { title, content } = getAnnouncementTexts(announcement, lang);
  return !!(title.trim() || content.trim());
}
