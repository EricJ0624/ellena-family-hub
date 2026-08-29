const STORAGE_KEY = 'ellena.photoFrameGestureHintSeen';

export function readPhotoFrameGestureHintSeen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function writePhotoFrameGestureHintSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // quota / private mode — 안내는 닫되 저장만 생략
  }
}
