import { getPrimaryCurrencyForCountry } from '@/lib/countries';
import { getTopCurrencyCodes, isAllowedCurrency, normalizeCurrencyCode } from '@/lib/currencies';

/** 앱 통화 목록에 있는 국가만 통화 코드를 돌려준다. 모르면 null. */
export function currencyForCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = normalizeCurrencyCode(getPrimaryCurrencyForCountry(code));
  if (!normalized || !isAllowedCurrency(normalized)) return null;
  if (!getTopCurrencyCodes().includes(normalized)) return null;
  return normalized;
}
