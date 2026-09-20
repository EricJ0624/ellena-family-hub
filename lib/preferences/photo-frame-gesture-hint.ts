const STORAGE_KEY_PREFIX = 'ellena.photoFrameGestureHintSeen';

/** 그룹 스코프 없으면 레거시 전역 키 (기존 사용자 호환) */
function storageKey(scope?: string | null): string {
  const s = typeof scope === 'string' ? scope.trim() : '';
  return s ? `${STORAGE_KEY_PREFIX}:${s}` : STORAGE_KEY_PREFIX;
}

export function readPhotoFrameGestureHintSeen(scope?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(storageKey(scope)) === '1';
  } catch {
    return true;
  }
}

export function writePhotoFrameGestureHintSeen(scope?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(scope), '1');
  } catch {
    // quota / private mode — 안내는 닫되 저장만 생략
  }
}
