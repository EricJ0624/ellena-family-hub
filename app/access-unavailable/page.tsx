'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAccountAccessErrorTranslation } from '@/lib/translations/accountAccessError';
import { supabase } from '@/lib/supabase';

export default function AccessUnavailablePage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (key: Parameters<typeof getAccountAccessErrorTranslation>[1]) =>
    getAccountAccessErrorTranslation(lang, key);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-slate-800">{t('title')}</h1>
        <p className="mb-6 text-sm text-slate-500">{t('intro')}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => router.replace('/onboarding')}
            className="cursor-pointer rounded-lg border-none bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t('retry')}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
          >
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
