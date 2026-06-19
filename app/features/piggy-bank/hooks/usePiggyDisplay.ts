'use client';

import { useMemo } from 'react';
import { formatMoneyAmount } from '@/lib/format-currency';
import { intlLocaleForLang, type LangCode } from '@/lib/language-fonts';
import type { PiggySummary } from '../types';

interface UsePiggyDisplayProps {
  piggySummary: PiggySummary | null;
  fallbackGroupCurrency?: string | null;
  lang: LangCode;
}

export function usePiggyDisplay({ piggySummary, fallbackGroupCurrency, lang }: UsePiggyDisplayProps) {
  const piggyLabel = useMemo(() => {
    const rawName = piggySummary?.name?.trim() || 'Ellena Piggy Bank';
    const base = rawName.replace(/piggy\s*bank/gi, '').trim();
    return base || rawName;
  }, [piggySummary?.name]);

  const piggyMoneyLocale = useMemo(() => intlLocaleForLang(lang), [lang]);

  const formatAmount = (amount: number, currencyCode?: string | null) => {
    const cur = (currencyCode || piggySummary?.currency || fallbackGroupCurrency || 'KRW').trim().toUpperCase() || 'KRW';
    return formatMoneyAmount(amount, cur, piggyMoneyLocale);
  };

  return { piggyLabel, formatAmount };
}
