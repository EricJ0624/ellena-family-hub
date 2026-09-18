'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useGroup } from '@/app/contexts/GroupContext';
import LeaveGroupSection from '@/app/components/LeaveGroupSection';
import AccountDeleteSection from '@/app/components/AccountDeleteSection';
import { getAccountTranslation } from '@/lib/translations/account';

export default function AccountPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const { currentGroupId, groups, loading } = useGroup();
  const at = (key: Parameters<typeof getAccountTranslation>[1]) => getAccountTranslation(lang, key);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/');
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        …
      </div>
    );
  }

  const backHref =
    currentGroupId || (!loading && groups.length > 0) ? '/dashboard' : '/onboarding';
  const backLabel = backHref === '/dashboard' ? at('back_dashboard') : at('back_onboarding');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href={backHref}
          className="inline-flex text-sm font-medium text-slate-600 no-underline hover:text-slate-900"
        >
          ← {backLabel}
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">{at('page_title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{at('page_subtitle')}</p>
        <div className="mt-8 space-y-6">
          <LeaveGroupSection />
          <AccountDeleteSection />
        </div>
      </div>
    </div>
  );
}
