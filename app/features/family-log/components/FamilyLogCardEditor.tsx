'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchableSelect } from '@/app/components/SearchableSelect';
import { DiaryPhotoCollage } from '@/app/features/travel-diary/components/DiaryPhotoCollage';
import { DiaryPlaceMapPreview } from '@/app/features/travel-diary/components/DiaryPlaceMapPreview';
import {
  deleteAttachment,
  getAttachmentsForEntity,
  uploadFeatureAttachments,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';
import { formatCurrencyOptionLabel, getTopCurrencyCodes } from '@/lib/currencies';
import type { LangCode } from '@/lib/language-fonts';
import { FAMILY_LOG_MOODS } from '../card-record';
import { familyLogAuthHeaders } from '../client-auth';
import type { FamilyLogLabels } from '../labels';
import type { FamilyLogCard } from '../types';

type Props = {
  card: FamilyLogCard;
  groupId: string;
  lang: LangCode;
  labels: FamilyLogLabels;
  onClose: () => void;
  onSaved: (card: FamilyLogCard) => void;
};

export function FamilyLogCardEditor({ card, groupId, lang, labels, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(card.title);
  const [note, setNote] = useState(card.note ?? '');
  const [moods, setMoods] = useState<string[]>(card.mood_tags ?? []);
  const [amount, setAmount] = useState(card.amount != null ? String(card.amount) : '');
  const [currency, setCurrency] = useState(card.currency ?? '');
  const [showMap, setShowMap] = useState(card.show_map !== false);
  const [photos, setPhotos] = useState<UploadedAttachment[]>([]);
  const [receipts, setReceipts] = useState<UploadedAttachment[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencyOptions = useMemo(
    () => [
      ...(currency === '' ? [{ value: '', label: labels.currencyRequired }] : []),
      ...getTopCurrencyCodes().map((code) => ({
        value: code,
        label: formatCurrencyOptionLabel(code, lang),
      })),
    ],
    [currency, labels.currencyRequired, lang],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [photoRows, receiptRows] = await Promise.all([
          getAttachmentsForEntity({ groupId, entityType: 'family_log_card', entityId: card.id }),
          getAttachmentsForEntity({ groupId, entityType: 'family_log_receipt', entityId: card.id }),
        ]);
        if (cancelled) return;
        setPhotos(photoRows);
        setReceipts(receiptRows);
      } catch {
        if (!cancelled) setError(labels.uploadFailed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card.id, groupId, labels.uploadFailed]);

  const upload = async (files: FileList | null, entityType: 'family_log_card' | 'family_log_receipt') => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    const setUploading = entityType === 'family_log_card' ? setPhotoUploading : setReceiptUploading;
    setUploading(true);
    setError(null);
    try {
      await uploadFeatureAttachments({
        groupId,
        featureType: 'family_log',
        entityType,
        entityId: card.id,
        files: list,
      });
      const rows = await getAttachmentsForEntity({ groupId, entityType, entityId: card.id });
      if (entityType === 'family_log_card') setPhotos(rows);
      else setReceipts(rows);
    } catch {
      setError(labels.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (attachment: UploadedAttachment, entityType: 'family_log_card' | 'family_log_receipt') => {
    setRemoving(true);
    setError(null);
    try {
      await deleteAttachment(groupId, attachment.id);
      const rows = await getAttachmentsForEntity({ groupId, entityType, entityId: card.id });
      if (entityType === 'family_log_card') setPhotos(rows);
      else setReceipts(rows);
    } catch {
      setError(labels.uploadFailed);
    } finally {
      setRemoving(false);
    }
  };

  const save = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const amountNumber = Number(amount);
    const hasAmount = amount.trim() !== '' && Number.isFinite(amountNumber) && amountNumber > 0;
    if (hasAmount && !currency) {
      setError(labels.currencyRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const headers = await familyLogAuthHeaders();
      const res = await fetch(`/api/v1/family-log/cards/${card.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          title: nextTitle,
          note,
          mood_tags: moods,
          amount: hasAmount ? amountNumber : null,
          currency: hasAmount ? currency : '',
          show_map: showMap,
          collage_style: photos.length > 0 ? 'film' : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'save');
      onSaved(json.data as FamilyLogCard);
    } catch {
      setError(labels.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const hasPoint = card.latitude != null && card.longitude != null;
  const node = (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.editTitle}
        className="flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[#fffaf0] shadow-xl sm:rounded-2xl"
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <label className="block text-xs font-semibold text-[#8a7355]">{labels.editTitle}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-[#e4d3b0] bg-white px-2 py-1.5 text-sm text-[#5c4630]"
          />
          <label className="block text-xs font-semibold text-[#8a7355]">{labels.note}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[#e4d3b0] bg-white px-2 py-1.5 text-sm text-[#5c4630]"
          />
          <p className="m-0 text-xs font-semibold text-[#8a7355]">{labels.mood}</p>
          <div className="flex flex-wrap gap-1">
            {FAMILY_LOG_MOODS.map((mood) => (
              <button
                key={mood}
                type="button"
                onClick={() =>
                  setMoods((prev) => (prev.includes(mood) ? prev.filter((item) => item !== mood) : [...prev, mood]))
                }
                className={`cursor-pointer rounded-full border px-2 py-1 text-base ${
                  moods.includes(mood) ? 'border-[#c4a574] bg-[#fff1d6]' : 'border-transparent bg-white'
                }`}
              >
                {mood}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={photoUploading || receiptUploading || removing || saving}
            onClick={() => document.getElementById(`family-log-photos-${card.id}`)?.click()}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {photoUploading ? labels.photosUploading : labels.photos}
          </button>
          <DiaryPhotoCollage
            photos={photos}
            style="film"
            photosLabel={labels.photos}
            onOpen={() => {
              if (photoUploading || receiptUploading || removing || saving) return;
              document.getElementById(`family-log-photos-${card.id}`)?.click();
            }}
          />
          <input
            id={`family-log-photos-${card.id}`}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void upload(e.target.files, 'family_log_card');
              e.target.value = '';
            }}
          />
          {photos.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => void removeFile(photo, 'family_log_card')}
                  className="max-w-full cursor-pointer truncate rounded-full bg-white px-2 py-0.5 text-left text-[11px] text-[#8a7355]"
                >
                  {photo.original_filename}
                </button>
              ))}
            </div>
          ) : null}
          {hasPoint ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMap((prev) => !prev)}
                className="cursor-pointer rounded-full border border-[#e4d3b0] bg-white px-3 py-1 text-xs font-semibold text-[#6b4e2e]"
              >
                {showMap ? labels.mapHide : labels.mapShow}
              </button>
              {showMap ? (
                <DiaryPlaceMapPreview
                  place={{
                    title,
                    address: card.address,
                    latitude: card.latitude,
                    longitude: card.longitude,
                  }}
                />
              ) : null}
            </div>
          ) : null}
          <label className="block text-xs font-semibold text-[#8a7355]">{labels.expense}</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-[#e4d3b0] bg-white px-2 py-1.5 text-sm text-[#5c4630]"
          />
          <SearchableSelect
            id={`family-log-currency-${card.id}`}
            lang={lang}
            value={currency}
            options={currencyOptions}
            onChange={setCurrency}
            ariaLabel={labels.expense}
            className="w-full"
          />
          <p className="m-0 text-xs font-semibold text-[#8a7355]">{labels.receipt}</p>
          <input
            type="file"
            accept="image/*"
            className="block w-full text-xs text-[#6b4e2e]"
            onChange={(e) => {
              void upload(e.target.files, 'family_log_receipt');
              e.target.value = '';
            }}
          />
          {receipts.map((receipt) => (
            <button
              key={receipt.id}
              type="button"
              onClick={() => void removeFile(receipt, 'family_log_receipt')}
              className="block cursor-pointer text-left text-xs text-[#8a7355] underline"
            >
              {receipt.original_filename}
            </button>
          ))}
          {error ? <p className="m-0 text-xs text-red-700">{error}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-[#eadcc4] p-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={photoUploading || receiptUploading || removing || saving}
            title={
              photoUploading || receiptUploading
                ? labels.saveDisabledUploading
                : saving || removing
                  ? labels.saveDisabledSaving
                  : undefined
            }
            className="flex-1 cursor-pointer rounded-lg border-0 bg-[#7d9a6a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6d8a5a] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300"
          >
            {labels.save}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-[#e4d3b0] bg-white px-3 py-2 text-sm font-semibold text-[#6b4e2e]"
          >
            {labels.cancel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
