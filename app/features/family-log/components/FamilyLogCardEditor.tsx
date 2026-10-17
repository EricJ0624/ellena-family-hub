'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { SearchableSelect } from '@/app/components/SearchableSelect';
import { FamilyAlbumPickerModal } from '@/app/features/travel-diary/components/FamilyAlbumPickerModal';
import { DiaryPhotoCollage } from '@/app/features/travel-diary/components/DiaryPhotoCollage';
import { DiaryPlaceMapPreview } from '@/app/features/travel-diary/components/DiaryPlaceMapPreview';
import {
  deleteAttachment,
  getAttachmentsForEntity,
  uploadFeatureAttachments,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';
import { canShowDiaryPlaceMap } from '@/lib/modules/travel-planner/google-maps-embed';
import { formatCurrencyOptionLabel, getTopCurrencyCodes } from '@/lib/currencies';
import type { LangCode } from '@/lib/language-fonts';
import type { UiTheme } from '@/lib/ui-theme';
import { readFamilyLogAttachments, ensureFamilyLogAttachments, writeFamilyLogAttachments } from '../attachment-cache';
import { FAMILY_LOG_MOODS } from '../card-record';
import { deleteFamilyLogCard, familyLogAuthHeaders } from '../client-auth';
import type { FamilyLogLabels } from '../labels';
import type { FamilyLogCard } from '../types';

type Props = {
  card: FamilyLogCard;
  groupId: string;
  lang: LangCode;
  labels: FamilyLogLabels;
  uiTheme?: UiTheme;
  onClose: () => void;
  onSaved: (card: FamilyLogCard) => void;
  onDeleted: () => void;
};

export function FamilyLogCardEditor({
  card,
  groupId,
  lang,
  labels,
  uiTheme,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const tone = uiTheme === 'default' ? 'neo' : uiTheme === 'highend_glass' ? 'glass' : 'kids';
  const labelClass =
    tone === 'neo'
      ? 'block text-xs font-bold text-[var(--neo-ink)]'
      : tone === 'glass'
        ? 'block text-xs font-semibold text-slate-200'
        : 'block text-xs font-semibold text-[#8a7355]';
  const fieldClass =
    tone === 'neo'
      ? 'w-full rounded-sm border-2 border-[var(--neo-ink)] bg-white px-2 py-1.5 text-sm text-[var(--neo-ink)]'
      : tone === 'glass'
        ? 'w-full rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 text-sm text-white'
        : 'w-full rounded-lg border border-[#e4d3b0] bg-white px-2 py-1.5 text-sm text-[#5c4630]';
  const [title, setTitle] = useState(card.title);
  const [note, setNote] = useState(card.note ?? '');
  const [moods, setMoods] = useState<string[]>(card.mood_tags ?? []);
  const [amount, setAmount] = useState(card.amount != null ? String(card.amount) : '');
  const [currency, setCurrency] = useState(card.currency ?? '');
  const [showMap, setShowMap] = useState(card.show_map !== false);
  const [collageStyle, setCollageStyle] = useState<'film' | 'postal'>(
    card.collage_style === 'postal' ? 'postal' : 'film',
  );
  const [rating, setRating] = useState<number | ''>(
    card.rating != null && card.rating >= 1 && card.rating <= 5 ? card.rating : '',
  );
  const [revisit, setRevisit] = useState(card.is_revisit === true);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [photos, setPhotos] = useState<UploadedAttachment[]>([]);
  const [receipts, setReceipts] = useState<UploadedAttachment[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    const cached = readFamilyLogAttachments(card.id);
    setPhotos(cached?.photos ?? []);
    setReceipts(cached?.receipts ?? []);
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
      if (entityType === 'family_log_card') {
        writeFamilyLogAttachments(card.id, { photos: rows });
        setPhotos(rows);
      } else {
        writeFamilyLogAttachments(card.id, { receipts: rows });
        setReceipts(rows);
      }
    } catch {
      setError(labels.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const linkAlbum = async (albumItemIds: string[]) => {
    if (albumItemIds.length === 0) return;
    setPhotoUploading(true);
    setError(null);
    try {
      const headers = await familyLogAuthHeaders();
      const res = await fetch(`/api/v1/family-log/cards/${card.id}/from-album`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, albumItemIds }),
      });
      if (!res.ok) throw new Error('album');
      const rows = await getAttachmentsForEntity({
        groupId,
        entityType: 'family_log_card',
        entityId: card.id,
      });
      writeFamilyLogAttachments(card.id, { photos: rows });
      setPhotos(rows);
    } catch {
      setError(labels.uploadFailed);
    } finally {
      setPhotoUploading(false);
    }
  };

  const removeFile = async (attachment: UploadedAttachment, entityType: 'family_log_card' | 'family_log_receipt') => {
    setRemoving(true);
    setError(null);
    try {
      await deleteAttachment(groupId, attachment.id);
      const cached = readFamilyLogAttachments(card.id);
      if (entityType === 'family_log_card') {
        const next = (cached?.photos ?? photos).filter((item) => item.id !== attachment.id);
        writeFamilyLogAttachments(card.id, { photos: next });
        setPhotos(next);
      } else {
        const next = (cached?.receipts ?? receipts).filter((item) => item.id !== attachment.id);
        writeFamilyLogAttachments(card.id, { receipts: next });
        setReceipts(next);
      }
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
          collage_style: collageStyle,
          rating: rating === '' ? null : rating,
          is_revisit: revisit,
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

  const removeCard = async () => {
    if (photoUploading || receiptUploading || removing || saving || deleting) return;
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

  const choiceClass = (active: boolean) =>
    tone === 'neo'
      ? active
        ? 'cursor-pointer rounded-sm border-2 border-[var(--neo-ink)] bg-[var(--neo-ink)] px-3 py-1.5 text-xs font-bold text-[var(--neo-paper)]'
        : 'cursor-pointer rounded-sm border-2 border-[var(--neo-ink)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--neo-ink)]'
      : tone === 'glass'
        ? active
          ? 'cursor-pointer rounded-lg border border-white/50 bg-white/25 px-3 py-1.5 text-xs font-semibold text-white'
          : 'cursor-pointer rounded-lg border border-white/25 bg-transparent px-3 py-1.5 text-xs font-semibold text-white/80'
        : active
          ? 'cursor-pointer rounded-lg border border-violet-400 bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-800'
          : 'cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700';
  const canPlaceMap = canShowDiaryPlaceMap({
    title: card.title,
    address: card.address,
    latitude: card.latitude,
    longitude: card.longitude,
  });
  const hasExpenseDraft = amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0;
  const actionClass =
    tone === 'neo'
      ? 'inline-flex cursor-pointer items-center gap-1.5 rounded-sm border-2 border-[var(--neo-ink)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--neo-ink)] disabled:opacity-60'
      : tone === 'glass'
        ? 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/30 bg-transparent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60'
        : 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60';
  const node = (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.editTitle}
        className={
          tone === 'neo'
            ? 'flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-sm border-[3px] border-[var(--neo-ink)] bg-white text-[var(--neo-ink)] shadow-[6px_6px_0_0_var(--neo-ink)]'
            : tone === 'glass'
              ? 'flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/30 bg-[#1e1b4b]/95 text-slate-50 shadow-2xl'
              : 'flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[#fffaf0] shadow-xl sm:rounded-2xl'
        }
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <label className={labelClass}>{labels.editTitle}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClass}
          />
          <p
            className={
              tone === 'neo'
                ? 'm-0 text-xs font-bold text-[var(--neo-ink)]/70'
                : tone === 'glass'
                  ? 'm-0 text-xs text-white/70'
                  : 'm-0 text-xs font-medium text-[#a48458]'
            }
          >
            {card.day_date}
          </p>
          <DiaryPhotoCollage
            photos={photos}
            style={collageStyle}
            photosLabel={labels.photos}
            removePhotoLabel={labels.delete}
            onOpen={() => {
              if (photoUploading || receiptUploading || removing || saving || deleting) return;
              document.getElementById(`family-log-photos-${card.id}`)?.click();
            }}
            onRemovePhoto={(photo) => {
              if (photoUploading || receiptUploading || removing || saving || deleting) return;
              if (!window.confirm(labels.deletePhotoConfirm)) return;
              void removeFile(photo, 'family_log_card');
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
          <label className={labelClass}>{labels.note}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={fieldClass}
          />
          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <p className={`m-0 ${labelClass}`}>{labels.mood}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {FAMILY_LOG_MOODS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() =>
                      setMoods((prev) => (prev.includes(mood) ? prev.filter((item) => item !== mood) : [...prev, mood]))
                    }
                    className={`cursor-pointer border px-2 py-0.5 text-sm ${
                      tone === 'neo'
                        ? moods.includes(mood)
                          ? 'rounded-sm border-2 border-[var(--neo-ink)] bg-[var(--neo-ink)]'
                          : 'rounded-sm border-2 border-[var(--neo-ink)] bg-white'
                        : tone === 'glass'
                          ? moods.includes(mood)
                            ? 'rounded-full border-white/50 bg-white/25'
                            : 'rounded-full border-white/20 bg-white/5'
                          : moods.includes(mood)
                            ? 'rounded-full border-violet-400 bg-violet-100'
                            : 'rounded-full border-slate-200 bg-white'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
            {canPlaceMap && showMap ? (
              <div className="min-h-24 min-w-0 flex-1">
                <DiaryPlaceMapPreview
                  place={{
                    title,
                    address: card.address,
                    latitude: card.latitude,
                    longitude: card.longitude,
                  }}
                />
              </div>
            ) : null}
          </div>
          {canPlaceMap ? (
            <div>
              <p className={`m-0 ${labelClass}`}>{labels.mapLabel}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowMap(true)} className={choiceClass(showMap)}>
                  {labels.mapAdd}
                </button>
                <button type="button" onClick={() => setShowMap(false)} className={choiceClass(!showMap)}>
                  {labels.mapRemove}
                </button>
              </div>
            </div>
          ) : null}
          <div>
            <p className={`m-0 ${labelClass}`}>{labels.photoStyle}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" onClick={() => setCollageStyle('film')} className={choiceClass(collageStyle === 'film')}>
                {labels.photoStyleFilm}
              </button>
              <button type="button" onClick={() => setCollageStyle('postal')} className={choiceClass(collageStyle === 'postal')}>
                {labels.photoStylePostal}
              </button>
            </div>
          </div>
          <label className={labelClass}>{labels.rating}</label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value ? Number(e.target.value) : '')}
            className={fieldClass}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <label className={`flex items-center gap-2 ${labelClass}`}>
            <input type="checkbox" checked={revisit} onChange={(e) => setRevisit(e.target.checked)} />
            {labels.revisit}
          </label>
          <label className={labelClass}>{labels.expense}</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldClass}
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
          <div>
            <button
              type="button"
              onClick={() => {
                if (!hasExpenseDraft) {
                  setError(labels.receiptNeedExpense);
                  return;
                }
                document.getElementById(`family-log-receipt-${card.id}`)?.click();
              }}
              className={
                hasExpenseDraft
                  ? 'cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100'
                  : 'cursor-pointer rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400'
              }
            >
              {receiptUploading ? labels.photosUploading : labels.receiptUpload}
            </button>
            <input
              id={`family-log-receipt-${card.id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="sr-only"
              onChange={(e) => {
                if (!hasExpenseDraft) {
                  setError(labels.receiptNeedExpense);
                  e.target.value = '';
                  return;
                }
                void upload(e.target.files, 'family_log_receipt');
                e.target.value = '';
              }}
            />
            {receipts.length > 0 ? (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {receipts.map((receipt) => {
                  const src = receipt.thumbnail_url || receipt.image_url;
                  return (
                    <div key={receipt.id} className="relative">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={receipt.original_filename || labels.receipt} className="h-[72px] w-full rounded-md object-cover" />
                      ) : (
                        <p className="m-0 text-[10px]">{receipt.original_filename}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeFile(receipt, 'family_log_receipt')}
                        disabled={removing || saving || deleting}
                        className="absolute right-1 top-1 h-[18px] w-[18px] cursor-pointer rounded-full border-0 bg-[rgba(239,68,68,0.95)] text-[10px] text-white disabled:opacity-40"
                        aria-label={labels.delete}
                      >
                        x
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          {error ? <p className="m-0 text-xs text-red-700">{error}</p> : null}
        </div>
        <div
          className={
            tone === 'neo'
              ? 'flex shrink-0 flex-wrap items-center gap-2 border-t-2 border-[var(--neo-ink)] p-3'
              : tone === 'glass'
                ? 'flex shrink-0 flex-wrap items-center gap-2 border-t border-white/20 p-3'
                : 'flex shrink-0 flex-wrap items-center gap-2 border-t border-[#eadcc4] p-3'
          }
        >
          <button
            type="button"
            onClick={() => void save()}
            disabled={photoUploading || receiptUploading || removing || saving || deleting}
            title={
              photoUploading || receiptUploading
                ? labels.saveDisabledUploading
                : saving || removing
                  ? labels.saveDisabledSaving
                  : undefined
            }
            className={
              tone === 'neo'
                ? 'cursor-pointer rounded-sm border-2 border-[var(--neo-ink)] bg-[var(--neo-ink)] px-3 py-1.5 text-xs font-bold text-[var(--neo-paper)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none'
                : tone === 'glass'
                  ? 'cursor-pointer rounded-lg border-0 bg-white px-3 py-1.5 text-xs font-semibold text-[#1e1b4b] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500'
                  : 'cursor-pointer rounded-lg border-0 bg-[#7d9a6a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6d8a5a] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300'
            }
          >
            {labels.save}
          </button>
          <button
            type="button"
            disabled={photoUploading || receiptUploading || removing || saving || deleting}
            onClick={() => document.getElementById(`family-log-photos-${card.id}`)?.click()}
            className={actionClass}
          >
            {photoUploading ? labels.photosUploading : labels.photos}
          </button>
          <button
            type="button"
            disabled={photoUploading || receiptUploading || removing || saving || deleting}
            onClick={() => setAlbumOpen(true)}
            className={actionClass}
          >
            {labels.photosAlbum}
          </button>
          <button type="button" onClick={onClose} className={actionClass}>
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={() => void removeCard()}
            disabled={photoUploading || receiptUploading || removing || saving || deleting}
            className={actionClass}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {labels.delete}
          </button>
        </div>
      </div>
      <FamilyAlbumPickerModal
        open={albumOpen}
        onClose={() => setAlbumOpen(false)}
        groupId={groupId}
        attachedImageUrls={photos.map((photo) => photo.image_url)}
        labels={{
          title: labels.photosAlbum,
          close: labels.close,
          empty: labels.photosAlbumEmpty,
          add: labels.photosAlbumAdd,
        }}
        onConfirm={linkAlbum}
      />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
