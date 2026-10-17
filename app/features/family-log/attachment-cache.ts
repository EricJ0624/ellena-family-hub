import { getAttachmentsForEntity, type UploadedAttachment } from '@/lib/feature-attachments-client';

export type FamilyLogAttachmentCache = {
  photos?: UploadedAttachment[];
  receipts?: UploadedAttachment[];
};

const cache = new Map<string, FamilyLogAttachmentCache>();

export function readFamilyLogAttachments(cardId: string): FamilyLogAttachmentCache | null {
  return cache.get(cardId) ?? null;
}

export function writeFamilyLogAttachments(cardId: string, patch: FamilyLogAttachmentCache) {
  const prev = cache.get(cardId) ?? {};
  cache.set(cardId, { ...prev, ...patch });
}

export function forgetFamilyLogAttachments(cardId: string) {
  cache.delete(cardId);
}

export function clearFamilyLogAttachmentCache() {
  cache.clear();
}

export async function ensureFamilyLogAttachments(cardId: string, groupId: string): Promise<FamilyLogAttachmentCache> {
  const cached = readFamilyLogAttachments(cardId);
  const patch: FamilyLogAttachmentCache = {};
  if (cached?.photos === undefined) {
    patch.photos = await getAttachmentsForEntity({
      groupId,
      entityType: 'family_log_card',
      entityId: cardId,
    });
  }
  if (cached?.receipts === undefined) {
    patch.receipts = await getAttachmentsForEntity({
      groupId,
      entityType: 'family_log_receipt',
      entityId: cardId,
    });
  }
  if (patch.photos || patch.receipts) writeFamilyLogAttachments(cardId, patch);
  return readFamilyLogAttachments(cardId) ?? {};
}
