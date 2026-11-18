import type { BabyPrintAlbum, BabyPrintPhotoSize } from '../types';

type PrintLayout = BabyPrintAlbum['layout'];

/** 출력 규격 (가로×세로 mm, 세로 인화). 미리보기 비율과 PDF·인쇄가 이 표만 쓴다. */
export const PRINT_PHOTO_SIZES: Record<BabyPrintPhotoSize, { wMm: number; hMm: number }> = {
  mini_2x3: { wMm: 50.8, hMm: 76.2 },
  small_3_5x5: { wMm: 88.9, hMm: 127 },
  std_4x6: { wMm: 101.6, hMm: 152.4 },
  large_5x7: { wMm: 127, hMm: 177.8 },
  xl_8x10: { wMm: 203.2, hMm: 254 },
};

export const PRINT_PHOTO_SIZE_KEYS = Object.keys(PRINT_PHOTO_SIZES) as BabyPrintPhotoSize[];

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

