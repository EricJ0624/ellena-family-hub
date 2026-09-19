/**
 * 앨범 세로 사진 object-position y (0=top, 100=bottom).
 * 저장값은 DB focus_y, 미저장 시 FaceDetector → fallback.
 */

export const ALBUM_PHOTO_FOCUS_FALLBACK_Y = 32;

/** 가족 위치 타원: 완전 위/아래 붙음 방지 */
export const LOCATION_OVAL_FOCUS_Y_MIN = 18;
export const LOCATION_OVAL_FOCUS_Y_MAX = 72;

export function clampAlbumFocusY(y: number): number {
  if (!Number.isFinite(y)) return ALBUM_PHOTO_FOCUS_FALLBACK_Y;
  return Math.min(100, Math.max(0, Math.round(y)));
}

/** 타원 위젯용 소프트 clamp */
export function clampLocationOvalFocusY(y: number): number {
  if (!Number.isFinite(y)) return ALBUM_PHOTO_FOCUS_FALLBACK_Y;
  return Math.min(
    LOCATION_OVAL_FOCUS_Y_MAX,
    Math.max(LOCATION_OVAL_FOCUS_Y_MIN, Math.round(y)),
  );
}

export function parseAlbumFocusY(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return clampAlbumFocusY(n);
}

type FaceDetectorCtor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => {
  detect: (image: HTMLImageElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

function getFaceDetectorCtor(): FaceDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/** 이미지 내 얼굴들의 세로 중심 % 추정. 실패 시 null. */
export async function detectFaceFocusY(img: HTMLImageElement): Promise<number | null> {
  if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
  const FaceDetector = getFaceDetectorCtor();
  if (!FaceDetector) return null;
  try {
    const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    const faces = await detector.detect(img);
    if (!faces.length) return null;
    let sum = 0;
    for (const face of faces) {
      const box = face.boundingBox;
      sum += ((box.y + box.height / 2) / img.naturalHeight) * 100;
    }
    return clampLocationOvalFocusY(sum / faces.length);
  } catch {
    return null;
  }
}

export function objectPositionForFocusY(y: number | null | undefined, isPortrait: boolean): string {
  if (!isPortrait) return '50% 50%';
  return `50% ${clampLocationOvalFocusY(y ?? ALBUM_PHOTO_FOCUS_FALLBACK_Y)}%`;
}
