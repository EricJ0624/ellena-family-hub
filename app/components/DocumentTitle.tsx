'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getCommonTranslation } from '@/lib/translations/common';

/**
 * 선택한 언어에 따라 document.title(탭 제목)을 설정합니다.
 * LanguageProvider 내부에서만 렌더되어야 합니다.
 */
export function DocumentTitle() {
  const { lang } = useLanguage();
  const title = getCommonTranslation(lang, 'app_title');

  useEffect(() => {
    if (typeof document !== 'undefined' && title) {
      document.title = title;
    }
  }, [title]);

  return null;
}
