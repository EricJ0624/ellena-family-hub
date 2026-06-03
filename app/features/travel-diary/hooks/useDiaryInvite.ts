'use client';

import { useCallback, useMemo, useState } from 'react';
import type { TravelTrip } from '@/app/features/travel-planner/types';
import { shouldOfferDiaryCompletionPrompt } from '@/lib/modules/travel-planner/diary-eligibility';
import { dispatchWidgetConfigsUpdated } from '@/lib/widgets/widget-config-events';

async function authHeaders(): Promise<HeadersInit> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('AUTH');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function useDiaryInvite(trips: TravelTrip[], currentGroupId: string | null) {
  const [dismissedTripIds, setDismissedTripIds] = useState<Set<string>>(() => new Set());
  const [acting, setActing] = useState(false);

  const pendingTrip = useMemo(() => {
    return (
      trips.find(
        (t) => shouldOfferDiaryCompletionPrompt(t) && !dismissedTripIds.has(t.id),
      ) ?? null
    );
  }, [trips, dismissedTripIds]);

  const acceptInvite = useCallback(async () => {
    if (!currentGroupId || !pendingTrip) return;
    setActing(true);
    try {
      const headers = await authHeaders();
      await fetch('/api/v1/travel/widgets/enable-travel-diary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupId: currentGroupId }),
      });
      const res = await fetch(`/api/v1/travel/trips/${pendingTrip.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          diary_enabled: true,
          diary_invite_status: 'accepted',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'FAILED');
      dispatchWidgetConfigsUpdated();
      setDismissedTripIds((prev) => new Set(prev).add(pendingTrip.id));
      return json.data as TravelTrip;
    } finally {
      setActing(false);
    }
  }, [currentGroupId, pendingTrip]);

  const dismissInvite = useCallback(async () => {
    if (!currentGroupId || !pendingTrip) return;
    setActing(true);
    try {
      const headers = await authHeaders();
      await fetch(`/api/v1/travel/trips/${pendingTrip.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          diary_invite_status: 'dismissed',
        }),
      });
      setDismissedTripIds((prev) => new Set(prev).add(pendingTrip.id));
    } finally {
      setActing(false);
    }
  }, [currentGroupId, pendingTrip]);

  return {
    pendingTrip,
    acting,
    acceptInvite,
    dismissInvite,
    showModal: Boolean(pendingTrip),
  };
}
