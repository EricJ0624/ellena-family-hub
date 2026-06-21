'use client';

export const dynamic = 'force-dynamic';

import { GroupRequiredRouteGuard } from '@/app/components/GroupRequiredRouteGuard';
import { TravelImportWizard } from '@/app/features/travel-planner/components/TravelImportWizard';

export default function TravelImportPage() {
  return (
    <GroupRequiredRouteGuard>
      <TravelImportWizard />
    </GroupRequiredRouteGuard>
  );
}
