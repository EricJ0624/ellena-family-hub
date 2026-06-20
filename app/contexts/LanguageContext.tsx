'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { type LangCode, isValidLang } from '@/lib/language-fonts';
import { fetchProfilePreferences, saveProfilePreferences } from '@/lib/profile-preferences';

const STORAGE_KEY = 'app_preferred_language';

/** @deprecated 그룹 DB 동기화 제거됨. 하위 호환용으로만 유지 */
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
  if (isValidLang(raw)) return raw;
  return null;
}

function setStoredLang(lang: LangCode) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
}

interface LanguageProviderProps {
  children: React.ReactNode;
  /** @deprecated 프로필 기반 언어로 전환 — 하위 호환용 */
  currentGroup?: { preferred_language?: string | null } | null;
  currentGroupId?: string | null;
  isGroupAdmin?: boolean;
  refreshGroups?: () => Promise<void>;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [lang, setLangState] = useState<LangCode>(() => getStoredLang() ?? 'en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const applyLang = (next: LangCode) => {
      setLangState(next);
      setStoredLang(next);
    };

    const loadForUser = async (userId: string | undefined) => {
      if (!userId) {
        applyLang(getStoredLang() ?? 'en');
        setLoading(false);
        return;
      }
      try {
        const prefs = await fetchProfilePreferences(userId);
        if (prefs?.preferred_language) {
          applyLang(prefs.preferred_language);
        } else {
          applyLang(getStoredLang() ?? 'en');
        }
      } catch (e) {
        console.warn('Failed to load profile preferred_language:', e);
        applyLang(getStoredLang() ?? 'en');
      } finally {
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void loadForUser(session?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadForUser(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setLanguage = useCallback(async (newLang: LangCode, _options?: SetLanguageOptions) => {
    setLangState(newLang);
    setStoredLang(newLang);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await saveProfilePreferences(user.id, { preferred_language: newLang });
      }
    } catch (e) {
      console.warn('Failed to save profile preferred_language:', e);
    }
  }, []);

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
