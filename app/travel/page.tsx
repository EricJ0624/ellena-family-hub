'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';

const TravelPlannerContent = nextDynamic(
  () => import('@/app/modules/travel-planner/TravelPlannerContent').then((m) => m.TravelPlannerContent),
  { ssr: false, loading: () => (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#64748b' }}>로딩 중...</span>
    </div>
  ) }
);

export default function TravelPlannerPage() {
  return <TravelPlannerContent />;
}
