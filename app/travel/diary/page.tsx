'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GroupRequiredRouteGuard } from '@/app/components/GroupRequiredRouteGuard';
import { TravelDiaryPageContent } from '@/app/features/travel-diary/TravelDiaryPageContent';

function TravelDiaryFromUrl() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get('tripId') ?? '';
  const openAdd = searchParams.get('openAdd') === '1' && !tripId;
  return <TravelDiaryPageContent tripId={tripId} openAdd={openAdd} />;
}

export default function TravelDiaryPage() {
  return (
    <GroupRequiredRouteGuard>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] p-6 text-slate-500">
            Loading…
          </div>
        }
      >
        <TravelDiaryFromUrl />
      </Suspense>
    </GroupRequiredRouteGuard>
  );
}
