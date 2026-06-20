'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useGroup } from '@/app/contexts/GroupContext';
import { runGroupRequiredRouteGuard } from '@/lib/route-guard-group-required';

type GuardStatus = 'loading' | 'allowed';

export function GroupRequiredRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { setCurrentGroupId } = useGroup();
  const [status, setStatus] = useState<GuardStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await runGroupRequiredRouteGuard({ setCurrentGroupId });
      if (cancelled) return;

      if (!result.ok) {
        router.replace(result.redirectTo);
        return;
      }

      setStatus('allowed');
    })();

    return () => {
      cancelled = true;
    };
  }, [router, setCurrentGroupId]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f5f7fa]">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-[#e2e8f0] border-t-[#9333ea]"
          aria-hidden
        />
      </div>
    );
  }

  return <>{children}</>;
}
