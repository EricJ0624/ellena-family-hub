'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GlassSafeModal } from '@/app/components/GlassSafeModal';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import {
  COLLAGE_SLOT_COUNT,
  clearCollageSlot,
  objectPositionCss,
  placePhotoInSlot,
  type CollageSlotIds,
  type PhotoFocusMap,
} from '@/lib/modules/travel-planner/diary-collage';

type GalleryLabels = {
  photosLabel: string;
  closeLabel: string;
  slotsLabel: string;
  slotsHint: string;
  slotRemove: string;
};

function photoSrc(attachment: UploadedAttachment): string {
  return attachment.thumbnail_url || attachment.image_url || '';
}

function photoFullSrc(attachment: UploadedAttachment): string {
  return attachment.image_url || attachment.thumbnail_url || '';
}

function SlotDrop({
  index,
  photo,
  picked,
  removeLabel,
  objectPosition,
  onTap,
  onClear,
}: {
  index: number;
  photo: UploadedAttachment | null;
  picked: boolean;
  removeLabel: string;
  objectPosition: string;
  onTap: () => void;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });

  return (
    <div
      ref={setNodeRef}
      className={[
        'relative aspect-[3/2] overflow-hidden rounded-lg border-2 bg-violet-50/40',
        isOver || picked ? 'border-violet-500' : 'border-violet-300',
        picked ? 'ring-2 ring-violet-400' : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
        onClick={onTap}
        aria-label={`${index + 1}`}
      >
        {photo ? (
          <img
            src={photoSrc(photo)}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition }}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-lg font-semibold text-violet-400">
            {index + 1}
          </span>
        )}
      </button>
      {photo ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          className="absolute right-1 top-1 z-[1] cursor-pointer rounded-full border-0 bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white"
          aria-label={removeLabel}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function GalleryPhoto({
  attachment,
  slotNumber,
  selected,
  objectPosition,
  onTap,
  adjustLabel,
  onAdjust,
}: {
  attachment: UploadedAttachment;
  slotNumber: number | null;
  selected: boolean;
  objectPosition: string;
  onTap: () => void;
  adjustLabel?: string;
  onAdjust?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `gallery-${attachment.id}`,
    data: { attachmentId: attachment.id },
  });

  return (
    <div className={['relative', isDragging ? 'opacity-40' : ''].join(' ')}>
      <button
        type="button"
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onTap}
        className={[
          'block w-full overflow-hidden rounded-lg border-2 bg-slate-100 p-0',
          selected ? 'border-violet-500 ring-2 ring-violet-300' : 'border-transparent',
        ].join(' ')}
      >
        <img
          src={photoSrc(attachment)}
          alt=""
          className="aspect-[4/3] h-auto w-full object-cover"
          style={{ objectPosition }}
        />
        {slotNumber != null ? (
          <span className="absolute left-1 top-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {slotNumber}
          </span>
        ) : null}
      </button>
      {onAdjust && adjustLabel ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onAdjust();
          }}
          className="absolute bottom-1 right-1 z-[1] cursor-pointer rounded-full border-0 bg-zinc-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          {adjustLabel}
        </button>
      ) : null}
    </div>
  );
}

export function DiaryPhotoGalleryModal({
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
}: {
  open: boolean;
  onClose: () => void;
  attachments: UploadedAttachment[];
  slotIds: CollageSlotIds;
  labels: GalleryLabels;
  photoFocus?: PhotoFocusMap;
  initialZoomId?: string | null;
  onSlotIdsChange: (next: CollageSlotIds) => void;
  editable?: boolean;
  adjustLabel?: string;
  onAdjustFocus?: (attachment: UploadedAttachment) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const byId = useMemo(
    () => new Map(attachments.map((item) => [item.id, item])),
    [attachments],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );

  useEffect(() => {
    if (!open || editable) {
      setZoomedId(null);
      return;
    }
    setZoomedId(initialZoomId ?? null);
  }, [open, editable, initialZoomId]);

  const closeGallery = () => {
    setPickedId(null);
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
  }, [open, editable, zoomedId, onClose]);

  const changeSlots = (next: CollageSlotIds) => {
    if (!editable) return;
    onSlotIdsChange(next);
  };

  const onDragStart = (event: DragStartEvent) => {
    if (!editable) return;
    const id = event.active.data.current?.attachmentId as string | undefined;
    const photo = id ? byId.get(id) : null;
    setActiveSrc(photo ? photoSrc(photo) : null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveSrc(null);
    const photoId = event.active.data.current?.attachmentId as string | undefined;
    const overId = event.over?.id != null ? String(event.over.id) : '';
    if (!photoId) return;
    if (overId.startsWith('slot-')) {
      const index = Number(overId.slice(5));
      if (Number.isInteger(index)) changeSlots(placePhotoInSlot(slotIds, photoId, index));
      setPickedId(null);
    }
  };

  const zoomed = !editable && zoomedId ? byId.get(zoomedId) ?? null : null;
  const zoomSrc = zoomed ? photoFullSrc(zoomed) : '';

  const tapSlot = (index: number) => {
    if (!editable) return;
    if (pickedId) {
      changeSlots(placePhotoInSlot(slotIds, pickedId, index));
      setPickedId(null);
      return;
    }
    const current = slotIds[index];
    if (current) setPickedId(current);
  };

  return (
    <>
    <GlassSafeModal
      open={open}
      onClose={dismissZoomOrGallery}
      maxWidthClass="max-w-3xl"
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
                style={{ objectPosition: objectPositionCss(photoFocus?.[attachment.id]) }}
              />
            </button>
          ))}
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveSrc(null)}
      >
        <div className="mt-3 rounded-xl border-2 border-violet-400 bg-violet-50/50 p-3">
          <p className="text-xs font-semibold text-violet-800">{labels.slotsLabel}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-violet-700">{labels.slotsHint}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {Array.from({ length: COLLAGE_SLOT_COUNT }, (_, index) => {
              const id = slotIds[index];
              const photo = id ? byId.get(id) ?? null : null;
              return (
                <SlotDrop
                  key={index}
                  index={index}
                  photo={photo}
                  picked={Boolean(pickedId && id === pickedId)}
                  removeLabel={labels.slotRemove}
                  objectPosition={objectPositionCss(photo ? photoFocus?.[photo.id] : undefined)}
                  onTap={() => tapSlot(index)}
                  onClear={() => changeSlots(clearCollageSlot(slotIds, index))}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attachments.map((attachment) => {
              const slotIndex = slotIds.findIndex((id) => id === attachment.id);
              return (
                <GalleryPhoto
                  key={attachment.id}
                  attachment={attachment}
                  slotNumber={slotIndex >= 0 ? slotIndex + 1 : null}
                  selected={pickedId === attachment.id}
                  objectPosition={objectPositionCss(photoFocus?.[attachment.id])}
                  onTap={() =>
                    setPickedId((prev) => (prev === attachment.id ? null : attachment.id))
                  }
                  adjustLabel={adjustLabel}
                  onAdjust={
                    onAdjustFocus
                      ? () => {
                          setPickedId(null);
                          onAdjustFocus(attachment);
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {activeSrc ? (
            <img src={activeSrc} alt="" className="h-24 w-32 rounded-md object-cover shadow-lg" />
          ) : null}
        </DragOverlay>
      </DndContext>
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
