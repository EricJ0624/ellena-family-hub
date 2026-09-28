const STORAGE_KEY = 'ellena.photoFrameGestureHintSeen';

/**
 * 안내 완료는 브라우저당 한 번.
 * 예전 그룹별 키(`…:groupId`)가 있으면 공통 키로 옮긴다.
 * scope 인자는 호출부 호환용이며 저장 키에 쓰지 않는다.
 */
function migrateGroupSeenToGlobal(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return true;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${STORAGE_KEY}:`)) continue;
      if (localStorage.getItem(key) !== '1') continue;
      localStorage.setItem(STORAGE_KEY, '1');
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function readPhotoFrameGestureHintSeen(_scope?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  return migrateGroupSeenToGlobal();
}

export function writePhotoFrameGestureHintSeen(_scope?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // quota / private mode — 안내는 닫되 저장만 생략
  }
}
