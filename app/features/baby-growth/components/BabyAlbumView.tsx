'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { uploadFeatureAttachments } from '@/lib/feature-attachments-client';
import { listBabyPhotos } from '../utils/list-baby-photos';
import type { BabyPhoto } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface BabyAlbumViewProps {
  babyId: string;
  currentGroupId: string | null;
  birthDate: string;
  userId: string;
  t: BabyGrowthTranslations;
}

type GroupedPhotos = Map<number, BabyPhoto[]>; // key = monthAge

export function BabyAlbumView({
  babyId,
  currentGroupId,
  birthDate,
  userId: _userId,
  t,
}: BabyAlbumViewProps) {
  const [grouped, setGrouped] = useState<GroupedPhotos>(new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!currentGroupId) return;

    const photos = await listBabyPhotos({
      groupId: currentGroupId,
      babyId,
      birthDate,
      limit: 200,
    });

    const map = new Map<number, BabyPhoto[]>();
    for (const photo of photos) {
      const months = photo.monthAge ?? 0;
      const existing = map.get(months) ?? [];
      existing.push(photo);
      map.set(months, existing);
    }

    const sorted = new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
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
    setUploading(false);
    e.target.value = '';
  };

  const allPhotos = [...grouped.values()].flat();
  const photoCount = allPhotos.length;

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

  const printAlbum = () => {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    const imgs = allPhotos
      .map((p) => `<img src="${p.imageUrl}" alt="" style="width:100%;max-width:720px;display:block;margin:0 auto 12px;border-radius:12px" />`)
      .join('');
    win.document.write(`<!doctype html><html><head><title>${t.album_print}</title></head><body style="margin:0;padding:16px;font-family:sans-serif"><h1>${t.album_title}</h1>${imgs}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">{t.album_title}</h2>
          {/* 가족 공유 뱃지 */}
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
            onClick={printAlbum}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold shadow-sm"
          >
            📖 {t.album_print}
          </button>
        </div>
      )}

      {slideshow && allPhotos[slideIdx] && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col" onClick={() => setSlideshow(false)}>
          <div className="flex items-center justify-between px-4 py-3 text-white text-sm">
            <span>{t.album_slideshow}</span>
            <span>{slideIdx + 1}/{allPhotos.length}</span>
          </div>
          <img
            src={allPhotos[slideIdx].imageUrl}
            alt=""
            className="flex-1 min-h-0 w-full object-contain"
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
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              {t.album_month_label.replace('{n}', String(months))}
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((photo) => (
                <PhotoThumb key={photo.id} photo={photo} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function PhotoThumb({ photo }: { photo: BabyPhoto }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.thumbnailUrl ?? photo.imageUrl}
      alt=""
      loading="lazy"
      className="aspect-square w-full rounded-lg object-cover"
    />
  );
}
