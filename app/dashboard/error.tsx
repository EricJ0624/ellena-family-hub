'use client';

import { AppRouteError } from '@/app/components/AppRouteError';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({ error, reset }: Props) {
  return <AppRouteError error={error} reset={reset} />;
}
