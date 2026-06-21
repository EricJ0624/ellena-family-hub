'use client';

import { useEffect, useMemo } from 'react';
import {
  isLikelyChunkOrNetworkLoadError,
  tryAutoReloadForChunkError,
} from '@/lib/client-chunk-recovery';
import { getAppErrorCopy } from '@/lib/translations/app-error';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function AppRouteError({ error, reset }: Props) {
  const copy = useMemo(() => getAppErrorCopy(), []);
  const isNetworkLike = isLikelyChunkOrNetworkLoadError(error);

  useEffect(() => {
    console.error('[AppRouteError]', error);
    tryAutoReloadForChunkError(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">{copy.title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          {isNetworkLike ? copy.networkHint : copy.genericHint}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
          >
            {copy.retry}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
          >
            {copy.reload}
          </button>
        </div>
      </div>
    </div>
  );
}
