import { supabase } from '@/lib/supabase';
import { isValidCountryCode, normalizeCountryCode } from '@/lib/countries';
import { isValidLang, type LangCode } from '@/lib/language-fonts';

export type ProfilePreferences = {
  preferred_language?: LangCode;
  country_code?: string;
};

export async function fetchProfilePreferences(userId: string): Promise<ProfilePreferences | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('preferred_language, country_code')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    preferred_language: isValidLang(data.preferred_language) ? data.preferred_language : undefined,
    country_code: normalizeCountryCode(data.country_code) ?? undefined,
  };
}

export async function saveProfilePreferences(
  userId: string,
  prefs: ProfilePreferences,
): Promise<void> {
  const updates: Record<string, string> = {};

  if (prefs.preferred_language != null) {
    if (!isValidLang(prefs.preferred_language)) {
      throw new Error('Invalid language');
    }
    updates.preferred_language = prefs.preferred_language;
  }

  if (prefs.country_code != null) {
    const cc = normalizeCountryCode(prefs.country_code);
    if (!cc || !isValidCountryCode(cc)) {
      throw new Error('Invalid country');
    }
    updates.country_code = cc;
  }

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}
