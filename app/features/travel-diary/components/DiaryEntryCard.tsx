'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Star } from 'lucide-react';
import type { DiaryTimelineSlot } from '@/lib/modules/travel-planner/diary-timeline';
import type { TravelExpense, TravelPlaceFeedback } from '@/lib/modules/travel-planner/types';
import { formatMoneyAmount } from '@/lib/format-currency';
import {
  getAttachmentsForEntity,
  uploadFeatureAttachments,
  validateAttachmentFile,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';
import {
  emptyCollageSlots,
  parseCollageStyle,
  resolveCollageSlots,
  type CollageSlotIds,
  type DiaryCollageStyle,
} from '@/lib/modules/travel-planner/diary-collage';
import { supabase } from '@/lib/supabase';
import { DiaryPhotoCollage } from './DiaryPhotoCollage';
import { DiaryPhotoGalleryModal } from './DiaryPhotoGalleryModal';
import { FamilyAlbumPickerModal } from './FamilyAlbumPickerModal';

const MOOD_OPTIONS = ['😊', '🍜', '📸', '🌧️', '❤️', '🚶', '☀️'];

type Labels = {
  note_placeholder: string;
  mood_label: string;
  photos_label: string;
  rating_label: string;
  revisit_label: string;
  expense_label: string;
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
  }) => Promise<string | null>;
  onCollageSave: (payload: {
    entryId: string;
    collage_attachment_ids?: CollageSlotIds;
    collage_style?: DiaryCollageStyle;
  }) => Promise<void>;
};

function expenseInputValue(linkedExpense?: TravelExpense | null): string {
  if (linkedExpense == null) return '';
  const n = Number(linkedExpense.amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(n);
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
}: Props) {
  const entry = slot.entry;
  const [note, setNote] = useState(entry?.note ?? '');
  const [moods, setMoods] = useState<string[]>(entry?.mood_tags ?? []);
  const [rating, setRating] = useState<number | null>(feedback?.rating ?? null);
  const [isRevisit, setIsRevisit] = useState(Boolean(feedback?.is_revisit));
  const [expense, setExpense] = useState(expenseInputValue(linkedExpense));
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>(entry?.id ? 'view' : 'edit');
  const [collageStyle, setCollageStyle] = useState<DiaryCollageStyle>(
    parseCollageStyle(entry?.collage_style),
  );
  const [slotIds, setSlotIds] = useState<CollageSlotIds>(() => emptyCollageSlots());
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const slotsCustomized = useRef(entry?.collage_attachment_ids != null);
  const slotIdsRef = useRef<CollageSlotIds>(emptyCollageSlots());
  const fileRef = useRef<HTMLInputElement>(null);
  const entryId = entry?.id ?? null;

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
    setExpense(expenseInputValue(linkedExpense));
  }, [linkedExpense?.id, linkedExpense?.amount]);

  useEffect(() => {
    setCollageStyle(parseCollageStyle(entry?.collage_style));
    slotsCustomized.current = entry?.collage_attachment_ids != null;
  }, [entry?.id, entry?.collage_style, entry?.collage_attachment_ids]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const exp = expense.trim() === '' ? null : Number(expense.replace(/,/g, ''));
      const id = await onSave({
        note,
        mood_tags: moods,
        rating,
        is_revisit: isRevisit,
        actual_expense: exp != null && Number.isFinite(exp) ? exp : null,
        collage_style: collageStyle,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      if (id) setMode('view');
      return id;
    } catch {
      alert(labels.save_failed);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const refreshAttachments = async (targetId: string) => {
    const rows = await getAttachmentsForEntity({
      groupId,
      entityType: 'travel_diary_entry',
      entityId: targetId,
    });
    setAttachments(rows);
  };

  const ensureEntryId = async () => {
    if (entryId) return entryId;
    return handleSave();
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
      await uploadFeatureAttachments({
        groupId,
        featureType: 'travel',
        entityType: 'travel_diary_entry',
        entityId: targetId,
        files: toUpload,
      });
      await refreshAttachments(targetId);
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
      await refreshAttachments(targetId);
    } catch {
      alert(labels.upload_failed);
    } finally {
      setUploading(false);
    }
  };

  const isView = mode === 'view';
  const selectedMoods = MOOD_OPTIONS.filter((m) => moods.includes(m));

  return (
    <div className="glass-panel-soft rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-800">{slot.title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{slot.day_date}</div>

      {attachments.length > 0 ? (
        <DiaryPhotoCollage
          photos={visiblePhotos}
          style={collageStyle}
          photosLabel={labels.photos_label}
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

          {selectedMoods.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {selectedMoods.map((m) => (
                <span
                  key={m}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-lg"
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          {slot.source_kind && (rating != null || isRevisit || hasSavedExpense) && (
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
              {hasSavedExpense && (
                <span className="text-sm font-medium text-slate-700">
                  {labels.expense_label} {formatMoneyAmount(savedExpenseAmount, currencyCode, moneyLocale)}
                </span>
              )}
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              {labels.edit}
            </button>
          </div>
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

          <div className="mt-3">
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
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
              <label className="flex items-center gap-2 text-xs text-slate-600 sm:mt-5">
                <input
                  type="checkbox"
                  checked={isRevisit}
                  onChange={(e) => setIsRevisit(e.target.checked)}
                />
                {labels.revisit_label}
              </label>
              <label className="text-xs text-slate-600 sm:col-span-2">
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
        labels={{
          photosLabel: labels.photos_label,
          closeLabel: labels.photos_close,
          slotsLabel: labels.photos_slots_label,
          slotsHint: labels.photos_slots_hint,
          slotRemove: labels.photos_slot_remove,
        }}
        onSlotIdsChange={handleSlotIdsChange}
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
