'use client';

import Link from 'next/link';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { LEGAL_LAST_UPDATED, PRIVACY_BODY, PRIVACY_TITLE, pickLegalLocale } from '@/lib/legal-docs';

export default function PrivacyPage() {
  const { lang } = useLanguage();
  const locale = pickLegalLocale(lang);
  const title = PRIVACY_TITLE[locale];
  const body = PRIVACY_BODY[locale];
  const updatedLabel = locale === 'ko' ? '최종 업데이트' : 'Last updated';

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 font-inherit text-slate-800">
      <p className="mb-6">
        <Link href="/" className="text-sm text-purple-600 hover:underline">
          ← {locale === 'ko' ? '홈' : 'Home'}
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      <p className="mb-8 text-sm text-slate-500">
        {updatedLabel}: {LEGAL_LAST_UPDATED}
      </p>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{body}</div>
      <p className="mt-10 text-sm">
        <Link href="/legal/terms" className="text-purple-600 hover:underline">
          {locale === 'ko' ? '이용약관' : 'Terms of Service'}
        </Link>
      </p>
    </main>
  );
}
