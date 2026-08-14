'use client';

import { useEffect, useMemo, useState } from 'react';
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
  placePhotoInSlot,
  type CollageSlotIds,
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

function SlotDrop({
  index,
  photo,
  picked,
  removeLabel,
  onTap,
  onClear,
}: {
  index: number;
  photo: UploadedAttachment | null;
  picked: boolean;
  removeLabel: string;
  onTap: () => void;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });

  return (
    <div
      ref={setNodeRef}
      className={[
        'relative aspect-[4/3] overflow-hidden rounded-lg border-2 bg-violet-50/40',
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
          <img src={photoSrc(photo)} alt="" className="h-full w-full object-cover" />
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
  onTap,
}: {
  attachment: UploadedAttachment;
  slotNumber: number | null;
  selected: boolean;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `gallery-${attachment.id}`,
    data: { attachmentId: attachment.id },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onTap}
      className={[
        'relative overflow-hidden rounded-lg border-2 bg-slate-100 p-0',
        selected ? 'border-violet-500 ring-2 ring-violet-300' : 'border-transparent',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <img src={photoSrc(attachment)} alt="" className="aspect-[4/3] h-auto w-full object-cover" />
      {slotNumber != null ? (
        <span className="absolute left-1 top-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {slotNumber}
        </span>
      ) : null}
    </button>
  );
}

export function DiaryPhotoGalleryModal({
  open,
  onClose,
  attachments,
  slotIds,
  labels,
  onSlotIdsChange,
}: {
  open: boolean;
  onClose: () => void;
  attachments: UploadedAttachment[];
  slotIds: CollageSlotIds;
  labels: GalleryLabels;
  onSlotIdsChange: (next: CollageSlotIds) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const byId = useMemo(
    () => new Map(attachments.map((item) => [item.id, item])),
    [attachments],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onDragStart = (event: DragStartEvent) => {
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
      if (Number.isInteger(index)) onSlotIdsChange(placePhotoInSlot(slotIds, photoId, index));
      setPickedId(null);
    }
  };

  const tapSlot = (index: number) => {
    if (pickedId) {
      onSlotIdsChange(placePhotoInSlot(slotIds, pickedId, index));
      setPickedId(null);
      return;
    }
    const current = slotIds[index];
    if (current) setPickedId(current);
  };

  return (
    <GlassSafeModal
      open={open}
      onClose={() => {
        setPickedId(null);
        onClose();
      }}
      maxWidthClass="max-w-3xl"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{labels.photosLabel}</p>
        <button
          type="button"
          onClick={() => {
            setPickedId(null);
            onClose();
          }}
          className="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {labels.closeLabel}
        </button>
      </div>

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
                  onTap={() => tapSlot(index)}
                  onClear={() => onSlotIdsChange(clearCollageSlot(slotIds, index))}
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
                  onTap={() =>
                    setPickedId((prev) => (prev === attachment.id ? null : attachment.id))
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
    </GlassSafeModal>
  );
}
