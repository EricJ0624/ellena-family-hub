import type { PictureFindScene } from './types';

type SceneRow = {
  id: string;
  scope: 'system' | 'group';
  group_id: string | null;
  title: string;
  image_url: string;
  variant_image_url: string | null;
  diff_mode: 'auto' | 'manual';
  supports_hidden: boolean;
  supports_spot_diff: boolean;
  sort_order: number;
  created_by: string | null;
};

export function mapSceneRow(row: SceneRow): PictureFindScene {
  return {
    id: row.id,
    scope: row.scope,
    groupId: row.group_id,
    title: row.title,
    imageUrl: row.image_url,
    variantImageUrl: row.variant_image_url,
    diffMode: row.diff_mode,
    supportsHidden: row.supports_hidden,
    supportsSpotDiff: row.supports_spot_diff,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
  };
}

export const PICTURE_FIND_SCENE_SELECT =
  'id, scope, group_id, title, image_url, variant_image_url, diff_mode, supports_hidden, supports_spot_diff, sort_order, created_by';
