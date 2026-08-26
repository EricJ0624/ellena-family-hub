export const COLLAGE_SLOT_COUNT = 6;

export type DiaryCollageStyle = 'film' | 'postal';
export type CollageSlotIds = (string | null)[];

/** Vertical object-position % (0 = top, 100 = bottom) per attachment */
export type PhotoFocusMap = Record<string, { y: number }>;

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

export function parsePhotoFocus(raw: unknown): PhotoFocusMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PhotoFocusMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!UUID_RE.test(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const yRaw = (value as { y?: unknown }).y;
    if (typeof yRaw !== 'number' || !Number.isFinite(yRaw)) continue;
    out[key] = { y: Math.min(100, Math.max(0, yRaw)) };
  }
  return out;
}

export function clampPhotoFocusY(y: number): number {
  if (!Number.isFinite(y)) return 50;
  return Math.min(100, Math.max(0, y));
}

export function mergePhotoFocus(
  prev: PhotoFocusMap,
  attachmentId: string,
  y: number,
): PhotoFocusMap {
  return { ...prev, [attachmentId]: { y: clampPhotoFocusY(y) } };
}

export function isPortraitDimensions(width: number, height: number): boolean {
  return height > width;
}

export function objectPositionCss(focus: { y: number } | undefined): string {
  return `50% ${clampPhotoFocusY(focus?.y ?? 50)}%`;
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

export function loadImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}
