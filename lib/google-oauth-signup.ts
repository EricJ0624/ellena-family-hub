import type { LangCode } from '@/lib/language-fonts';
import { isValidLang } from '@/lib/language-fonts';
import { isValidCountryCode } from '@/lib/countries';

/** 가입 탭에서 Google OAuth 직전에만 저장. 콜백에서 소비 후 삭제. */
export const PENDING_GOOGLE_SIGNUP_META_KEY = 'SFH_PENDING_GOOGLE_SIGNUP_META';

export type PendingGoogleSignupMeta = {
  nickname: string;
  language: LangCode;
  country_code: string;
};

export function setPendingGoogleSignupMeta(meta: PendingGoogleSignupMeta): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_GOOGLE_SIGNUP_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPendingGoogleSignupMeta(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_GOOGLE_SIGNUP_META_KEY);
  } catch {
    /* ignore */
  }
}

export function takePendingGoogleSignupMeta(): PendingGoogleSignupMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_GOOGLE_SIGNUP_META_KEY);
    window.sessionStorage.removeItem(PENDING_GOOGLE_SIGNUP_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingGoogleSignupMeta>;
    const nickname = String(parsed.nickname ?? '').trim();
    const language = parsed.language;
    const countryCode = String(parsed.country_code ?? '')
      .trim()
      .toUpperCase();
    if (
      !nickname ||
      nickname.length < 2 ||
      nickname.length > 20 ||
      !isValidLang(language) ||
      !isValidCountryCode(countryCode)
    ) {
      return null;
    }
    return {
      nickname,
      language,
      country_code: countryCode,
    };
  } catch {
    clearPendingGoogleSignupMeta();
    return null;
  }
}
