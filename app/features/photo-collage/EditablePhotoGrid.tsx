'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import { isPortraitDimensions, loadImageNaturalSize } from '@/lib/modules/travel-planner/diary-collage';
import { nextSlotsAfterDrag, pickSlotDropId, readGalleryDragData, type GalleryDragData } from './gallery-drag';

const HOLD_MS = 120;
const HOLD_TOLERANCE_PX = 16;
const SLOT_DROP_SLOP_PX = 24;

const liftDragPreview: Modifier = ({ transform }) => ({
  ...transform,
  x: transform.x - 8,
  y: transform.y - 72,
});

const slotCollision: CollisionDetection = ({ droppableContainers, droppableRects, pointerCoordinates }) => {
  if (!pointerCoordinates) return [];
  const rects = [];
  for (const container of droppableContainers) {
    const id = String(container.id);
    if (!id.startsWith('slot-')) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    rects.push({
      id,
      top: rect.top,
      left: rect.left,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    });
  }
  const id = pickSlotDropId(pointerCoordinates, rects, SLOT_DROP_SLOP_PX);
  return id ? [{ id }] : [];
};

function photoSrc(attachment: UploadedAttachment): string {
  return attachment.thumbnail_url || attachment.image_url || '';
}

function usePortraitIds(attachments: UploadedAttachment[]) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const key = attachments.map((item) => item.id).join('|');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Set<string>();
      for (const row of attachments) {
        const src = row.image_url || row.thumbnail_url;
        if (!src) continue;
        try {
          const size = await loadImageNaturalSize(src);
          if (isPortraitDimensions(size.width, size.height)) next.add(row.id);
        } catch {
          /* 가로로 두고 버튼을 숨긴다 */
        }
      }
      if (!cancelled) setIds(next);
    })();
    return () => {
      cancelled = true;
    };
    // 사진 id 구성이 바뀔 때만 다시 잰다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ids;
}

function DragHandle({ dragId, data, label }: { dragId: string; data: GalleryDragData; label: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: dragId, data });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      className="absolute bottom-0 left-0 z-[2] flex h-11 w-11 touch-none cursor-grab items-end justify-start border-0 bg-transparent p-1 active:cursor-grabbing"
    >
      <span className="pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/75 text-[10px] leading-none text-white">
        ::
      </span>
    </button>
  );
}

function SlotCell({
  index,
  photo,
  removeLabel,
  dragLabel,
  objectPosition,
  onClear,
}: {
  index: number;
  photo: UploadedAttachment | null;
  removeLabel: string;
  dragLabel: string;
  objectPosition: string;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  return (
    <div
      ref={setNodeRef}
      className={[
        'relative aspect-[3/2] overflow-hidden rounded-lg border-2 bg-violet-50/40',
        isOver ? 'border-violet-500' : 'border-violet-300',
      ].join(' ')}
    >
      {photo ? (
        <img src={photoSrc(photo)} alt="" className="h-full w-full object-cover" style={{ objectPosition }} />
      ) : (
        <span className="flex h-full items-center justify-center text-lg font-semibold text-violet-400">
          {index + 1}
        </span>
      )}
      {photo ? (
        <>
          <DragHandle
            dragId={`slot-drag-${index}-${photo.id}`}
            data={{ attachmentId: photo.id, fromSlot: index }}
            label={dragLabel}
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-1 top-1 z-[2] cursor-pointer rounded-full border-0 bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white"
            aria-label={removeLabel}
          >
            ×
          </button>
        </>
      ) : null}
    </div>
  );
}

function CollectionPhoto({
  attachment,
  slotNumber,
  objectPosition,
  dragLabel,
  deleteLabel,
  adjustLabel,
  showAdjust,
  onDelete,
  onAdjust,
}: {
  attachment: UploadedAttachment;
  slotNumber: number | null;
  objectPosition: string;
  dragLabel: string;
  deleteLabel?: string;
  adjustLabel?: string;
  showAdjust: boolean;
  onDelete?: () => void;
  onAdjust?: () => void;
}) {
  return (
    <div className="relative">
      <img
        src={photoSrc(attachment)}
        alt=""
        className="aspect-[4/3] h-auto w-full rounded-lg object-cover"
        style={{ objectPosition }}
      />
      {slotNumber != null ? (
        <span className="absolute left-1 top-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {slotNumber}
        </span>
      ) : null}
      <DragHandle dragId={`gallery-${attachment.id}`} data={{ attachmentId: attachment.id, fromSlot: null }} label={dragLabel} />
      {onDelete && deleteLabel ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="absolute right-1 top-1 z-[2] cursor-pointer rounded-full border-0 bg-zinc-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white"
          aria-label={deleteLabel}
        >
          ×
        </button>
      ) : null}
      {showAdjust && onAdjust && adjustLabel ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onAdjust();
          }}
          className="absolute bottom-1 right-1 z-[2] cursor-pointer rounded-full border-0 bg-zinc-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          {adjustLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EditablePhotoGrid<T extends (string | null)[]>({
  attachments,
  slotIds,
  slotCount,
  positionFor,
  labels,
  onSlots,
  onAdjustFocus,
  onDeletePhoto,
  place,
  clear,
}: {
  attachments: UploadedAttachment[];
  slotIds: T;
  slotCount: number;
  positionFor: (id: string | undefined) => string;
  labels: {
    slotsLabel: string;
    slotsHint: string;
    slotRemove: string;
    dragLabel: string;
    deleteLabel?: string;
    adjustLabel?: string;
  };
  onSlots: (next: T) => void;
  onAdjustFocus?: (attachment: UploadedAttachment) => void;
  onDeletePhoto?: (attachment: UploadedAttachment) => void;
  place: (slots: T, photoId: string, index: number) => T;
  clear: (slots: T, index: number) => T;
}) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const portraitIds = usePortraitIds(attachments);
  const byId = useMemo(() => new Map(attachments.map((item) => [item.id, item])), [attachments]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: HOLD_MS, tolerance: HOLD_TOLERANCE_PX } }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const data = readGalleryDragData(event.active.data.current);
    const photo = data ? byId.get(data.attachmentId) : null;
    setActiveSrc(photo ? photoSrc(photo) : null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveSrc(null);
    const data = readGalleryDragData(event.active.data.current);
    const overId = event.over?.id != null ? String(event.over.id) : '';
    const next = nextSlotsAfterDrag(slotIds, data, overId, place, clear);
    if (next && next !== slotIds) onSlots(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={slotCollision}
      autoScroll={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveSrc(null)}
    >
      <div className="mt-3 rounded-xl border-2 border-violet-400 bg-violet-50/50 p-3">
        <p className="text-xs font-semibold text-violet-800">{labels.slotsLabel}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-violet-700">{labels.slotsHint}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {Array.from({ length: slotCount }, (_, index) => {
            const id = slotIds[index];
            const photo = id ? byId.get(id) ?? null : null;
            return (
              <SlotCell
                key={index}
                index={index}
                photo={photo}
                removeLabel={labels.slotRemove}
                dragLabel={labels.dragLabel}
                objectPosition={positionFor(photo?.id)}
                onClear={() => onSlots(clear(slotIds, index))}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {attachments.map((attachment) => {
          const slotIndex = slotIds.findIndex((id) => id === attachment.id);
          return (
            <CollectionPhoto
              key={attachment.id}
              attachment={attachment}
              slotNumber={slotIndex >= 0 ? slotIndex + 1 : null}
              objectPosition={positionFor(attachment.id)}
              dragLabel={labels.dragLabel}
              deleteLabel={labels.deleteLabel}
              adjustLabel={labels.adjustLabel}
              showAdjust={portraitIds.has(attachment.id)}
              onDelete={onDeletePhoto ? () => onDeletePhoto(attachment) : undefined}
              onAdjust={onAdjustFocus ? () => onAdjustFocus(attachment) : undefined}
            />
          );
        })}
      </div>
      <DragOverlay modifiers={[liftDragPreview]}>
        {activeSrc ? <img src={activeSrc} alt="" className="h-24 w-32 rounded-md object-cover shadow-lg" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
