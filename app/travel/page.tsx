'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
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

export default function TravelPlannerPage() {
  return (
    <GroupRequiredRouteGuard>
      <TravelPlannerContent />
    </GroupRequiredRouteGuard>
  );
}
