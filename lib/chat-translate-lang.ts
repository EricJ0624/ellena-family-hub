/**
 * 채팅 번역 목표 언어 — 퀵(영·중·한·일) + 직접 선택 추가분
 * 추가는 localStorage에 사용자별 저장.
 */

import {
  isValidLang,
  LANG_OPTIONS,
  type LangCode,
} from '@/lib/language-fonts';

/** 고정 퀵 언어 (중국어=간체) */
export const CHAT_TRANSLATE_QUICK_LANGS: readonly LangCode[] = [
  'en',
  'zh-CN',
  'ko',
  'ja',
] as const;

function isQuickLang(code: string): boolean {
  return (CHAT_TRANSLATE_QUICK_LANGS as readonly string[]).includes(code);
}

const MAX_EXTRA = 3;

const extrasKey = (userId: string) => `sfh_chat_translate_extras_${userId}`;
const preferredKey = (userId: string) => `sfh_chat_translate_preferred_${userId}`;

export function readTranslateExtras(userId: string): LangCode[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(extrasKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: LangCode[] = [];
    for (const item of parsed) {
      if (isValidLang(item) && !isQuickLang(item) && !out.includes(item)) {
        out.push(item);
      }
      if (out.length >= MAX_EXTRA) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function addTranslateExtra(userId: string, code: LangCode): LangCode[] {
  if (!userId || !isValidLang(code)) return readTranslateExtras(userId);
  if (isQuickLang(code)) {
    return readTranslateExtras(userId);
  }
  const prev = readTranslateExtras(userId).filter((c) => c !== code);
  const next = [code, ...prev].slice(0, MAX_EXTRA);
  localStorage.setItem(extrasKey(userId), JSON.stringify(next));
  return next;
}

export function readPreferredTranslateLang(userId: string): LangCode | null {
  if (typeof window === 'undefined' || !userId) return null;
  const raw = localStorage.getItem(preferredKey(userId));
  return isValidLang(raw) ? raw : null;
}

export function writePreferredTranslateLang(userId: string, code: LangCode): void {
  if (typeof window === 'undefined' || !userId || !isValidLang(code)) return;
  localStorage.setItem(preferredKey(userId), code);
}

/**
 * 가벼운 원문 언어 추정 (AI 호출 없음).
 * 확신 없으면 null → 퀵 전체 표시.
 */
export function detectChatSourceLang(text: string): LangCode | null {
  const s = text.trim();
  if (!s) return null;

  let hangul = 0;
  let kana = 0;
  let han = 0;
  let latin = 0;

  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c == null) continue;
    if (c >= 0xac00 && c <= 0xd7a3) hangul += 1;
    else if (
      (c >= 0x3040 && c <= 0x309f) ||
      (c >= 0x30a0 && c <= 0x30ff) ||
      (c >= 0x31f0 && c <= 0x31ff)
    ) {
      kana += 1;
    } else if (c >= 0x4e00 && c <= 0x9fff) han += 1;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin += 1;
  }

  const script = hangul + kana + han + latin;
  if (script < 2) return null;

  if (hangul >= kana && hangul >= han && hangul >= latin * 0.5 && hangul >= 2) return 'ko';
  if (kana >= 2 && kana >= hangul) return 'ja';
  if (han >= 2 && han > hangul && han > kana && han >= latin) return 'zh-CN';
  if (latin >= 4 && latin > hangul && latin > kana && latin > han) return 'en';
  return null;
}

/** 선택 가능 코드 (퀵 + 추가분). 선호가 퀵이 아니면 extras에 합류. */
export function buildTranslateTargetOptions(userId: string): LangCode[] {
  const extras = readTranslateExtras(userId);
  const preferred = readPreferredTranslateLang(userId);
  const merged: LangCode[] = [];
  for (const code of [...CHAT_TRANSLATE_QUICK_LANGS, ...extras]) {
    if (!merged.includes(code)) merged.push(code);
  }
  if (preferred && !isQuickLang(preferred) && !merged.includes(preferred)) {
    merged.push(preferred);
  }
  return merged;
}

/** 기본 목표: 선호 → en → 목록 첫 항목 */
export function pickDefaultTranslateTarget(userId: string): LangCode | null {
  const options = buildTranslateTargetOptions(userId);
  if (options.length === 0) return null;
  const preferred = readPreferredTranslateLang(userId);
  if (preferred && options.includes(preferred)) return preferred;
  if (options.includes('en')) return 'en';
  return options[0] ?? null;
}

/** 직접 선택(타입 검색)용 — 이미 퀵/추가에 있는 코드 제외 */
export function buildTranslateMoreOptions(
  alreadyListed: readonly LangCode[] = [],
): LangCode[] {
  const listed = new Set<string>(alreadyListed);
  return LANG_OPTIONS.map((o) => o.code).filter((code) => !listed.has(code));
}
