'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { DiaryTimelineSlot } from '@/lib/modules/travel-planner/diary-timeline';
import type { TravelPlaceFeedback } from '@/lib/modules/travel-planner/types';
import {
  getAttachmentsForEntity,
  uploadFeatureAttachments,
  validateAttachmentFile,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';

const MOOD_OPTIONS = ['😊', '🍜', '📸', '🌧️', '❤️', '🚶', '☀️'];

/** 고정 4:3 박스 안 장수별 콜라주 (표현만, 업로드 로직 무관) */
const COLLAGE_VISIBLE_MAX = 5;

function collageGridClass(visibleCount: number): string {
  if (visibleCount <= 1) return 'grid-cols-1 grid-rows-1';
  if (visibleCount === 2) return 'grid-cols-2 grid-rows-1';
  if (visibleCount === 3) return 'grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]';
  if (visibleCount === 4) return 'grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]';
  return 'grid-cols-6 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]';
}

function collageCellClass(visibleCount: number, index: number): string {
  if (visibleCount === 3 && index === 0) return 'row-span-2';
  if (visibleCount >= 5) {
    if (index <= 1) return 'col-span-3';
    return 'col-span-2';
  }
  return '';
}

type Props = {
  slot: DiaryTimelineSlot;
  groupId: string;
  feedback?: TravelPlaceFeedback | null;
  labels: {
    note_placeholder: string;
    mood_label: string;
    photos_label: string;
    rating_label: string;
    revisit_label: string;
    expense_label: string;
    save: string;
    saved: string;
    save_failed: string;
    upload_failed: string;
  };
  onSave: (payload: {
    note: string;
    mood_tags: string[];
    rating: number | null;
    is_revisit: boolean;
    actual_expense: number | null;
  }) => Promise<string | null>;
};

export function DiaryEntryCard({ slot, groupId, feedback, labels, onSave }: Props) {
  const entry = slot.entry;
  const [note, setNote] = useState(entry?.note ?? '');
  const [moods, setMoods] = useState<string[]>(entry?.mood_tags ?? []);
  const [rating, setRating] = useState<number | null>(feedback?.rating ?? null);
  const [isRevisit, setIsRevisit] = useState(Boolean(feedback?.is_revisit));
  const [expense, setExpense] = useState(
    feedback?.travel_expense_id ? '' : '',
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const entryId = entry?.id ?? null;

  useEffect(() => {
    setNote(entry?.note ?? '');
    setMoods(entry?.mood_tags ?? []);
  }, [entry?.id, entry?.note, entry?.mood_tags]);

  useEffect(() => {
    if (!entryId) {
      setAttachments([]);
      return;
    }
    void getAttachmentsForEntity({ groupId, entityType: 'travel_diary_entry', entityId: entryId })
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [groupId, entryId]);

  const toggleMood = (m: string) => {
    setMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const exp =
        expense.trim() === '' ? null : Number(expense.replace(/,/g, ''));
      const id = await onSave({
        note,
        mood_tags: moods,
        rating,
        is_revisit: isRevisit,
        actual_expense: exp != null && Number.isFinite(exp) ? exp : null,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      return id;
    } catch {
      alert(labels.save_failed);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    let targetId = entryId;
    if (!targetId) {
      targetId = await handleSave();
      if (!targetId) return;
    }

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
      const rows = await getAttachmentsForEntity({
        groupId,
        entityType: 'travel_diary_entry',
        entityId: targetId,
      });
      setAttachments(rows);
    } catch {
      alert(labels.upload_failed);
    } finally {
      setUploading(false);
    }
  };

  const photoCount = attachments.length;
  const visiblePhotos = attachments.slice(0, COLLAGE_VISIBLE_MAX);
  const visibleCount = visiblePhotos.length;
  const overflowCount = photoCount - visibleCount;

  return (
    <div className="glass-panel-soft rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-800">{slot.title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{slot.day_date}</div>

      {photoCount > 0 && (
        <div
          className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl"
          aria-label={labels.photos_label}
        >
          <div
            className={['absolute inset-0 grid gap-1', collageGridClass(visibleCount)].join(' ')}
          >
            {visiblePhotos.map((a, index) => {
              const isLastVisible = index === visibleCount - 1;
              const showOverflow = isLastVisible && overflowCount > 0;
              const src = a.thumbnail_url || a.image_url;
              return (
                <div
                  key={a.id}
                  className={[
                    'relative min-h-0 min-w-0 overflow-hidden bg-slate-200',
                    collageCellClass(visibleCount, index),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {/* 여백 톤 맞춤: 같은 사진 블러 배경 */}
                  <img
                    src={src}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-slate-900/10"
                  />
                  <img
                    src={src}
                    alt=""
                    className="relative z-[1] h-full w-full object-contain"
                  />
                  {showOverflow && (
                    <div className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-900/55 text-lg font-semibold text-white">
                      +{overflowCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            <input
              type="number"
              min={0}
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
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
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onPickFiles(e)}
        />
      </div>
    </div>
  );
}
