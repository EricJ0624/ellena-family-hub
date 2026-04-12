'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { type LangCode } from '@/lib/language-fonts';

const STORAGE_KEY = 'app_preferred_language';

/** `updateCurrentGroup`: false 이면 앱/UI·localStorage만 바꾸고 현재 그룹 `preferred_language`는 건드리지 않음 (온보딩·새 그룹 생성 모달 등) */
export type SetLanguageOptions = {
  updateCurrentGroup?: boolean;
};

interface LanguageContextType {
  lang: LangCode;
  setLanguage: (lang: LangCode, options?: SetLanguageOptions) => Promise<void>;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getStoredLang(): LangCode | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'ko' || raw === 'en' || raw === 'ja' || raw === 'zh-CN' || raw === 'zh-TW') return raw;
  return null;
}

function setStoredLang(lang: LangCode) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
}

const VALID_LANGS: LangCode[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
function isValidLang(v: unknown): v is LangCode {
  return typeof v === 'string' && VALID_LANGS.includes(v as LangCode);
}

interface LanguageProviderProps {
  children: React.ReactNode;
  currentGroup: { preferred_language?: string | null } | null;
  currentGroupId: string | null;
  isGroupAdmin: boolean;
  refreshGroups: () => Promise<void>;
}

export function LanguageProvider({ children, currentGroup, currentGroupId, isGroupAdmin, refreshGroups }: LanguageProviderProps) {
  const groupLang = currentGroup?.preferred_language;
  const langFromGroup = isValidLang(groupLang) ? groupLang : null;

  const [lang, setLangState] = useState<LangCode>(() => {
    if (langFromGroup) return langFromGroup;
    const stored = getStoredLang();
    if (stored) return stored;
    // 사용자가 저장한 언어·그룹 설정이 없을 때는 브라우저 locale 대신 영어를 기본으로 둠
    return 'en';
  });

  const loading = false;

  useEffect(() => {
    if (langFromGroup) {
      setLangState(langFromGroup);
      setStoredLang(langFromGroup);
      return;
    }
    const stored = getStoredLang();
    if (stored) {
      setLangState(stored);
      return;
    }
    setLangState('en');
  }, [langFromGroup]);

  const setLanguage = useCallback(async (newLang: LangCode, options?: SetLanguageOptions) => {
    const syncGroup = options?.updateCurrentGroup !== false;
    setLangState(newLang);
    setStoredLang(newLang);
    if (syncGroup && currentGroupId && isGroupAdmin) {
      try {
        await supabase.from('groups').update({ preferred_language: newLang }).eq('id', currentGroupId);
        await refreshGroups();
      } catch (e) {
        console.warn('Failed to save group preferred_language:', e);
      }
    }
  }, [currentGroupId, isGroupAdmin, refreshGroups]);

  const value = useMemo(() => ({ lang, setLanguage, loading }), [lang, setLanguage, loading]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (ctx === undefined) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
