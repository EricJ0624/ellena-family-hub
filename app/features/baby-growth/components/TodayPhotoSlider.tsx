'use client';

import React, { useEffect, useState, useRef } from 'react';
import type { BabyPhoto } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { listBabyPhotos } from '../utils/list-baby-photos';

interface TodayPhotoSliderProps {
  babyId: string | null;
  currentGroupId: string | null;
  birthDate: string | null;
  t: BabyGrowthTranslations;
  onOpen?: () => void;
}

export function TodayPhotoSlider({
  babyId,
  currentGroupId,
  birthDate,
  t,
  onOpen,
}: TodayPhotoSliderProps) {
  const [photos, setPhotos] = useState<BabyPhoto[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!babyId || !currentGroupId) return;
    let cancelled = false;

    const load = async () => {
      const mapped = await listBabyPhotos({
        groupId: currentGroupId,
        babyId,
        birthDate,
        todayOnly: true,
        limit: 10,
      });
      if (cancelled) return;
      setPhotos(mapped);
      setCurrentIdx(0);
    };

    void load();
    return () => { cancelled = true; };
  }, [babyId, currentGroupId, birthDate]);

  // 자동 슬라이드
  useEffect(() => {
    if (photos.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % photos.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full h-28 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-xs text-gray-400"
      >
        {t.no_photos}
      </button>
    );
  }

  const photo = photos[currentIdx];

  return (
    <div
      className="w-full relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 cursor-pointer"
      style={{ aspectRatio: '16/9' }}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={photo.id}
        src={photo.thumbnailUrl ?? photo.imageUrl}
        alt=""
        className="w-full h-full object-cover transition-opacity duration-500"
        draggable={false}
      />
      {photo.monthAge !== null && (
        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
          {t.album_month_label.replace('{n}', String(photo.monthAge))}
        </div>
      )}
      {photos.length > 1 && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIdx(i);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentIdx ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
