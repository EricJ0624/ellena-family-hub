/**
 * 채팅 실시간 자동번역 — 로컬 설정·일일 동의·UI 언어별 원문 언어명
 * (수신 측 표시만, DB/전송 경로 비변경)
 */

import { isValidLang, type LangCode } from '@/lib/language-fonts';

const enabledKey = (userId: string) => `sfh_chat_auto_tl_on_${userId}`;
const consentKey = (userId: string) => `sfh_chat_auto_tl_consent_${userId}`;

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function readAutoTranslateEnabled(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  return localStorage.getItem(enabledKey(userId)) === '1';
}

export function writeAutoTranslateEnabled(userId: string, on: boolean): void {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.setItem(enabledKey(userId), on ? '1' : '0');
}

export function hasAutoTranslateConsentToday(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  return localStorage.getItem(consentKey(userId)) === todayLocalYmd();
}

export function markAutoTranslateConsentToday(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.setItem(consentKey(userId), todayLocalYmd());
}

/** UI 언어 → 원문 언어 코드의 표기 (사용자 앱 언어로) */
const LANG_NAME_BY_UI: Record<LangCode, Record<LangCode, string>> = {
  ko: {
    ko: '한국어',
    en: '영어',
    ja: '일본어',
    'zh-CN': '중국어(간체)',
    'zh-TW': '중국어(번체)',
    es: '스페인어',
    fr: '프랑스어',
    de: '독일어',
    it: '이탈리아어',
    pt: '포르투갈어',
  },
  en: {
    ko: 'Korean',
    en: 'English',
    ja: 'Japanese',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
  },
  ja: {
    ko: '韓国語',
    en: '英語',
    ja: '日本語',
    'zh-CN': '中国語（簡体）',
    'zh-TW': '中国語（繁体）',
    es: 'スペイン語',
    fr: 'フランス語',
    de: 'ドイツ語',
    it: 'イタリア語',
    pt: 'ポルトガル語',
  },
  'zh-CN': {
    ko: '韩语',
    en: '英语',
    ja: '日语',
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    es: '西班牙语',
    fr: '法语',
    de: '德语',
    it: '意大利语',
    pt: '葡萄牙语',
  },
  'zh-TW': {
    ko: '韓語',
    en: '英語',
    ja: '日語',
    'zh-CN': '簡體中文',
    'zh-TW': '繁體中文',
    es: '西班牙語',
    fr: '法語',
    de: '德語',
    it: '義大利語',
    pt: '葡萄牙語',
  },
  es: {
    ko: 'coreano',
    en: 'inglés',
    ja: 'japonés',
    'zh-CN': 'chino (simplificado)',
    'zh-TW': 'chino (tradicional)',
    es: 'español',
    fr: 'francés',
    de: 'alemán',
    it: 'italiano',
    pt: 'portugués',
  },
  fr: {
    ko: 'coréen',
    en: 'anglais',
    ja: 'japonais',
    'zh-CN': 'chinois (simplifié)',
    'zh-TW': 'chinois (traditionnel)',
    es: 'espagnol',
    fr: 'français',
    de: 'allemand',
    it: 'italien',
    pt: 'portugais',
  },
  de: {
    ko: 'Koreanisch',
    en: 'Englisch',
    ja: 'Japanisch',
    'zh-CN': 'Chinesisch (vereinfacht)',
    'zh-TW': 'Chinesisch (traditionell)',
    es: 'Spanisch',
    fr: 'Französisch',
    de: 'Deutsch',
    it: 'Italienisch',
    pt: 'Portugiesisch',
  },
  it: {
    ko: 'coreano',
    en: 'inglese',
    ja: 'giapponese',
    'zh-CN': 'cinese (semplificato)',
    'zh-TW': 'cinese (tradizionale)',
    es: 'spagnolo',
    fr: 'francese',
    de: 'tedesco',
    it: 'italiano',
    pt: 'portoghese',
  },
  pt: {
    ko: 'coreano',
    en: 'inglês',
    ja: 'japonês',
    'zh-CN': 'chinês (simplificado)',
    'zh-TW': 'chinês (tradicional)',
    es: 'espanhol',
    fr: 'francês',
    de: 'alemão',
    it: 'italiano',
    pt: 'português',
  },
};

export function localizedSourceLangName(uiLang: LangCode | string, source: LangCode): string {
  const ui = isValidLang(uiLang) ? uiLang : 'en';
  return LANG_NAME_BY_UI[ui]?.[source] ?? LANG_NAME_BY_UI.en[source] ?? source;
}
