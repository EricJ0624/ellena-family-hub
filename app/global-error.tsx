'use client';

import { useEffect } from 'react';
import {
  isLikelyChunkOrNetworkLoadError,
  tryAutoReloadForChunkError,
} from '@/lib/client-chunk-recovery';
import { getAppErrorCopy } from '@/lib/translations/app-error';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  const copy = getAppErrorCopy();
  const isNetworkLike = isLikelyChunkOrNetworkLoadError(error);

  useEffect(() => {
    console.error('[GlobalError]', error);
    tryAutoReloadForChunkError(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="m-0 bg-slate-50 font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">{copy.title}</h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-600">
              {isNetworkLike ? copy.networkHint : copy.genericHint}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                {copy.retry}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                {copy.reload}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
