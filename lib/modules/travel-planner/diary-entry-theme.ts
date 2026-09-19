/**
 * Travel diary entry card surface styles by UI theme.
 * Keep Family / High-end / default class strings in one place (no copy-paste drift).
 */

export const DIARY_CARD_FAMILY =
  'border border-[#cfc8bf] bg-gradient-to-br from-[#e8e4de] via-[#e3ded7] to-[#d9d3cb] shadow-[0_16px_40px_rgba(28,25,23,0.22)]';

export const DIARY_CARD_NIGHT =
  'border border-white/12 bg-slate-950/35 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl';

export const DIARY_CARD_DEFAULT = 'border border-slate-200/90 bg-white/95 text-slate-800 shadow-sm';

export const DIARY_TITLE_FAMILY = 'text-[#1c1917]';
export const DIARY_TITLE_NIGHT = 'text-white';
export const DIARY_TITLE_DEFAULT = 'text-slate-800';

export const DIARY_DATE_FAMILY = 'text-[#57534e]';
export const DIARY_DATE_NIGHT = 'text-sky-300/90';
export const DIARY_DATE_DEFAULT = 'text-sky-700/80';

export const DIARY_BODY_FAMILY = 'text-[#57534e]';
export const DIARY_BODY_NIGHT = 'text-slate-200/95';
export const DIARY_BODY_DEFAULT = 'text-slate-700';

export function diaryCardShellClass(opts: {
  isFamilyTheme: boolean;
  isNightShell: boolean;
}): string {
  if (opts.isNightShell) return DIARY_CARD_NIGHT;
  if (opts.isFamilyTheme) return `${DIARY_CARD_FAMILY} text-[#1c1917]`;
  return DIARY_CARD_DEFAULT;
}

export function diaryTitleClass(opts: {
  isFamilyTheme: boolean;
  isNightShell: boolean;
}): string {
  if (opts.isNightShell) return DIARY_TITLE_NIGHT;
  if (opts.isFamilyTheme) return DIARY_TITLE_FAMILY;
  return DIARY_TITLE_DEFAULT;
}

export function diaryDateClass(opts: {
  isFamilyTheme: boolean;
  isNightShell: boolean;
}): string {
  if (opts.isNightShell) return DIARY_DATE_NIGHT;
  if (opts.isFamilyTheme) return DIARY_DATE_FAMILY;
  return DIARY_DATE_DEFAULT;
}

export function diaryBodyClass(opts: {
  isFamilyTheme: boolean;
  isNightShell: boolean;
}): string {
  if (opts.isNightShell) return DIARY_BODY_NIGHT;
  if (opts.isFamilyTheme) return DIARY_BODY_FAMILY;
  return DIARY_BODY_DEFAULT;
}
