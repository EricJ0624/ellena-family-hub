'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { deleteAttachment, uploadFeatureAttachments } from '@/lib/feature-attachments-client';
import { listBabyPhotos, notifyBabyPhotosChanged } from '../utils/list-baby-photos';
import type { BabyPhoto } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { BabyPrintAlbumEditor } from './BabyPrintAlbumEditor';

interface BabyAlbumViewProps {
  babyId: string;
  currentGroupId: string | null;
  birthDate: string;
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
  const [slideshow, setSlideshow] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [printOpen, setPrintOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!currentGroupId) return;

    const photos = await listBabyPhotos({
      groupId: currentGroupId,
      babyId,
      birthDate,
      limit: 200,
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

  useEffect(() => {
    if (photoCount === 0) {
      setSlideshow(false);
      setPrintOpen(false);
      return;
    }
    if (slideIdx >= photoCount) setSlideIdx(photoCount - 1);
  }, [photoCount, slideIdx]);

  useEffect(() => {
    if (!slideshow || photoCount === 0) return;
    const timer = setInterval(() => {
      setSlideIdx((i) => (i + 1) % photoCount);
    }, 1000);
    return () => clearInterval(timer);
  }, [slideshow, photoCount]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
        {t.loading}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">{t.album_title}</h2>
          <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            👨‍👩‍👧 그룹 공유 중
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
            onClick={() => { setSlideIdx(0); setSlideshow(true); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-white text-xs font-semibold shadow-sm"
          >
            🎬 {t.album_slideshow}
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
        defaultTitle={t.album_title}
        t={t}
      />

      {slideshow && allPhotos[slideIdx] && createPortal(
        <div className="fixed inset-0 z-[10000] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white">
            <span>{slideIdx + 1}/{allPhotos.length}</span>
            <button
              type="button"
              onClick={() => setSlideshow(false)}
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
            >
              {t.close}
            </button>
          </div>
          <img
            src={allPhotos[slideIdx].imageUrl}
            alt=""
            className="min-h-0 w-full flex-1 object-contain"
          />
        </div>,
        document.body,
      )}

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
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((photo) => (
                <PhotoThumb
                  key={photo.id}
                  photo={photo}
                  label={t.delete}
                  deleting={deletingId === photo.id}
                  onDelete={() => { void handleDelete(photo); }}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function PhotoThumb({
  photo,
  label,
  deleting,
  onDelete,
}: {
  photo: BabyPhoto;
  label: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnailUrl ?? photo.imageUrl}
        alt=""
        loading="lazy"
        className="aspect-square w-full rounded-lg object-cover"
      />
      <button
        type="button"
        disabled={deleting}
        onClick={onDelete}
        className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
