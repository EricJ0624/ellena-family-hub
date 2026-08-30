/**
 * 대시보드 앨범 위젯 등에서 브라우저가 이미 로드한 사진 URL.
 * HTTP 캐시 hit 가능성이 높은 URL만 모아 폴라로이드 등에 재사용한다.
 * (실제 캐시 조회 API는 없으므로 "로드 성공"을 근사치로 사용)
 */

type Listener = () => void;

const viewedUrls = new Set<string>();
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function markAlbumPhotoUrlViewed(url: string): void {
  const trimmed = (url || '').trim();
  if (!trimmed || viewedUrls.has(trimmed)) return;
  viewedUrls.add(trimmed);
  notify();
}

export function getViewedAlbumPhotoUrls(): string[] {
  return Array.from(viewedUrls);
}

export function subscribeViewedAlbumPhotoUrls(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearViewedAlbumPhotoUrls(): void {
  if (viewedUrls.size === 0) return;
  viewedUrls.clear();
  notify();
}

/** background-size: cover + center 에 맞춘 이미지 표시 영역 */
export function getCoverFittedRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
): { left: number; top: number; width: number; height: number } {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.max(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return {
    left: (containerW - width) / 2,
    top: (containerH - height) / 2,
    width,
    height,
  };
}

/** Travel Diary BG (730×467) 폴라로이드 안쪽 사진 칸 — 이미지 비율 좌표 */
export const TRAVEL_DIARY_BG_SIZE = { width: 730, height: 467 } as const;

/** Travel Diary BG (730×467) 폴라로이드 안쪽 — widget-bg 투명 구멍과 동기화 */
export const TRAVEL_DIARY_POLAROID_INNER = {
  left: 0.643,
  top: 0.378,
  width: 0.162,
  height: 0.212,
  /** 폴라로이드 프레임이 반시계 방향이라 음수 — 첨부 기준 아주 살짝 더 */
  rotateDeg: -6,
} as const;

/** Family Location kids BG (992×1070) — 오른쪽 위 타원 안쪽. 배경이 100% 100%라 CSS %와 동일 */
export const LOCATION_WIDGET_BG_SIZE = { width: 992, height: 1070 } as const;

export const LOCATION_OVAL_INNER = {
  left: 0.552,
  top: 0.076,
  width: 0.395,
  height: 0.23,
} as const;
