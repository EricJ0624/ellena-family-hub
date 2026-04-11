/**
 * 금액을 통화 코드에 맞춰 표시 (Intl).
 */
export function formatMoneyAmount(amount: number, currency: string, locale: string): string {
  const cur = (currency || 'KRW').toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    try {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)} ${cur}`;
    } catch {
      return `${amount} ${cur}`;
    }
  }
}
