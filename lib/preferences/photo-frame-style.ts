import { FRAME_CONFIGS, type FrameStyle } from '@/app/components/PhotoFrames';

const STORAGE_KEY_PREFIX = 'ellena.photoFrameStyle';

const VALID_FRAME_STYLES = new Set<FrameStyle>(FRAME_CONFIGS.map((f) => f.id));

export function getPhotoFrameStyleStorageKey(scope: string): string {
  return `${STORAGE_KEY_PREFIX}:${scope}`;
}

export function parseStoredFrameStyle(raw: string | null | undefined): FrameStyle | null {
  if (!raw || !VALID_FRAME_STYLES.has(raw as FrameStyle)) return null;
  return raw as FrameStyle;
}

export function readStoredFrameStyle(scope: string): FrameStyle | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredFrameStyle(localStorage.getItem(getPhotoFrameStyleStorageKey(scope)));
  } catch {
    return null;
  }
}

export function writeStoredFrameStyle(scope: string, style: FrameStyle): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getPhotoFrameStyleStorageKey(scope), style);
  } catch {
    // quota / private mode — UI는 유지, 저장만 생략
  }
}
