/**
 * 앱에서 허용하는 ISO 4217 통화 코드 (검증·셀렉트용).
 * 런타임에 Intl.supportedValuesOf('currency')가 있으면 사용하고, 없으면 정적 목록으로 대체.
 */

const FALLBACK_CODES: readonly string[] = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD',
  'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK',
  'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR',
  'FJD', 'FKP',
  'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD',
  'HKD', 'HNL', 'HRK', 'HTG', 'HUF',
  'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK',
  'JMD', 'JOD', 'JPY',
  'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT',
  'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN',
  'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR',
  'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
  'QAR',
  'RON', 'RSD', 'RUB', 'RWF',
  'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL',
  'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS',
  'UAH', 'UGX', 'USD', 'UYU', 'UZS',
  'VES', 'VND', 'VUV',
  'WST',
  'XAF', 'XCD', 'XOF', 'XPF',
  'YER',
  'ZAR', 'ZMW', 'ZWL',
];

let cachedCodes: readonly string[] | null = null;
const TOP_CURRENCY_CODES: readonly string[] = [
  'USD', 'EUR', 'JPY', 'GBP', 'CNY',
  'KRW', 'AUD', 'CAD', 'CHF', 'HKD',
  'SGD', 'INR', 'THB', 'TWD', 'VND',
  'MYR', 'IDR', 'PHP', 'NZD', 'SEK',
];

function collectSupported(): readonly string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof fn === 'function') {
      const list = fn.call(Intl, 'currency');
      if (Array.isArray(list) && list.length > 0) {
        return [...new Set(list.map((c) => String(c).toUpperCase()).filter(Boolean))].sort();
      }
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_CODES;
}

export function getAllowedCurrencyCodes(): readonly string[] {
  if (!cachedCodes) {
    cachedCodes = collectSupported();
  }
  return cachedCodes;
}

export function getTopCurrencyCodes(): readonly string[] {
  return TOP_CURRENCY_CODES;
}

export function normalizeCurrencyCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(t)) return null;
  return t;
}

export function isAllowedCurrency(code: string | null | undefined): boolean {
  const n = normalizeCurrencyCode(code);
  if (!n) return false;
  return getAllowedCurrencyCodes().includes(n);
}

const currencyDisplayNamesByLocale = new Map<string, Intl.DisplayNames>();

function getCurrencyDisplayNamesForLocale(locale: string): Intl.DisplayNames | null {
  if (currencyDisplayNamesByLocale.has(locale)) {
    return currencyDisplayNamesByLocale.get(locale)!;
  }
  try {
    const dn = new Intl.DisplayNames([locale, 'en'], { type: 'currency' });
    currencyDisplayNamesByLocale.set(locale, dn);
    return dn;
  } catch {
    return null;
  }
}

/**
 * ISO 4217 코드에 대한 현지화된 통화 이름 (예: ko-KR → "대한민국 원", en-US → "US Dollar").
 * 국가 단위가 아니라 통화 단위 표기(CLDR 기준).
 */
export function getCurrencyDisplayName(code: string, locale: string): string {
  const n = normalizeCurrencyCode(code);
  if (!n) return String(code).trim().toUpperCase() || code;
  const dn = getCurrencyDisplayNamesForLocale(locale) ?? getCurrencyDisplayNamesForLocale('en');
  if (!dn) return n;
  try {
    const label = dn.of(n);
    return label && label !== n ? label : n;
  } catch {
    return n;
  }
}

/** 셀렉트 옵션용: `USD (미국 달러)` 형태 */
export function formatCurrencyOptionLabel(code: string, locale: string): string {
  const n = normalizeCurrencyCode(code) || String(code).trim().toUpperCase();
  const name = getCurrencyDisplayName(n, locale);
  if (!name || name === n) return n;
  return `${n} (${name})`;
}
