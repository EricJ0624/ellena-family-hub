/**
 * 액자 스와이프로 고른 사진 — 당일만 유지.
 * 날짜가 바뀌면 무효 → 날짜 시드 랜덤으로 돌아감.
 * (날짜 키는 getLocalDateKey — 랜덤 시드·자정/포커스 동기화와 동일 기준)
 */

const STORAGE_KEY_PREFIX = 'ellena.photoFrameSelectedPhoto';

type StoredFrameSelectedPhoto = {
  photoId: string;
  /** 로컬 달력 YYYY-MM-DD */
  date: string;
};

function getPhotoFrameSelectedPhotoStorageKey(scope: string): string {
  return `${STORAGE_KEY_PREFIX}:${scope}`;
}

/** 로컬 타임존 기준 당일 키 (랜덤 시드·스와이프 만료 공통) */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseStoredFrameSelectedPhoto(
  raw: string | null | undefined,
): StoredFrameSelectedPhoto | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredFrameSelectedPhoto>;
    if (
      typeof parsed?.photoId !== 'string' ||
      !parsed.photoId ||
      typeof parsed?.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
    ) {
      return null;
    }
    return { photoId: parsed.photoId, date: parsed.date };
  } catch {
    return null;
  }
}

/** 오늘 날짜와 일치하는 선택만 반환. 만료·손상 시 키 삭제 후 null. */
export function readStoredFrameSelectedPhoto(scope: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getPhotoFrameSelectedPhotoStorageKey(scope);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored = parseStoredFrameSelectedPhoto(raw);
    if (!stored || stored.date !== getLocalDateKey()) {
      localStorage.removeItem(key);
      return null;
    }
    return stored.photoId;
  } catch {
    return null;
  }
}

export function writeStoredFrameSelectedPhoto(scope: string, photoId: string | number): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredFrameSelectedPhoto = {
      photoId: String(photoId),
      date: getLocalDateKey(),
    };
    localStorage.setItem(getPhotoFrameSelectedPhotoStorageKey(scope), JSON.stringify(payload));
  } catch {
    // quota / private mode — UI는 유지, 저장만 생략
  }
}

export function clearStoredFrameSelectedPhoto(scope: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getPhotoFrameSelectedPhotoStorageKey(scope));
  } catch {
    // ignore
  }
}
