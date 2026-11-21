'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { deleteAttachment, uploadFeatureAttachments } from '@/lib/feature-attachments-client';
import { listBabyPhotos, notifyBabyPhotosChanged } from '../utils/list-baby-photos';
import type { BabyPhoto } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { BabyPrintAlbumEditor } from './BabyPrintAlbumEditor';
import { BabyPhotoCollections } from './BabyPhotoCollections';

interface BabyAlbumViewProps {
  babyId: string;
  currentGroupId: string | null;
  birthDate: string | null;
  t: BabyGrowthTranslations;
}

type GroupedPhotos = Map<number | 'none', BabyPhoto[]>;

export function BabyAlbumView({
  babyId,
  currentGroupId,
  birthDate,
  t,
}: BabyAlbumViewProps) {
  const [grouped, setGrouped] = useState<GroupedPhotos>(new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const albumLabel = birthDate ? t.album_title : t.prenatal_album_title;

  const load = async () => {
    if (!currentGroupId) return;

    const photos = await listBabyPhotos({
      groupId: currentGroupId,
      babyId,
      birthDate,
      limit: 500,
    });

    const map = new Map<number | 'none', BabyPhoto[]>();
    for (const photo of photos) {
      const months = photo.monthAge === null ? 'none' : photo.monthAge;
      const existing = map.get(months) ?? [];
      existing.push(photo);
      map.set(months, existing);
    }

    const sorted = new Map(
      [...map.entries()].sort((a, b) => {
        if (a[0] === 'none') return 1;
        if (b[0] === 'none') return -1;
        return b[0] - a[0];
      }),
    );
    setGrouped(sorted);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId, currentGroupId, birthDate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !currentGroupId) return;
    setUploading(true);

    for (const file of files) {
      try {
        await uploadFeatureAttachments({
          groupId: currentGroupId,
          featureType: 'baby_growth',
          entityType: 'baby_profile',
          entityId: babyId,
          files: [file],
        });
      } catch (err) {
        console.error('[BabyAlbumView] 업로드 오류:', err);
      }
    }

    await load();
    notifyBabyPhotosChanged(babyId);
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (photo: BabyPhoto) => {
    if (!currentGroupId || deletingId) return;
    if (!window.confirm(t.delete_photo_confirm)) return;
    setDeletingId(photo.id);
    setDeleteError(null);
    try {
      await deleteAttachment(currentGroupId, photo.id);
      notifyBabyPhotosChanged(babyId);
      await load();
    } catch (err) {
      console.error('[BabyAlbumView] 삭제 오류:', err);
      setDeleteError(err instanceof Error ? err.message : t.delete);
    } finally {
      setDeletingId(null);
    }
  };

  const allPhotos = useMemo(() => [...grouped.values()].flat(), [grouped]);
  const photoCount = allPhotos.length;
  const photoIndexById = useMemo(() => {
    const map = new Map<string, number>();
    allPhotos.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [allPhotos]);
  const viewerPhoto =
    viewerIdx != null && viewerIdx >= 0 && viewerIdx < allPhotos.length
      ? allPhotos[viewerIdx]!
      : null;

  useEffect(() => {
    if (photoCount === 0) {
      setCollectionsOpen(false);
      setPrintOpen(false);
      return;
    }
    if (viewerIdx != null && viewerIdx >= photoCount) setViewerIdx(photoCount - 1);
  }, [photoCount, viewerIdx]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-xs text-gray-400">
        {t.loading}
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-y-contain p-4"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            👨‍👩‍👧 {t.album_group_shared}
          </span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
        >
          {uploading ? '...' : `+ ${t.upload_photo}`}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}

      {allPhotos.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCollectionsOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-white text-xs font-semibold shadow-sm"
          >
            🎬 {t.album_collections}
          </button>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold shadow-sm"
          >
            📖 {t.album_print}
          </button>
        </div>
      )}

      <BabyPrintAlbumEditor
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        babyId={babyId}
        currentGroupId={currentGroupId}
        photos={allPhotos}
        defaultTitle={albumLabel}
        t={t}
      />

      <BabyPhotoCollections
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        photos={allPhotos}
        t={t}
      />

      {grouped.size === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
          <span className="text-4xl">📷</span>
          <p className="text-sm text-gray-400">{t.no_photos}</p>
        </div>
      ) : (
        [...grouped.entries()].map(([months, photos]) => (
          <section key={months}>
            {months !== 'none' && (
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                {t.album_month_label.replace('{n}', String(months))}
              </h3>
            )}
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {photos.map((photo) => (
                <PhotoThumb
                  key={photo.id}
                  photo={photo}
                  label={t.delete}
                  deleting={deletingId === photo.id}
                  onOpen={() => setViewerIdx(photoIndexById.get(photo.id) ?? 0)}
                  onDelete={() => { void handleDelete(photo); }}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {viewerPhoto && viewerIdx != null && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={albumLabel}
        >
          <div className="flex shrink-0 items-center gap-2 px-4 py-3 text-white">
            <span className="mr-auto text-sm tabular-nums text-white/80">
              {viewerIdx + 1}/{photoCount}
            </span>
            {viewerPhoto.monthAge != null && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                {t.album_month_label.replace('{n}', String(viewerPhoto.monthAge))}
              </span>
            )}
            <button
              type="button"
              onClick={() => setViewerIdx(null)}
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
            >
              {t.close}
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {photoCount > 1 && (
              <button
                type="button"
                aria-label="prev"
                onClick={() =>
                  setViewerIdx((i) => (i == null ? 0 : (i - 1 + photoCount) % photoCount))
                }
                className="absolute left-2 z-[1] rounded-full bg-white/15 px-3 py-2 text-lg text-white"
              >
                ‹
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={viewerPhoto.id}
              src={viewerPhoto.imageUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
            {photoCount > 1 && (
              <button
                type="button"
                aria-label="next"
                onClick={() =>
                  setViewerIdx((i) => (i == null ? 0 : (i + 1) % photoCount))
                }
                className="absolute right-2 z-[1] rounded-full bg-white/15 px-3 py-2 text-lg text-white"
              >
                ›
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function PhotoThumb({
  photo,
  label,
  deleting,
  onOpen,
  onDelete,
}: {
  photo: BabyPhoto;
  label: string;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="m-0 block w-full border-0 bg-transparent p-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbnailUrl ?? photo.imageUrl}
          alt=""
          loading="lazy"
          className="aspect-square w-full rounded-lg object-cover"
        />
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
