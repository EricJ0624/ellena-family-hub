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
  const [comingSoonOpen, setComingSoonOpen] = useState(false); // CTA 모달
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
        {t.loading}
      </div>
    );
  }

  // 전체 사진 수
  const totalPhotos = [...grouped.values()].reduce((s, arr) => s + arr.length, 0);

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

      {/* 1초 영상 / 포토북 CTA — 사진 10장 이상 시 표시 */}
      {totalPhotos >= 10 && (
        <div className="flex gap-2">
          <button
            onClick={() => setComingSoonOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-white text-xs font-semibold shadow-sm"
          >
            🎬 추억 영상 만들기
          </button>
          <button
            onClick={() => setComingSoonOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold shadow-sm"
          >
            📖 포토북 주문
          </button>
        </div>
      )}

      {/* Coming Soon 모달 */}
      {comingSoonOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={() => setComingSoonOpen(false)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-xs w-full mx-4 text-center">
            <div className="text-4xl mb-3">🚀</div>
            <h3 className="text-base font-bold mb-2">준비 중입니다</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              1초 영상 모음집과 포토북 인쇄 기능은 곧 제공될 예정입니다.
              <br />사진을 계속 모아두세요! 📸
            </p>
            <button
              onClick={() => setComingSoonOpen(false)}
              className="bg-pink-500 text-white text-sm font-semibold px-6 py-2 rounded-xl"
            >
              확인
            </button>
          </div>
        </div>,
        document.body
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
