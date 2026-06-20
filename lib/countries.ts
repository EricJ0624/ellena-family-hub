/**
 * 거주 국가 선택 (ISO 3166-1 alpha-2).
 * 앱 UI 통화(getTopCurrencyCodes)를 법정/사실상 주요 통화로 쓰는 국가만 허용.
 */
import { getTopCurrencyCodes } from '@/lib/currencies';

export type CountryCode = string;

/** ISO 3166-1 alpha-2 → 해당 국가의 앱 기준 주요 통화(ISO 4217) */
const COUNTRY_PRIMARY_CURRENCY: Record<string, string> = {
  // USD
  US: 'USD',
  AS: 'USD',
  EC: 'USD',
  SV: 'USD',
  GU: 'USD',
  MH: 'USD',
  FM: 'USD',
  MP: 'USD',
  PW: 'USD',
  PA: 'USD',
  TL: 'USD',
  TC: 'USD',
  VG: 'USD',
  BQ: 'USD',
  IO: 'USD',

  // EUR (유로존·EUR 법정통화국·소국)
  AD: 'EUR',
  AT: 'EUR',
  BE: 'EUR',
  CY: 'EUR',
  DE: 'EUR',
  EE: 'EUR',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  GR: 'EUR',
  HR: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  LT: 'EUR',
  LU: 'EUR',
  LV: 'EUR',
  MT: 'EUR',
  NL: 'EUR',
  PT: 'EUR',
  SI: 'EUR',
  SK: 'EUR',
  MC: 'EUR',
  SM: 'EUR',
  VA: 'EUR',
  ME: 'EUR',
  XK: 'EUR',

  // JPY
  JP: 'JPY',

  // GBP
  GB: 'GBP',
  GG: 'GBP',
  JE: 'GBP',
  IM: 'GBP',

  // CNY
  CN: 'CNY',

  // KRW
  KR: 'KRW',

  // AUD
  AU: 'AUD',
  CX: 'AUD',
  CC: 'AUD',
  KI: 'AUD',
  NR: 'AUD',
  TV: 'AUD',

  // CAD
  CA: 'CAD',

  // CHF
  CH: 'CHF',
  LI: 'CHF',

  // HKD
  HK: 'HKD',

  // SGD
  SG: 'SGD',

  // INR
  IN: 'INR',

  // THB
  TH: 'THB',

  // TWD
  TW: 'TWD',

  // VND
  VN: 'VND',

  // MYR
  MY: 'MYR',

  // IDR
  ID: 'IDR',

  // PHP
  PH: 'PHP',

  // NZD
  NZ: 'NZD',
  CK: 'NZD',
  NU: 'NZD',
  PN: 'NZD',

  // SEK
  SE: 'SEK',

  // BRL
  BR: 'BRL',

  // MXN
  MX: 'MXN',

  // RUB
  RU: 'RUB',
};

let cachedAllowedCodes: readonly CountryCode[] | null = null;

export function normalizeCountryCode(raw: string | null | undefined): CountryCode | null {
  if (raw == null) return null;
  const t = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(t)) return null;
  return t;
}

/** 앱 UI 통화 목록 기준 허용 거주 국가 코드 (정렬됨) */
export function getAllowedCountryCodes(): readonly CountryCode[] {
  if (cachedAllowedCodes) return cachedAllowedCodes;
  const top = new Set(getTopCurrencyCodes());
  cachedAllowedCodes = Object.entries(COUNTRY_PRIMARY_CURRENCY)
    .filter(([, currency]) => top.has(currency))
    .map(([code]) => code)
    .sort((a, b) => a.localeCompare(b));
  return cachedAllowedCodes;
}

const allowedSet = () => new Set(getAllowedCountryCodes());

export function isValidCountryCode(code: string | null | undefined): code is CountryCode {
  const n = normalizeCountryCode(code);
  if (!n) return false;
  return allowedSet().has(n);
}

export function getPrimaryCurrencyForCountry(code: string): string | null {
  const n = normalizeCountryCode(code);
  if (!n) return null;
  return COUNTRY_PRIMARY_CURRENCY[n] ?? null;
}

const regionDisplayNamesByLocale = new Map<string, Intl.DisplayNames>();

function getRegionDisplayNames(locale: string): Intl.DisplayNames | null {
  if (regionDisplayNamesByLocale.has(locale)) {
    return regionDisplayNamesByLocale.get(locale)!;
  }
  try {
    const dn = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
    regionDisplayNamesByLocale.set(locale, dn);
    return dn;
  } catch {
    return null;
  }
}

export function getCountryDisplayName(code: string, locale: string): string {
  const n = normalizeCountryCode(code) || code;
  const dn = getRegionDisplayNames(locale) ?? getRegionDisplayNames('en');
  if (!dn) return n;
  try {
    const label = dn.of(n);
    return label && label !== n ? label : n;
  } catch {
    return n;
  }
}

export type CountryOption = { code: CountryCode; label: string };

/** 셀렉트용: 현재 UI locale로 정렬된 국가 목록 */
export function getCountryOptions(locale: string): CountryOption[] {
  return getAllowedCountryCodes().map((code) => ({
    code,
    label: getCountryDisplayName(code, locale),
  }));
}

/** 셀렉트 옵션용: `KR (대한민국)` 형태 */
export function formatCountryOptionLabel(code: string, locale: string): string {
  const n = normalizeCountryCode(code) || String(code).trim().toUpperCase();
  const name = getCountryDisplayName(n, locale);
  if (!name || name === n) return n;
  return `${n} (${name})`;
}
