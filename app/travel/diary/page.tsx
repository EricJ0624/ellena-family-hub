import { Suspense } from 'react';
import { TravelDiaryPageContent } from '@/app/features/travel-diary/TravelDiaryPageContent';

export default function TravelDiaryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] p-6 text-slate-500">
          Loading…
        </div>
      }
    >
      <TravelDiaryPageContent />
    </Suspense>
  );
}
