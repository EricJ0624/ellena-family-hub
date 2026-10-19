'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useHorizontalPageSwipe, type PageSwipeDir } from '@/lib/hooks/useHorizontalPageSwipe';
import { createPortal } from 'react-dom';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { DiaryPhotoCollage } from '@/app/features/travel-diary/components/DiaryPhotoCollage';
import { FamilyLogPhotoGallery } from './FamilyLogPhotoGallery';
import { resolveFamilyLogSlots } from '../collage';
import { DiaryPlaceMapPreview } from '@/app/features/travel-diary/components/DiaryPlaceMapPreview';
import { FamilyLogRouteMap } from './FamilyLogRouteMap';
import { type UploadedAttachment } from '@/lib/feature-attachments-client';
import {
  diaryBodyClass,
  diaryCardShellClass,
  diaryDateClass,
  diaryTitleClass,
} from '@/lib/modules/travel-planner/diary-entry-theme';
import { canShowDiaryPlaceMap } from '@/lib/modules/travel-planner/google-maps-embed';
import { readFamilyLogAttachments, ensureFamilyLogAttachments } from '../attachment-cache';
import { routePointsForCard } from '../card-record';
import { deleteFamilyLogCard } from '../client-auth';
import type { UiTheme } from '@/lib/ui-theme';
import type { FamilyLogLabels } from '../labels';
import type { FamilyLogCard } from '../types';

type Props = {
  card: FamilyLogCard;
  groupId: string;
  labels: FamilyLogLabels;
  uiTheme?: UiTheme;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  onNeighbor?: (dir: PageSwipeDir) => void;
};

export function FamilyLogCardView({
  card,
  groupId,
  labels,
  uiTheme,
  onClose,
  onEdit,
  onDeleted,
  canPrev = false,
  canNext = false,
  onNeighbor,
}: Props) {
  const themeOpts = {
    isFamilyTheme: uiTheme !== 'default' && uiTheme !== 'highend_glass',
    isNightShell: uiTheme === 'highend_glass',
  };
  const cachedOnOpen = readFamilyLogAttachments(card.id);
  const [photos, setPhotos] = useState<UploadedAttachment[]>(cachedOnOpen?.photos ?? []);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryZoomId, setGalleryZoomId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<UploadedAttachment[]>(cachedOnOpen?.receipts ?? []);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const cardSwipe = useHorizontalPageSwipe({
    enabled: Boolean(onNeighbor) && (canPrev || canNext),
    canPrev,
    canNext,
    onPage: (dir) => onNeighbor?.(dir),
  });
  const isRoute = card.kind === 'route';
  const place = {
    title: card.title,
    address: card.address,
    latitude: isRoute ? card.place_latitude : card.latitude,
    longitude: isRoute ? card.place_longitude : card.longitude,
  };
  const routePoints = isRoute ? routePointsForCard(card) : [];
  const showPlaceMap = card.show_map !== false && canShowDiaryPlaceMap(place);
  const showRouteMap = card.show_map !== false && routePoints.length > 0;
  const displayMap = showPlaceMap || showRouteMap;
  const hasAmount = card.amount != null && card.amount > 0;
  const note = card.note?.trim() ?? '';
  const visiblePhotos = useMemo(() => {
    const slots = resolveFamilyLogSlots(
      photos.map((photo) => photo.id),
      card.collage_attachment_ids,
    );
    return slots
      .map((id) => (id ? photos.find((photo) => photo.id === id) ?? null : null))
      .filter((photo): photo is UploadedAttachment => Boolean(photo));
  }, [photos, card.collage_attachment_ids]);

  useEffect(() => {
    const cached = readFamilyLogAttachments(card.id);
    setPhotos(cached?.photos ?? []);
    setReceipts(cached?.receipts ?? []);
    setGalleryOpen(false);
    setGalleryZoomId(null);
    setScale(1);
    setError(null);
    if (cached?.photos && cached?.receipts) return;
    let cancelled = false;
    void ensureFamilyLogAttachments(card.id, groupId)
      .then((next) => {
        if (cancelled) return;
        setPhotos(next.photos ?? []);
        setReceipts(next.receipts ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(labels.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [card.id, groupId, labels.loadFailed]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const inner = innerRef.current;
    if (!frame || !inner) return;
    const measure = () => {
      const available = frame.clientHeight;
      const needed = inner.scrollHeight;
      if (available <= 0 || needed <= 0) return;
      const next = Math.min(1, available / needed);
      setScale((prev) => (Math.abs(prev - next) < 0.015 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [photos.length, receipts.length, note, card.mood_tags.length, displayMap, hasAmount]);

  const removeCard = async () => {
    if (deleting) return;
    if (!window.confirm(labels.deleteConfirm)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteFamilyLogCard(card.id, groupId);
      onDeleted();
    } catch {
      setError(labels.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  const scaled = scale < 0.995;
  const node = (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div
        ref={(node) => {
          frameRef.current = node;
          cardSwipe.ref(node);
        }}
        className="max-h-full w-full max-w-lg overflow-hidden"
        style={cardSwipe.style}
        onPointerDown={cardSwipe.onPointerDown}
        onPointerMove={cardSwipe.onPointerMove}
        onPointerUp={cardSwipe.onPointerUp}
        onPointerCancel={cardSwipe.onPointerCancel}
        onClickCapture={cardSwipe.onClickCapture}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={innerRef}
          role="dialog"
          aria-modal="true"
          aria-label={card.title}
          className={['w-full rounded-2xl p-4', diaryCardShellClass(themeOpts)].join(' ')}
          style={scaled ? { transform: `scale(${scale})`, transformOrigin: 'top center' } : undefined}
        >
          <div className={['text-lg font-semibold tracking-tight', diaryTitleClass(themeOpts)].join(' ')}>
            {card.title}
          </div>
          <div
            className={[
              'mt-0.5 text-xs font-semibold tabular-nums tracking-wide',
              diaryDateClass(themeOpts),
            ].join(' ')}
          >
            {card.day_date}
          </div>

          {photos.length > 0 ? (
            <DiaryPhotoCollage
              photos={visiblePhotos}
              style={card.collage_style === 'postal' ? 'postal' : 'film'}
              photosLabel={labels.photos}
              photoFocus={card.photo_focus}
              onOpen={() => {
                setGalleryZoomId(null);
                setGalleryOpen(true);
              }}
              onSelectPhoto={
                visiblePhotos.length > 0
                  ? (photo) => {
                      setGalleryZoomId(photo.id);
                      setGalleryOpen(true);
                    }
                  : undefined
              }
            />
          ) : null}

          {note ? (
            <p className={['mt-3 whitespace-pre-wrap text-sm leading-relaxed', diaryBodyClass(themeOpts)].join(' ')}>
              {note}
            </p>
          ) : null}

          {card.mood_tags.length > 0 || (!isRoute && showPlaceMap) || card.rating != null || card.is_revisit ? (
            <div className={`flex items-stretch gap-2${note ? ' mt-2' : ' mt-3'}`}>
              <div className="flex w-max max-w-[58%] shrink-0 flex-col justify-center gap-1.5">
                {card.mood_tags.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {card.mood_tags.map((mood) => (
                      <span
                        key={mood}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-lg"
                      >
                        {mood}
                      </span>
                    ))}
                  </div>
                ) : null}
                {card.rating != null ? (
                  <div className="flex items-center gap-0.5" aria-label={`${labels.rating} ${card.rating}`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={n <= card.rating! ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4 text-slate-300'}
                      />
                    ))}
                  </div>
                ) : null}
                {card.is_revisit ? (
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                    {labels.revisit}
                  </span>
                ) : null}
              </div>
              {!isRoute && showPlaceMap ? <DiaryPlaceMapPreview place={place} /> : null}
            </div>
          ) : null}

          {isRoute && (showPlaceMap || showRouteMap) ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {showPlaceMap ? (
                <div className="min-w-0">
                  <p className="m-0 mb-1 text-xs font-medium text-slate-500">{labels.placeMap}</p>
                  <DiaryPlaceMapPreview place={place} />
                </div>
              ) : null}
              {showRouteMap ? (
                <div className="min-w-0">
                  <p className="m-0 mb-1 text-xs font-medium text-slate-500">{labels.routeMap}</p>
                  <FamilyLogRouteMap points={routePoints} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {labels.edit}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void removeCard()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {labels.delete}
              </button>
            </div>
            {hasAmount ? (
              <span className={['text-sm font-medium', diaryBodyClass(themeOpts)].join(' ')}>
                {labels.expense} {card.amount}
                {card.currency ? ` ${card.currency}` : ''}
              </span>
            ) : null}
          </div>

          {receipts.length > 0 ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {receipts.map((receipt) => {
                const src = receipt.thumbnail_url || receipt.image_url;
                if (!src) return null;
                return (
                  <button
                    key={receipt.id}
                    type="button"
                    onClick={() => window.open(receipt.image_url || src, '_blank', 'noopener,noreferrer')}
                    className="block cursor-pointer overflow-hidden rounded-md border border-slate-200 p-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={receipt.original_filename || labels.receipt}
                      className="h-[72px] w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
          {error ? <p className="m-0 mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {node}
      <FamilyLogPhotoGallery
        open={galleryOpen}
        onClose={() => {
          setGalleryOpen(false);
          setGalleryZoomId(null);
        }}
        attachments={photos}
        initialZoomId={galleryZoomId}
        slotIds={resolveFamilyLogSlots(
          photos.map((photo) => photo.id),
          card.collage_attachment_ids,
        )}
        photoFocus={card.photo_focus}
        editable={false}
        labels={{
          photosLabel: labels.photos,
          closeLabel: labels.close,
          slotsLabel: labels.photosSlots,
          slotsHint: labels.photosSlotsHint,
          slotRemove: labels.photosSlotRemove,
        }}
        onSlotIdsChange={() => undefined}
      />
    </>,
    document.body,
  );
}
