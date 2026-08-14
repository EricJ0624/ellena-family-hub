export const COLLAGE_SLOT_COUNT = 6;

export type DiaryCollageStyle = 'film' | 'postal';
export type CollageSlotIds = (string | null)[];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function emptyCollageSlots(): CollageSlotIds {
  return Array.from({ length: COLLAGE_SLOT_COUNT }, () => null);
}

export function parseCollageStyle(raw: unknown): DiaryCollageStyle {
  return raw === 'postal' ? 'postal' : 'film';
}

/** null = not customized yet (show first photos). Otherwise always length 6. */
export function parseCollageAttachmentIds(raw: unknown): CollageSlotIds | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const next = emptyCollageSlots();
  for (let i = 0; i < COLLAGE_SLOT_COUNT; i += 1) {
    const value = raw[i];
    if (typeof value === 'string' && UUID_RE.test(value.trim())) {
      next[i] = value.trim();
    }
  }
  return next;
}

function defaultCollageSlots(attachmentIds: string[]): CollageSlotIds {
  const next = emptyCollageSlots();
  attachmentIds.slice(0, COLLAGE_SLOT_COUNT).forEach((id, index) => {
    next[index] = id;
  });
  return next;
}

export function resolveCollageSlots(
  attachmentIds: string[],
  saved: CollageSlotIds | null,
): CollageSlotIds {
  if (!saved) return defaultCollageSlots(attachmentIds);
  const known = new Set(attachmentIds);
  return saved.map((id) => (id && known.has(id) ? id : null));
}

export function placePhotoInSlot(
  slots: CollageSlotIds,
  photoId: string,
  slotIndex: number,
): CollageSlotIds {
  if (slotIndex < 0 || slotIndex >= COLLAGE_SLOT_COUNT) return slots;
  const next = [...slots];
  const fromIndex = next.findIndex((id) => id === photoId);
  const displaced = next[slotIndex];
  if (fromIndex === slotIndex) return slots;
  next[slotIndex] = photoId;
  if (fromIndex >= 0) next[fromIndex] = displaced ?? null;
  return next;
}

export function clearCollageSlot(slots: CollageSlotIds, slotIndex: number): CollageSlotIds {
  if (slotIndex < 0 || slotIndex >= COLLAGE_SLOT_COUNT) return slots;
  const next = [...slots];
  next[slotIndex] = null;
  return next;
}
