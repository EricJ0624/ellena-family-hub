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
