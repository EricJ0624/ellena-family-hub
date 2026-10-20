import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import { isPortraitDimensions, loadImageNaturalSize } from '@/lib/modules/travel-planner/diary-collage';

export async function portraitAttachments(rows: UploadedAttachment[]): Promise<UploadedAttachment[]> {
  const portraits: UploadedAttachment[] = [];
  for (const row of rows) {
    const src = row.image_url || row.thumbnail_url;
    if (!src) continue;
    try {
      const size = await loadImageNaturalSize(src);
      if (isPortraitDimensions(size.width, size.height)) portraits.push(row);
    } catch {
      /* 크기를 모르면 세로 맞춤 대상에서 뺀다 */
    }
  }
  return portraits;
}
