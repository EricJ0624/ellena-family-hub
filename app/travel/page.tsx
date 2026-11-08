'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { GroupRequiredRouteGuard } from '@/app/components/GroupRequiredRouteGuard';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getCommonTranslation } from '@/lib/translations/common';

function TravelLoading() {
  const { lang } = useLanguage();
  const loadingText = getCommonTranslation(lang, 'loading');
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <span className="text-[#64748b]">{loadingText}</span>
    </div>
  );
}

const TravelPlannerContent = nextDynamic(
  () => import('@/app/modules/travel-planner/TravelPlannerContent').then((m) => m.TravelPlannerContent),
  { ssr: false, loading: () => <TravelLoading /> }
);

function TravelPlannerFromUrl() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get('tripId') ?? '';
  const openAdd = searchParams.get('openAdd') === '1';
  return <TravelPlannerContent tripId={tripId} openAdd={openAdd} />;
}

export default function TravelPlannerPage() {
  return (
    <GroupRequiredRouteGuard>
      <Suspense fallback={<TravelLoading />}>
        <TravelPlannerFromUrl />
      </Suspense>
    </GroupRequiredRouteGuard>
  );
}
