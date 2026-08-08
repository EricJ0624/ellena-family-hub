import type { PictureFindScene } from './types';

/** DB/API 미적용 시 클라이언트 폴백 (기본 10장) */
export const DEFAULT_PICTURE_FIND_SCENES: PictureFindScene[] = [
  { id: 'default-01', scope: 'system', groupId: null, title: '공원', imageUrl: '/picture-find/scene-01.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 1, createdBy: null },
  { id: 'default-02', scope: 'system', groupId: null, title: '거실', imageUrl: '/picture-find/scene-02.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 2, createdBy: null },
  { id: 'default-03', scope: 'system', groupId: null, title: '주방', imageUrl: '/picture-find/scene-03.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 3, createdBy: null },
  { id: 'default-04', scope: 'system', groupId: null, title: '아이 방', imageUrl: '/picture-find/scene-04.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 4, createdBy: null },
  { id: 'default-05', scope: 'system', groupId: null, title: '해변', imageUrl: '/picture-find/scene-05.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 5, createdBy: null },
  { id: 'default-06', scope: 'system', groupId: null, title: '마트', imageUrl: '/picture-find/scene-06.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 6, createdBy: null },
  { id: 'default-07', scope: 'system', groupId: null, title: '정원', imageUrl: '/picture-find/scene-07.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 7, createdBy: null },
  { id: 'default-08', scope: 'system', groupId: null, title: '놀이터', imageUrl: '/picture-find/scene-08.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 8, createdBy: null },
  { id: 'default-09', scope: 'system', groupId: null, title: '카페', imageUrl: '/picture-find/scene-09.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 9, createdBy: null },
  { id: 'default-10', scope: 'system', groupId: null, title: '도서관', imageUrl: '/picture-find/scene-10.svg', variantImageUrl: null, diffMode: 'auto', supportsHidden: true, supportsSpotDiff: true, sortOrder: 10, createdBy: null },
];
