'use client';

import { GroupAdminPanel } from '@/app/components/group-admin/GroupAdminPanel';

export const dynamic = 'force-dynamic';

export default function GroupAdminPage() {
  return <GroupAdminPanel variant="standalone" />;
}
