'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { type LangCode, isValidLang } from '@/lib/language-fonts';
import { fetchProfilePreferences, saveProfilePreferences } from '@/lib/profile-preferences';

const STORAGE_KEY = 'app_preferred_language';

interface LanguageContextType {
  lang: LangCode;
  setLanguage: (lang: LangCode) => Promise<void>;
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
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  // SSR·첫 클라이언트 렌더는 동일하게 'en'으로 고정 (localStorage는 mount 후에만 읽어 hydration mismatch 방지)
  const [lang, setLangState] = useState<LangCode>('en');
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

    // 세션 조회 전에도 저장된 언어을 즉시 반영 (한 프레임만 en일 수 있음)
    const stored = getStoredLang();
    if (stored) applyLang(stored);

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void loadForUser(session?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadForUser(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setLanguage = useCallback(async (newLang: LangCode) => {
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
