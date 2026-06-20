'use client';

import { Suspense } from 'react';
import { GroupRequiredRouteGuard } from '@/app/components/GroupRequiredRouteGuard';
import { TravelDiaryPageContent } from '@/app/features/travel-diary/TravelDiaryPageContent';

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
        <TravelDiaryPageContent />
      </Suspense>
    </GroupRequiredRouteGuard>
  );
}
