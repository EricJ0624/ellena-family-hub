'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getBillingTranslation } from '@/lib/translations/billing';
import { CURRENT_APP_ID } from '@/lib/apps';
import { supabase } from '@/lib/supabase';
import { isGroupRequiredPath } from '@/lib/route-guard-config';

export function BillingAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLanguage();
  const { currentGroupId } = useGroup();
  const needsCheck = isGroupRequiredPath(pathname || '/');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!needsCheck) {
      setBlocked(false);
      return;
    }
    if (!currentGroupId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;
        const res = await fetch(
          `/api/billing/access?groupId=${encodeURIComponent(currentGroupId)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          betaPeriodEnabled?: boolean;
          hasActiveSubscription?: boolean;
          isSystemAdmin?: boolean;
          billingComp?: boolean;
        };
        if (json.betaPeriodEnabled !== false || json.isSystemAdmin || json.hasActiveSubscription || json.billingComp) return;
        if (cancelled) return;
        setBlocked(true);
        router.replace(`/billing?groupId=${encodeURIComponent(currentGroupId)}&reason=subscription-required`);
      } catch {
        // 확인에 실패하면 베타 기본값과 같이 화면을 열어둡니다.
      }
    };
    void check();
    const planChannel = supabase
      .channel(`billing-access-plan:${currentGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billing_plans', filter: `app_id=eq.${CURRENT_APP_ID}` },
        () => { void check(); },
      )
      .subscribe();
    const grantChannel = supabase
      .channel(`billing-access-grant:${currentGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billing_group_overrides', filter: `group_id=eq.${currentGroupId}` },
        () => { void check(); },
      )
      .subscribe();
    const subscriptionChannel = supabase
      .channel(`billing-access-sub:${currentGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billing_subscriptions', filter: `group_id=eq.${currentGroupId}` },
        () => { void check(); },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(planChannel);
      void supabase.removeChannel(grantChannel);
      void supabase.removeChannel(subscriptionChannel);
    };
  }, [needsCheck, currentGroupId, pathname, router]);

  if (blocked) {
    return <main className="px-4 py-8 text-sm text-slate-600">{getBillingTranslation(lang, 'moving_to_billing')}</main>;
  }

  return children;
}
