'use client';

export const dynamic = 'force-dynamic';

import { GroupRequiredRouteGuard } from '@/app/components/GroupRequiredRouteGuard';
import { PiggyBankPanelContent } from '@/app/features/piggy-bank/components/PiggyBankPanelContent';

export default function PiggyBankPage() {
  return (
    <GroupRequiredRouteGuard>
      {/* onClose 없이 사용 → router.push('/dashboard?focus=piggy') 폴백 유지 */}
      <PiggyBankPanelContent />
    </GroupRequiredRouteGuard>
  );
}
