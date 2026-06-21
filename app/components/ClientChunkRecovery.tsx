'use client';

import { useEffect } from 'react';
import {
  clearChunkAutoReloadFlag,
  tryAutoReloadForChunkError,
} from '@/lib/client-chunk-recovery';

/**
 * 전역: 청크/동적 import 로드 실패 시 1회 자동 새로고침.
 * 정상 로드 후 session 플래그를 지워 다음 오류에도 1회 재시도 가능하게 함.
 */
export function ClientChunkRecovery() {
  useEffect(() => {
    clearChunkAutoReloadFlag();

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      tryAutoReloadForChunkError(event.reason);
    };

    const onWindowError = (event: ErrorEvent) => {
      tryAutoReloadForChunkError(event.error ?? event.message);
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
    };
  }, []);

  return null;
}
