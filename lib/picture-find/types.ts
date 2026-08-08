export type PictureFindMode = 'hidden' | 'spot_diff';

export type PictureFindDiffMode = 'auto' | 'manual';

export type PictureFindSceneScope = 'system' | 'group';

export type PictureFindScene = {
  id: string;
  scope: PictureFindSceneScope;
  groupId: string | null;
  title: string;
  imageUrl: string;
  variantImageUrl: string | null;
  diffMode: PictureFindDiffMode;
  supportsHidden: boolean;
  supportsSpotDiff: boolean;
  sortOrder: number;
};

export type NormalizedRegion = {
  id: string;
  x: number;
  y: number;
  r: number;
};

export type HiddenItem = NormalizedRegion & {
  emoji: string;
};

export type PictureFindPuzzle = {
  seed: string;
  itemCount: number;
  hiddenItems: HiddenItem[];
  diffRegions: NormalizedRegion[];
};

export type PictureFindStep = 'mode' | 'scenes' | 'play' | 'result';

export const PICTURE_FIND_ITEM_MIN = 5;
export const PICTURE_FIND_ITEM_MAX = 10;
export const PICTURE_FIND_DURATION_MS = 60_000;
export const PICTURE_FIND_MAX_HINTS = 3;
export const PICTURE_FIND_EDGE_MARGIN = 0.08;
