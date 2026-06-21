/**
 * JS 청크·동적 import 로드 실패(느린/불안정 네트워크, 배포 직후 캐시 불일치) 감지 및 1회 자동 새로고침.
 */

export const CHUNK_AUTO_RELOAD_SESSION_KEY = 'family-hub.chunk-auto-reload';

export function isLikelyChunkOrNetworkLoadError(error: unknown): boolean {
  if (error == null) return false;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error);

  const name = error instanceof Error ? error.name : '';

  const patterns = [
    /ChunkLoadError/i,
    /Loading chunk \d+ failed/i,
    /Loading CSS chunk \d+ failed/i,
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /error loading dynamically imported module/i,
    /NetworkError when attempting to fetch resource/i,
    /Load failed/i,
  ];

  if (name === 'ChunkLoadError') return true;
  return patterns.some((pattern) => pattern.test(message));
}

/** 세션당 1회만 자동 새로고침. 이미 시도했으면 false. */
export function tryAutoReloadForChunkError(reason: unknown): boolean {
  if (typeof window === 'undefined') return false;
  if (!isLikelyChunkOrNetworkLoadError(reason)) return false;

  try {
    if (sessionStorage.getItem(CHUNK_AUTO_RELOAD_SESSION_KEY) === '1') {
      return false;
    }
    sessionStorage.setItem(CHUNK_AUTO_RELOAD_SESSION_KEY, '1');
  } catch {
    return false;
  }

  window.location.reload();
  return true;
}

export function clearChunkAutoReloadFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CHUNK_AUTO_RELOAD_SESSION_KEY);
  } catch {
    // ignore
  }
}
