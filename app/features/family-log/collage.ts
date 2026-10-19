export const FAMILY_LOG_SLOT_COUNT = 9;

export type FamilyLogSlotIds = (string | null)[];
export type FamilyLogPhotoFocus = Record<string, { y: number }>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function emptyFamilyLogSlots(): FamilyLogSlotIds {
  return Array.from({ length: FAMILY_LOG_SLOT_COUNT }, () => null);
}

export function parseFamilyLogSlots(raw: unknown): FamilyLogSlotIds | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const next = emptyFamilyLogSlots();
  const used = new Set<string>();
  for (let i = 0; i < FAMILY_LOG_SLOT_COUNT; i += 1) {
    const value = raw[i];
    if (typeof value !== 'string' || !UUID_RE.test(value.trim())) continue;
    const id = value.trim();
    if (used.has(id)) continue;
    used.add(id);
    next[i] = id;
  }
  return next;
}

export function parseFamilyLogPhotoFocus(raw: unknown): FamilyLogPhotoFocus {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: FamilyLogPhotoFocus = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!UUID_RE.test(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const yRaw = (value as { y?: unknown }).y;
    if (typeof yRaw !== 'number' || !Number.isFinite(yRaw)) continue;
    out[key] = { y: Math.min(100, Math.max(0, yRaw)) };
  }
  return out;
}

export function clampFamilyLogFocusY(y: number): number {
  if (!Number.isFinite(y)) return 50;
  return Math.min(100, Math.max(0, y));
}

export function familyLogObjectPosition(focus: { y: number } | undefined): string {
  return `50% ${clampFamilyLogFocusY(focus?.y ?? 50)}%`;
}

function defaultSlots(attachmentIds: string[]): FamilyLogSlotIds {
  const next = emptyFamilyLogSlots();
  attachmentIds.slice(0, FAMILY_LOG_SLOT_COUNT).forEach((id, index) => {
    next[index] = id;
  });
  return next;
}

export function resolveFamilyLogSlots(
  attachmentIds: string[],
  saved: FamilyLogSlotIds | null,
): FamilyLogSlotIds {
  if (!saved) return defaultSlots(attachmentIds);
  const known = new Set(attachmentIds);
  const used = new Set<string>();
  const next = emptyFamilyLogSlots();
  for (let i = 0; i < FAMILY_LOG_SLOT_COUNT; i += 1) {
    const id = saved[i];
    if (!id || !known.has(id) || used.has(id)) continue;
    used.add(id);
    next[i] = id;
  }
  return next;
}

export function placeNewFamilyLogPhotos(
  slots: FamilyLogSlotIds,
  previousIds: ReadonlySet<string>,
  attachmentIds: string[],
): FamilyLogSlotIds {
  const next = [...slots];
  const used = new Set(next.filter((id): id is string => Boolean(id)));
  for (const id of attachmentIds) {
    if (!id || previousIds.has(id) || used.has(id)) continue;
    const empty = next.findIndex((slot) => !slot);
    if (empty < 0) break;
    next[empty] = id;
    used.add(id);
  }
  return next;
}

export function placeFamilyLogPhoto(
  slots: FamilyLogSlotIds,
  photoId: string,
  slotIndex: number,
): FamilyLogSlotIds {
  if (slotIndex < 0 || slotIndex >= FAMILY_LOG_SLOT_COUNT) return slots;
  const next = [...slots];
  const fromIndex = next.findIndex((id) => id === photoId);
  const displaced = next[slotIndex];
  if (fromIndex === slotIndex) return slots;
  next[slotIndex] = photoId;
  if (fromIndex >= 0) next[fromIndex] = displaced ?? null;
  return next;
}

export function clearFamilyLogSlot(slots: FamilyLogSlotIds, slotIndex: number): FamilyLogSlotIds {
  if (slotIndex < 0 || slotIndex >= FAMILY_LOG_SLOT_COUNT) return slots;
  const next = [...slots];
  next[slotIndex] = null;
  return next;
}
