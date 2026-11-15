import type { BabyPrintAlbum } from '../types';

type PrintLayout = BabyPrintAlbum['layout'];

/** 페이지당 장수. 배치만 따르고 용지 크기와는 분리한다. */
export function pageSizeFor(layout: PrintLayout): number {
  if (layout === 'grid1') return 3;
  if (layout === 'grid3') return 9;
  if (layout === 'hero') return 5;
  return 6;
}

export function chunkPhotos<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** 인쇄 앨범 프레임 가로·세로. 에디터와 PDF가 같은 값을 쓴다. */
export const FRAME_SCALE_MIN = 0.4;
export const FRAME_SCALE_X_MAX = 1;
/** 칸 높이의 4배까지. 세로를 키워도 가로는 줄지 않는다. */
export const FRAME_SCALE_Y_MAX = 4;

