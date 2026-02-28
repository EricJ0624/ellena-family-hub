'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getCommonTranslation } from '@/lib/translations/common';

function TravelLoading() {
  const { lang } = useLanguage();
  const loadingText = getCommonTranslation(lang, 'loading');
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#64748b' }}>{loadingText}</span>
    </div>
  );
}

const TravelPlannerContent = nextDynamic(
  () => import('@/app/modules/travel-planner/TravelPlannerContent').then((m) => m.TravelPlannerContent),
  { ssr: false, loading: () => <TravelLoading /> }
);

export default function TravelPlannerPage() {
  return <TravelPlannerContent />;
}
