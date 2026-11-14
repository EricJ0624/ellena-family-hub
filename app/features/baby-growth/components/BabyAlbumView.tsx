'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { uploadFeatureAttachments } from '@/lib/feature-attachments-client';
import { extractExifDate } from '../utils/exif-parser';
import { calcAgeInMonths } from '../utils/age-calculator';
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
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return;

    const { data, error } = await supabase
      .from('attachments')
      .select('id, image_url, thumbnail_url, created_at')
      .eq('group_id', currentGroupId)
      .eq('feature_type', 'baby_growth')
      .like('mime_type', 'image/%')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data) {
      setLoading(false);
      return;
    }

    const birth = new Date(birthDate);
    const map = new Map<number, BabyPhoto[]>();

    for (const row of data as any[]) {
      const takenAt = row.created_at;
      const taken = new Date(takenAt);
      const months = Math.max(
        0,
        Math.floor((taken.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.4))
      );
      const photo: BabyPhoto = {
        id: row.id,
        imageUrl: row.image_url ?? '',
        thumbnailUrl: row.thumbnail_url ?? null,
        takenAt,
        monthAge: months,
      };
      const existing = map.get(months) ?? [];
      existing.push(photo);
      map.set(months, existing);
    }

    // 최신 월령부터 정렬
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
        // EXIF 날짜 추출 — 사용하지 않더라도 나중 UI 확장 위해 보관
        await extractExifDate(file);

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

    // 목록 갱신
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
          accept="image/*,video/*"
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
  const isVideo =
    photo.imageUrl.includes('.mp4') ||
    photo.imageUrl.includes('.mov') ||
    photo.imageUrl.includes('.webm');

  if (isVideo) {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800">
        <video
          src={photo.imageUrl}
          className="w-full h-full object-cover"
          muted
          autoPlay
          loop
          playsInline
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/50 text-white text-xs rounded-full px-2 py-0.5">▶ 1s</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={photo.thumbnailUrl ?? photo.imageUrl}
      alt=""
      loading="lazy"
      className="aspect-square w-full rounded-lg object-cover"
    />
  );
}
