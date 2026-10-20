'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GlassSafeModal,
  photoGalleryFrameClassName,
  photoGalleryPanelClassName,
} from '@/app/components/GlassSafeModal';
import { EditablePhotoGrid } from '@/app/features/photo-collage/EditablePhotoGrid';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import {
  FAMILY_LOG_SLOT_COUNT,
  clearFamilyLogSlot,
  familyLogObjectPosition,
  placeFamilyLogPhoto,
  type FamilyLogPhotoFocus,
  type FamilyLogSlotIds,
} from '../collage';

type GalleryLabels = {
  photosLabel: string;
  closeLabel: string;
  slotsLabel: string;
  slotsHint: string;
  slotRemove: string;
  dragLabel: string;
  deleteLabel?: string;
};

function photoSrc(attachment: UploadedAttachment): string {
  return attachment.thumbnail_url || attachment.image_url || '';
}

function photoFullSrc(attachment: UploadedAttachment): string {
  return attachment.image_url || attachment.thumbnail_url || '';
}

export function FamilyLogPhotoGallery({
  open,
  onClose,
  attachments,
  slotIds,
  labels,
  photoFocus,
  initialZoomId = null,
  onSlotIdsChange,
  editable = true,
  adjustLabel,
  onAdjustFocus,
  onDeletePhoto,
}: {
  open: boolean;
  onClose: () => void;
  attachments: UploadedAttachment[];
  slotIds: FamilyLogSlotIds;
  labels: GalleryLabels;
  photoFocus?: FamilyLogPhotoFocus;
  initialZoomId?: string | null;
  onSlotIdsChange: (next: FamilyLogSlotIds) => void;
  editable?: boolean;
  adjustLabel?: string;
  onAdjustFocus?: (attachment: UploadedAttachment) => void;
  onDeletePhoto?: (attachment: UploadedAttachment) => void;
}) {
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(attachments.map((item) => [item.id, item])), [attachments]);

  useEffect(() => {
    if (!open) {
      setZoomedId(null);
      return;
    }
    if (editable) {
      setZoomedId(null);
      return;
    }
    setZoomedId(initialZoomId ?? null);
  }, [open, editable, initialZoomId]);

  const closeGallery = () => {
    setZoomedId(null);
    onClose();
  };

  const dismissZoomOrGallery = () => {
    if (!editable && zoomedId) {
      setZoomedId(null);
      return;
    }
    closeGallery();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissZoomOrGallery();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, editable, zoomedId]);

  const zoomed = !editable && zoomedId ? byId.get(zoomedId) ?? null : null;
  const zoomSrc = zoomed ? photoFullSrc(zoomed) : '';

  return (
    <>
      <GlassSafeModal
        open={open}
        onClose={dismissZoomOrGallery}
        frameClassName={photoGalleryFrameClassName}
        panelClassName={photoGalleryPanelClassName}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">{labels.photosLabel}</p>
          <button
            type="button"
            onClick={closeGallery}
            className="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            {labels.closeLabel}
          </button>
        </div>
        {!editable ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setZoomedId(attachment.id)}
                className="cursor-zoom-in overflow-hidden rounded-lg border-0 bg-slate-100 p-0"
                aria-label={labels.photosLabel}
              >
                <img
                  src={photoSrc(attachment)}
                  alt=""
                  className="aspect-[4/3] h-auto w-full object-cover"
                  style={{ objectPosition: familyLogObjectPosition(photoFocus?.[attachment.id]) }}
                />
              </button>
            ))}
          </div>
        ) : (
          <EditablePhotoGrid
            attachments={attachments}
            slotIds={slotIds}
            slotCount={FAMILY_LOG_SLOT_COUNT}
            positionFor={(id) => familyLogObjectPosition(id ? photoFocus?.[id] : undefined)}
            labels={{
              slotsLabel: labels.slotsLabel,
              slotsHint: labels.slotsHint,
              slotRemove: labels.slotRemove,
              dragLabel: labels.dragLabel,
              deleteLabel: labels.deleteLabel,
              adjustLabel,
            }}
            onSlots={(next) => {
              if (!editable) return;
              onSlotIdsChange(next);
            }}
            onAdjustFocus={onAdjustFocus}
            onDeletePhoto={onDeletePhoto}
            place={placeFamilyLogPhoto}
            clear={clearFamilyLogSlot}
          />
        )}
      </GlassSafeModal>
      {zoomSrc && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4"
              onClick={() => setZoomedId(null)}
              role="presentation"
            >
              <button
                type="button"
                onClick={() => setZoomedId(null)}
                className="absolute right-4 top-4 cursor-pointer rounded-lg border-0 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-800"
              >
                {labels.closeLabel}
              </button>
              <img
                src={zoomSrc}
                alt=""
                className="max-h-[90vh] max-w-full object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
