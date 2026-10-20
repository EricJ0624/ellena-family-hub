export type GalleryDragData = {
  attachmentId: string;
  fromSlot: number | null;
};

export function readGalleryDragData(current: unknown): GalleryDragData | null {
  if (!current || typeof current !== 'object') return null;
  const row = current as { attachmentId?: unknown; fromSlot?: unknown };
  if (typeof row.attachmentId !== 'string' || !row.attachmentId) return null;
  const fromSlot = typeof row.fromSlot === 'number' && Number.isInteger(row.fromSlot) ? row.fromSlot : null;
  return { attachmentId: row.attachmentId, fromSlot };
}

export type SlotRect = {
  id: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
};

/** 손가락이 칸 안이면 그 칸, 칸 테두리에서 slopPx 안이면 가장 가까운 칸. */
export function pickSlotDropId(
  pointer: { x: number; y: number },
  rects: SlotRect[],
  slopPx: number,
): string | null {
  let inside: SlotRect | null = null;
  let insideArea = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const contains =
      pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
    if (!contains) continue;
    const area = Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
    if (area < insideArea) {
      inside = rect;
      insideArea = area;
    }
  }
  if (inside) return inside.id;

  let nearest: SlotRect | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const dx = pointer.x < rect.left ? rect.left - pointer.x : pointer.x > rect.right ? pointer.x - rect.right : 0;
    const dy = pointer.y < rect.top ? rect.top - pointer.y : pointer.y > rect.bottom ? pointer.y - rect.bottom : 0;
    const dist = Math.hypot(dx, dy);
    if (dist <= slopPx && dist < nearestDist) {
      nearest = rect;
      nearestDist = dist;
    }
  }
  return nearest?.id ?? null;
}

/** 칸 위면 배치, 칸에서 끌어 빈 곳이면 그 칸만 비운다. 아래 사진을 빈 곳에 놓으면 그대로 둔다. */
export function nextSlotsAfterDrag<T extends (string | null)[]>(
  slotIds: T,
  data: GalleryDragData | null,
  overId: string,
  place: (slots: T, photoId: string, index: number) => T,
  clear: (slots: T, index: number) => T,
): T | null {
  if (!data) return null;
  if (overId.startsWith('slot-')) {
    const index = Number(overId.slice(5));
    if (!Number.isInteger(index)) return null;
    return place(slotIds, data.attachmentId, index);
  }
  if (data.fromSlot != null) return clear(slotIds, data.fromSlot);
  return null;
}
