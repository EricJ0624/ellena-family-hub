'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Star, Trash2 } from 'lucide-react';
import type { DiaryTimelineSlot } from '@/lib/modules/travel-planner/diary-timeline';
import type { TravelExpense, TravelPlaceFeedback } from '@/lib/modules/travel-planner/types';
import { formatMoneyAmount } from '@/lib/format-currency';
import {
  deleteAttachment,
  getAttachmentsForEntity,
  uploadFeatureAttachments,
  validateAttachmentFile,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';
import {
  emptyCollageSlots,
  isPortraitDimensions,
  loadImageNaturalSize,
  mergePhotoFocus,
  parseCollageStyle,
  parsePhotoFocus,
  resolveCollageSlots,
  type CollageSlotIds,
  type DiaryCollageStyle,
  type PhotoFocusMap,
} from '@/lib/modules/travel-planner/diary-collage';
import { supabase } from '@/lib/supabase';
import { parseShowMap } from '@/lib/modules/travel-planner/diary-types';
import { canShowDiaryPlaceMap } from '@/lib/modules/travel-planner/google-maps-embed';
import { DiaryPhotoCollage } from './DiaryPhotoCollage';
import { DiaryPhotoFocusModal } from './DiaryPhotoFocusModal';
import { DiaryPhotoGalleryModal } from './DiaryPhotoGalleryModal';
import { DiaryPlaceMapPreview } from './DiaryPlaceMapPreview';
import { FieldTrackRouteMap } from '@/app/features/travel-planner/components/FieldTrackRouteMap';
import { FamilyAlbumPickerModal } from './FamilyAlbumPickerModal';

const MOOD_OPTIONS = ['😊', '🍜', '📸', '🌧️', '❤️', '🚶', '☀️'];

type Labels = {
  note_placeholder: string;
  mood_label: string;
  photos_label: string;
  rating_label: string;
  revisit_label: string;
  expense_label: string;
  receipt_upload: string;
  receipt_need_expense: string;
  receipt_upload_failed: string;
  save: string;
  saved: string;
  edit: string;
  cancel: string;
  save_failed: string;
  upload_failed: string;
  photos_close: string;
  photos_slots_label: string;
  photos_slots_hint: string;
  photos_slot_remove: string;
  photos_style_label: string;
  photos_style_film: string;
  photos_style_postal: string;
  photos_album: string;
  photos_album_empty: string;
  photos_album_add: string;
  photo_focus_title: string;
  photo_focus_hint: string;
  photo_focus_confirm: string;
  photo_focus_skip: string;
  map_label: string;
  map_add: string;
  map_remove: string;
  hide: string;
  hide_failed: string;
  hide_confirm: string;
};

type Props = {
  slot: DiaryTimelineSlot;
  groupId: string;
  feedback?: TravelPlaceFeedback | null;
  linkedExpense?: TravelExpense | null;
  tripCurrency: string;
  moneyLocale: string;
  labels: Labels;
  onSave: (payload: {
    note: string;
    mood_tags: string[];
    rating: number | null;
    is_revisit: boolean;
    actual_expense: number | null;
    collage_style?: DiaryCollageStyle;
    show_map?: boolean;
  }) => Promise<{ entryId: string | null; expenseId: string | null } | null>;
  onCollageSave: (payload: {
    entryId: string;
    collage_attachment_ids?: CollageSlotIds;
    collage_style?: DiaryCollageStyle;
    photo_focus?: PhotoFocusMap;
  }) => Promise<void>;
  onHide?: () => Promise<void>;
};

function expenseInputValue(linkedExpense?: TravelExpense | null): string {
  if (linkedExpense == null) return '';
  const n = Number(linkedExpense.amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

type PendingReceipt = {
  localId: string;
  file: File;
  previewUrl: string;
};

function revokePendingReceipts(items: PendingReceipt[]) {
  for (const item of items) {
    try {
      URL.revokeObjectURL(item.previewUrl);
    } catch {
      /* ignore */
    }
  }
}

export function DiaryEntryCard({
  slot,
  groupId,
  feedback,
  linkedExpense,
  tripCurrency,
  moneyLocale,
  labels,
  onSave,
  onCollageSave,
  onHide,
}: Props) {
  const entry = slot.entry;
  const [note, setNote] = useState(entry?.note ?? '');
  const [moods, setMoods] = useState<string[]>(entry?.mood_tags ?? []);
  const [rating, setRating] = useState<number | null>(feedback?.rating ?? null);
  const [isRevisit, setIsRevisit] = useState(Boolean(feedback?.is_revisit));
  const [expense, setExpense] = useState(expenseInputValue(linkedExpense));
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [receipts, setReceipts] = useState<UploadedAttachment[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [pendingReceiptDeleteIds, setPendingReceiptDeleteIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>(entry?.id ? 'view' : 'edit');
  const [collageStyle, setCollageStyle] = useState<DiaryCollageStyle>(
    parseCollageStyle(entry?.collage_style),
  );
  const [showMapPref, setShowMapPref] = useState(() => parseShowMap(entry?.show_map));
  const [slotIds, setSlotIds] = useState<CollageSlotIds>(() => emptyCollageSlots());
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [photoFocus, setPhotoFocus] = useState<PhotoFocusMap>(() =>
    parsePhotoFocus(entry?.photo_focus),
  );
  const [focusQueue, setFocusQueue] = useState<UploadedAttachment[]>([]);
  const [focusSaving, setFocusSaving] = useState(false);
  const slotsCustomized = useRef(entry?.collage_attachment_ids != null);
  const slotIdsRef = useRef<CollageSlotIds>(emptyCollageSlots());
  const photoFocusRef = useRef<PhotoFocusMap>(parsePhotoFocus(entry?.photo_focus));
  const fileRef = useRef<HTMLInputElement>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const pendingReceiptsRef = useRef<PendingReceipt[]>([]);
  const entryId = entry?.id ?? null;

  const focusCurrent = focusQueue[0] ?? null;

  useEffect(() => {
    pendingReceiptsRef.current = pendingReceipts;
  }, [pendingReceipts]);

  useEffect(() => {
    return () => {
      revokePendingReceipts(pendingReceiptsRef.current);
    };
  }, []);

  useEffect(() => {
    setNote(entry?.note ?? '');
    setMoods(entry?.mood_tags ?? []);
  }, [entry?.id, entry?.note, entry?.mood_tags]);

  useEffect(() => {
    setMode(entry?.id ? 'view' : 'edit');
  }, [entry?.id]);

  useEffect(() => {
    setRating(feedback?.rating ?? null);
    setIsRevisit(Boolean(feedback?.is_revisit));
  }, [feedback?.id, feedback?.rating, feedback?.is_revisit]);

  useEffect(() => {
    if (mode === 'edit') return;
    setExpense(expenseInputValue(linkedExpense));
  }, [linkedExpense?.id, linkedExpense?.amount, mode]);

  useEffect(() => {
    setCollageStyle(parseCollageStyle(entry?.collage_style));
    setShowMapPref(parseShowMap(entry?.show_map));
    const nextFocus = parsePhotoFocus(entry?.photo_focus);
    setPhotoFocus(nextFocus);
    photoFocusRef.current = nextFocus;
    slotsCustomized.current = entry?.collage_attachment_ids != null;
  }, [entry?.id, entry?.collage_style, entry?.collage_attachment_ids, entry?.show_map, entry?.photo_focus]);

  useEffect(() => {
    photoFocusRef.current = photoFocus;
  }, [photoFocus]);

  useEffect(() => {
    if (!entryId) {
      setAttachments([]);
      return;
    }
    void getAttachmentsForEntity({ groupId, entityType: 'travel_diary_entry', entityId: entryId })
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [groupId, entryId]);

  useEffect(() => {
    if (!linkedExpense?.id) {
      setReceipts([]);
      return;
    }
    void getAttachmentsForEntity({
      groupId,
      entityType: 'travel_expense',
      entityId: linkedExpense.id,
    })
      .then(setReceipts)
      .catch(() => setReceipts([]));
  }, [groupId, linkedExpense?.id]);

  const reloadReceipts = async (expenseId?: string | null) => {
    const id = expenseId || linkedExpense?.id;
    if (!id) {
      setReceipts([]);
      return;
    }
    try {
      const rows = await getAttachmentsForEntity({
        groupId,
        entityType: 'travel_expense',
        entityId: id,
      });
      setReceipts(rows);
    } catch {
      setReceipts([]);
    }
  };

  const clearPendingReceipts = () => {
    revokePendingReceipts(pendingReceiptsRef.current);
    pendingReceiptsRef.current = [];
    setPendingReceipts([]);
    setPendingReceiptDeleteIds([]);
  };

  const parseExpenseAmount = (): number | null => {
    const exp = expense.trim() === '' ? null : Number(expense.replace(/,/g, ''));
    if (exp == null || !Number.isFinite(exp) || exp <= 0) return null;
    return exp;
  };

  const hasExpenseAmount = parseExpenseAmount() != null;

  const visibleSavedReceipts = useMemo(
    () => receipts.filter((att) => !pendingReceiptDeleteIds.includes(att.id)),
    [receipts, pendingReceiptDeleteIds],
  );

  const onPickReceipt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (!hasExpenseAmount) {
      alert(labels.receipt_need_expense);
      return;
    }
    for (const file of files) {
      const err = validateAttachmentFile(file);
      if (err) {
        alert(err);
        return;
      }
    }
    const next: PendingReceipt[] = files.map((file) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingReceipts((prev) => [...prev, ...next]);
  };

  const removePendingReceipt = (localId: string) => {
    setPendingReceipts((prev) => {
      const target = prev.find((item) => item.localId === localId);
      if (target) revokePendingReceipts([target]);
      return prev.filter((item) => item.localId !== localId);
    });
  };

  const onDeleteSavedReceipt = (attachmentId: string) => {
    setPendingReceiptDeleteIds((prev) =>
      prev.includes(attachmentId) ? prev : [...prev, attachmentId],
    );
  };

  const startReceiptAttach = () => {
    if (!hasExpenseAmount) {
      alert(labels.receipt_need_expense);
      return;
    }
    receiptFileRef.current?.click();
  };

  useEffect(() => {
    slotIdsRef.current = slotIds;
  }, [slotIds]);

  useEffect(() => {
    const ids = attachments.map((item) => item.id);
    const local = slotIdsRef.current;
    const localHas = local.some(Boolean);
    const saved = entry?.collage_attachment_ids ?? null;
    if (slotsCustomized.current) {
      setSlotIds(resolveCollageSlots(ids, localHas ? local : saved));
      return;
    }
    setSlotIds(resolveCollageSlots(ids, saved));
  }, [attachments, entry?.collage_attachment_ids, entry?.id]);

  const visiblePhotos = useMemo(
    () =>
      slotIds
        .map((id) => (id ? attachments.find((item) => item.id === id) : null))
        .filter((item): item is UploadedAttachment => Boolean(item)),
    [slotIds, attachments],
  );

  const attachedImageUrls = useMemo(
    () => attachments.map((item) => item.image_url),
    [attachments],
  );

  const toggleMood = (m: string) => {
    setMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const restoreFromSaved = () => {
    setNote(entry?.note ?? '');
    setMoods(entry?.mood_tags ?? []);
    setRating(feedback?.rating ?? null);
    setIsRevisit(Boolean(feedback?.is_revisit));
    setExpense(expenseInputValue(linkedExpense));
    setCollageStyle(parseCollageStyle(entry?.collage_style));
    setShowMapPref(parseShowMap(entry?.show_map));
    clearPendingReceipts();
  };

  const currencyCode = (linkedExpense?.currency || tripCurrency || 'KRW').trim().toUpperCase() || 'KRW';
  const savedExpenseAmount = Number(linkedExpense?.amount);
  const hasSavedExpense = Number.isFinite(savedExpenseAmount) && savedExpenseAmount > 0;

  const persistCollage = async (
    nextIds: CollageSlotIds | undefined,
    nextStyle: DiaryCollageStyle | undefined,
    targetId = entryId,
  ) => {
    if (!targetId) return;
    try {
      await onCollageSave({
        entryId: targetId,
        collage_attachment_ids: nextIds,
        collage_style: nextStyle,
      });
    } catch {
      alert(labels.save_failed);
    }
  };

  const handleSlotIdsChange = (next: CollageSlotIds) => {
    slotsCustomized.current = true;
    setSlotIds(next);
    void persistCollage(next, collageStyle);
  };

  const handleStyleChange = (next: DiaryCollageStyle) => {
    setCollageStyle(next);
    void persistCollage(slotsCustomized.current ? slotIds : undefined, next);
  };

  const handleSave = async (opts?: { stayInEdit?: boolean }) => {
    setSaving(true);
    try {
      const exp = parseExpenseAmount();
      const result = await onSave({
        note,
        mood_tags: moods,
        rating,
        is_revisit: isRevisit,
        actual_expense: exp,
        collage_style: collageStyle,
        show_map: showMapPref,
      });

      if (!opts?.stayInEdit) {
        const expenseId = result?.expenseId ?? linkedExpense?.id ?? null;
        const pendingFiles = pendingReceiptsRef.current;
        const deleteIds = pendingReceiptDeleteIds;

        if (pendingFiles.length > 0 && !expenseId) {
          alert(labels.receipt_need_expense);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1500);
          return result;
        }

        if (expenseId && (pendingFiles.length > 0 || deleteIds.length > 0)) {
          try {
            for (const attachmentId of deleteIds) {
              await deleteAttachment(groupId, attachmentId);
            }
            if (pendingFiles.length > 0) {
              await uploadFeatureAttachments({
                groupId,
                featureType: 'travel',
                entityType: 'travel_expense',
                entityId: expenseId,
                files: pendingFiles.map((item) => item.file),
                maxConcurrent: 2,
                retryCount: 1,
              });
            }
          } catch {
            alert(labels.receipt_upload_failed);
          }
        }

        clearPendingReceipts();
        if (expenseId) {
          await reloadReceipts(expenseId);
        } else {
          setReceipts([]);
        }

        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
        if (result?.entryId) setMode('view');
        return result;
      }

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      return result;
    } catch {
      alert(labels.save_failed);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleHide = async () => {
    if (!onHide) return;
    if (!window.confirm(labels.hide_confirm)) return;
    setActing(true);
    try {
      await onHide();
    } catch {
      alert(labels.hide_failed);
    } finally {
      setActing(false);
    }
  };

  const enqueuePortraitFocus = async (
    rows: UploadedAttachment[],
    previousIds: Set<string>,
  ) => {
    const knownFocus = photoFocusRef.current;
    const candidates = rows.filter((row) => !previousIds.has(row.id) && !knownFocus[row.id]);
    if (candidates.length === 0) return;
    const portraits: UploadedAttachment[] = [];
    for (const row of candidates) {
      const src = row.image_url || row.thumbnail_url;
      if (!src) continue;
      try {
        const size = await loadImageNaturalSize(src);
        if (isPortraitDimensions(size.width, size.height)) portraits.push(row);
      } catch {
        /* ignore load errors */
      }
    }
    if (portraits.length === 0) return;
    setFocusQueue((prev) => {
      const seen = new Set(prev.map((item) => item.id));
      const next = [...prev];
      for (const item of portraits) {
        if (!seen.has(item.id)) next.push(item);
      }
      return next;
    });
  };

  const refreshAttachments = async (targetId: string, previousIds?: Set<string>) => {
    const before = previousIds ?? new Set(attachments.map((item) => item.id));
    const rows = await getAttachmentsForEntity({
      groupId,
      entityType: 'travel_diary_entry',
      entityId: targetId,
    });
    setAttachments(rows);
    void enqueuePortraitFocus(rows, before);
  };

  const persistPhotoFocus = async (nextFocus: PhotoFocusMap, targetId: string) => {
    setPhotoFocus(nextFocus);
    photoFocusRef.current = nextFocus;
    setFocusSaving(true);
    try {
      await onCollageSave({ entryId: targetId, photo_focus: nextFocus });
    } catch {
      alert(labels.save_failed);
    } finally {
      setFocusSaving(false);
    }
  };

  const finishFocusCurrent = () => {
    setFocusQueue((prev) => prev.slice(1));
  };

  const onFocusConfirm = async (y: number) => {
    if (!focusCurrent || !entryId) {
      finishFocusCurrent();
      return;
    }
    const nextFocus = mergePhotoFocus(photoFocusRef.current, focusCurrent.id, y);
    await persistPhotoFocus(nextFocus, entryId);
    finishFocusCurrent();
  };

  const ensureEntryId = async () => {
    if (entryId) return entryId;
    const result = await handleSave({ stayInEdit: true });
    return result?.entryId ?? null;
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const targetId = await ensureEntryId();
    if (!targetId) return;

    setUploading(true);
    try {
      const toUpload = files.filter((f) => validateAttachmentFile(f) === null);
      if (toUpload.length === 0) {
        alert(labels.upload_failed);
        return;
      }
      const before = new Set(attachments.map((item) => item.id));
      await uploadFeatureAttachments({
        groupId,
        featureType: 'travel',
        entityType: 'travel_diary_entry',
        entityId: targetId,
        files: toUpload,
      });
      await refreshAttachments(targetId, before);
    } catch {
      alert(labels.upload_failed);
    } finally {
      setUploading(false);
    }
  };

  const onAlbumConfirm = async (albumItemIds: string[]) => {
    const targetId = await ensureEntryId();
    if (!targetId) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      alert(labels.save_failed);
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(`/api/v1/travel/diary-entries/${targetId}/from-album`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, albumItemIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      const before = new Set(attachments.map((item) => item.id));
      await refreshAttachments(targetId, before);
    } catch {
      alert(labels.upload_failed);
    } finally {
      setUploading(false);
    }
  };

  const isView = mode === 'view';
  const selectedMoods = MOOD_OPTIONS.filter((m) => moods.includes(m));
  const placeRef = {
    title: slot.title,
    address: slot.address,
    place_id: slot.place_id,
    latitude: slot.latitude,
    longitude: slot.longitude,
  };
  const routeTrackId =
    slot.field_record_kind === 'route' && slot.field_track_id
      ? String(slot.field_track_id)
      : null;
  const canShowMap = routeTrackId
    ? true
    : canShowDiaryPlaceMap(placeRef, slot.source_kind);
  const displayMap = showMapPref && canShowMap;
  const showRatingBlock = Boolean(slot.source_kind) && (rating != null || isRevisit);
  const showLeftMeta = selectedMoods.length > 0 || (displayMap && showRatingBlock);
  const expenseText = hasSavedExpense
    ? `${labels.expense_label} ${formatMoneyAmount(savedExpenseAmount, currencyCode, moneyLocale)}`
    : null;

  return (
    <div className="glass-panel-soft rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-800">{slot.title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{slot.day_date}</div>

      {attachments.length > 0 ? (
        <DiaryPhotoCollage
          photos={visiblePhotos}
          style={collageStyle}
          photosLabel={labels.photos_label}
          photoFocus={photoFocus}
          onOpen={() => setGalleryOpen(true)}
        />
      ) : null}

      {isView ? (
        <>
          {note.trim() ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {note}
            </p>
          ) : null}

          {showLeftMeta || displayMap ? (
            <div className={`flex items-stretch gap-2${note.trim() ? ' mt-2' : ' mt-3'}`}>
              <div className="flex w-max max-w-[58%] shrink-0 flex-col justify-center gap-1.5">
                {selectedMoods.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedMoods.map((m) => (
                      <span
                        key={m}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-lg"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                ) : null}

                {displayMap && showRatingBlock ? (
                  <>
                    {rating != null && (
                      <div
                        className="flex items-center gap-0.5"
                        aria-label={`${labels.rating_label} ${rating}`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={[
                              'h-4 w-4',
                              n <= rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-transparent text-slate-300',
                            ].join(' ')}
                          />
                        ))}
                      </div>
                    )}
                    {isRevisit && (
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                        {labels.revisit_label}
                      </span>
                    )}
                  </>
                ) : null}
              </div>
              {displayMap ? (
                routeTrackId ? (
                  <FieldTrackRouteMap groupId={groupId} trackId={routeTrackId} />
                ) : (
                  <DiaryPlaceMapPreview place={placeRef} sourceKind={slot.source_kind} />
                )
              ) : null}
            </div>
          ) : null}

          {!displayMap && showRatingBlock ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {rating != null && (
                <div
                  className="flex items-center gap-0.5"
                  aria-label={`${labels.rating_label} ${rating}`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={[
                        'h-4 w-4',
                        n <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-transparent text-slate-300',
                      ].join(' ')}
                    />
                  ))}
                </div>
              )}
              {isRevisit && (
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  {labels.revisit_label}
                </span>
              )}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {labels.edit}
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void handleHide()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {labels.hide}
              </button>
            </div>
            {expenseText ? (
              <span className="text-sm font-medium text-slate-700">{expenseText}</span>
            ) : null}
          </div>
          {receipts.length > 0 ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {receipts.map((att) => (
                <a
                  key={att.id}
                  href={att.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border border-slate-200"
                >
                  <img
                    src={att.thumbnail_url || att.image_url}
                    alt={att.original_filename}
                    className="h-[72px] w-full object-cover"
                  />
                </a>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={labels.note_placeholder}
            rows={2}
            className="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800"
          />

          <div className="mt-3 flex items-stretch gap-2">
            <div className="flex w-max max-w-[58%] min-w-0 shrink-0 flex-col">
              <span className="text-xs font-medium text-slate-600">{labels.mood_label}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMood(m)}
                    className={[
                      'cursor-pointer rounded-full border px-2 py-0.5 text-sm',
                      moods.includes(m)
                        ? 'border-violet-400 bg-violet-100'
                        : 'border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {displayMap ? (
              routeTrackId ? (
                <FieldTrackRouteMap groupId={groupId} trackId={routeTrackId} />
              ) : (
                <DiaryPlaceMapPreview place={placeRef} sourceKind={slot.source_kind} />
              )
            ) : null}
          </div>

          {canShowMap ? (
            <div className="mt-3">
              <span className="text-xs font-medium text-slate-600">{labels.map_label}</span>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowMapPref(true)}
                  className={[
                    'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium',
                    showMapPref
                      ? 'border-violet-400 bg-violet-100 text-violet-800'
                      : 'border-slate-200 bg-white text-slate-700',
                  ].join(' ')}
                >
                  {labels.map_add}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapPref(false)}
                  className={[
                    'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium',
                    !showMapPref
                      ? 'border-violet-400 bg-violet-100 text-violet-800'
                      : 'border-slate-200 bg-white text-slate-700',
                  ].join(' ')}
                >
                  {labels.map_remove}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <span className="text-xs font-medium text-slate-600">{labels.photos_style_label}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleStyleChange('film')}
                className={[
                  'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium',
                  collageStyle === 'film'
                    ? 'border-violet-400 bg-violet-100 text-violet-800'
                    : 'border-slate-200 bg-white text-slate-700',
                ].join(' ')}
              >
                {labels.photos_style_film}
              </button>
              <button
                type="button"
                onClick={() => handleStyleChange('postal')}
                className={[
                  'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium',
                  collageStyle === 'postal'
                    ? 'border-violet-400 bg-violet-100 text-violet-800'
                    : 'border-slate-200 bg-white text-slate-700',
                ].join(' ')}
              >
                {labels.photos_style_postal}
              </button>
            </div>
          </div>

          {slot.source_kind && (
            <div className={displayMap ? 'mt-3 flex flex-col gap-2' : 'mt-3 grid gap-2 sm:grid-cols-2'}>
              <label className="text-xs text-slate-600">
                {labels.rating_label}
                <select
                  value={rating ?? ''}
                  onChange={(e) =>
                    setRating(e.target.value ? Number(e.target.value) : null)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex items-center gap-2 text-xs text-slate-600${displayMap ? '' : ' sm:mt-5'}`}>
                <input
                  type="checkbox"
                  checked={isRevisit}
                  onChange={(e) => setIsRevisit(e.target.checked)}
                />
                {labels.revisit_label}
              </label>
              <label className={`text-xs text-slate-600${displayMap ? '' : ' sm:col-span-2'}`}>
                {labels.expense_label}
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={expense}
                    onChange={(e) => setExpense(e.target.value)}
                    className="block min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <span className="shrink-0 text-xs font-medium text-slate-500">{currencyCode}</span>
                </span>
              </label>
              <div className={displayMap ? '' : 'sm:col-span-2'}>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={startReceiptAttach}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold',
                      hasExpenseAmount
                        ? 'cursor-pointer border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'cursor-pointer border-slate-200 bg-slate-100 text-slate-400',
                      saving ? 'opacity-60' : '',
                    ].join(' ')}
                    aria-disabled={!hasExpenseAmount}
                  >
                    {labels.receipt_upload}
                  </button>
                  <input
                    ref={receiptFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={onPickReceipt}
                  />
                </div>
                {(visibleSavedReceipts.length > 0 || pendingReceipts.length > 0) ? (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {visibleSavedReceipts.map((att) => (
                      <div key={att.id} className="relative">
                        <a href={att.image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={att.thumbnail_url || att.image_url}
                            alt={att.original_filename}
                            className="h-[72px] w-full rounded-md object-cover"
                          />
                        </a>
                        <button
                          type="button"
                          onClick={() => onDeleteSavedReceipt(att.id)}
                          className="absolute right-1 top-1 h-[18px] w-[18px] cursor-pointer rounded-full border-0 bg-[rgba(239,68,68,0.95)] text-[10px] text-white"
                        >
                          x
                        </button>
                      </div>
                    ))}
                    {pendingReceipts.map((item) => (
                      <div key={item.localId} className="relative">
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="h-[72px] w-full rounded-md object-cover ring-2 ring-blue-300"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingReceipt(item.localId)}
                          className="absolute right-1 top-1 h-[18px] w-[18px] cursor-pointer rounded-full border-0 bg-[rgba(239,68,68,0.95)] text-[10px] text-white"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {savedFlash ? labels.saved : labels.save}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {labels.photos_label}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setAlbumOpen(true)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {labels.photos_album}
            </button>
            {entryId && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  restoreFromSaved();
                  setMode('view');
                }}
                className="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                {labels.cancel}
              </button>
            )}
            <button
              type="button"
              disabled={acting}
              onClick={() => void handleHide()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {labels.hide}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void onPickFiles(e)}
            />
          </div>
        </>
      )}

      <DiaryPhotoGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        attachments={attachments}
        slotIds={slotIds}
        photoFocus={photoFocus}
        labels={{
          photosLabel: labels.photos_label,
          closeLabel: labels.photos_close,
          slotsLabel: labels.photos_slots_label,
          slotsHint: labels.photos_slots_hint,
          slotRemove: labels.photos_slot_remove,
        }}
        onSlotIdsChange={handleSlotIdsChange}
      />

      <DiaryPhotoFocusModal
        open={Boolean(focusCurrent) && !focusSaving}
        imageUrl={focusCurrent?.image_url || focusCurrent?.thumbnail_url || ''}
        initialY={focusCurrent ? photoFocus[focusCurrent.id]?.y ?? 50 : 50}
        title={labels.photo_focus_title}
        hint={labels.photo_focus_hint}
        confirmLabel={labels.photo_focus_confirm}
        skipLabel={labels.photo_focus_skip}
        onConfirm={(y) => void onFocusConfirm(y)}
        onSkip={finishFocusCurrent}
      />

      <FamilyAlbumPickerModal
        open={albumOpen}
        onClose={() => setAlbumOpen(false)}
        groupId={groupId}
        attachedImageUrls={attachedImageUrls}
        labels={{
          title: labels.photos_album,
          close: labels.photos_close,
          empty: labels.photos_album_empty,
          add: labels.photos_album_add,
        }}
        onConfirm={onAlbumConfirm}
      />
    </div>
  );
}
