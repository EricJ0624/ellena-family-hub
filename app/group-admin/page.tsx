'use client';

import { GroupAdminPanel } from '@/app/components/group-admin/GroupAdminPanel';
import { GroupRequiredRouteGuard } from '@/app/components/GroupRequiredRouteGuard';

export const dynamic = 'force-dynamic';

export default function GroupAdminPage() {
  return (
    <GroupRequiredRouteGuard>
      <GroupAdminPanel variant="standalone" />
    </GroupRequiredRouteGuard>
  );
}
