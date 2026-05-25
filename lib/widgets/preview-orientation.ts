/** PC 웹 미리보기: 세로(430) / 가로(넓은 목업) */
export type AppPreviewOrientation = 'portrait' | 'landscape';

const STORAGE_KEY = 'ellena-dashboard-preview-orientation';

export function readStoredPreviewOrientation(): AppPreviewOrientation {
  if (typeof window === 'undefined') return 'portrait';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'landscape' ? 'landscape' : 'portrait';
  } catch {
    return 'portrait';
  }
}

export function writeStoredPreviewOrientation(orientation: AppPreviewOrientation): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, orientation);
  } catch {
    /* ignore quota / private mode */
  }
}

export function togglePreviewOrientation(current: AppPreviewOrientation): AppPreviewOrientation {
  const next = current === 'portrait' ? 'landscape' : 'portrait';
  writeStoredPreviewOrientation(next);
  return next;
}
