'use client';

import React, { useEffect, useState, useRef } from 'react';
import type { BabyPhoto } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import {
  BABY_PHOTOS_CHANGED,
  listBabyWidgetSliderPhotos,
  type BabyWidgetPhotoSource,
} from '../utils/list-baby-photos';

interface TodayPhotoSliderProps {
  babyId: string | null;
  currentGroupId: string | null;
  birthDate: string | null;
  t: BabyGrowthTranslations;
  onOpen?: () => void;
  /** 스냅 2페이지용 풀높이 */
  fillHeight?: boolean;
}

export function TodayPhotoSlider({
  babyId,
  currentGroupId,
  birthDate,
  t,
  onOpen,
  fillHeight = false,
}: TodayPhotoSliderProps) {
  const [photos, setPhotos] = useState<BabyPhoto[]>([]);
  const [source, setSource] = useState<BabyWidgetPhotoSource>('today');
  const [currentIdx, setCurrentIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!babyId || !currentGroupId) return;
    let cancelled = false;

    const load = async () => {
      const result = await listBabyWidgetSliderPhotos({
        groupId: currentGroupId,
        babyId,
        birthDate,
        limit: 8,
      });
      if (cancelled) return;
      setPhotos(result.photos);
      setSource(result.source);
      setCurrentIdx(0);
    };

    void load();
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ babyId?: string }>).detail;
      if (detail?.babyId && detail.babyId !== babyId) return;
      void load();
    };
    window.addEventListener(BABY_PHOTOS_CHANGED, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(BABY_PHOTOS_CHANGED, onChanged);
    };
  }, [babyId, currentGroupId, birthDate]);

  useEffect(() => {
    if (photos.length <= 1) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setCurrentIdx((prev) => (prev + 1) % photos.length);
    };
    intervalRef.current = setInterval(tick, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [photos.length]);

  const albumLabel = birthDate ? t.album_title : t.prenatal_album_title;
  const title =
    source === 'today'
      ? t.photo_moments_today
      : source === 'this_week'
        ? t.photo_moments_week
        : source === 'this_month'
          ? t.photo_moments_month
          : source === 'other_years'
            ? t.photo_moments_other_years
            : source === 'fallback'
              ? t.photo_moments_recent
              : albumLabel;

  if (photos.length === 0) {
    return (
      <div className={fillHeight ? 'flex h-full min-h-0 flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
        <p className="shrink-0 px-0.5 text-[11px] font-semibold text-slate-500">{albumLabel}</p>
        <button
          type="button"
          onClick={onOpen}
          className={
            fillHeight
              ? 'flex min-h-0 flex-1 items-center justify-center rounded-xl bg-pink-50 text-xs text-gray-400 dark:bg-pink-900/20'
              : 'flex h-28 w-full items-center justify-center rounded-xl bg-pink-50 text-xs text-gray-400 dark:bg-pink-900/20'
          }
        >
          {t.no_photos}
        </button>
      </div>
    );
  }

  const photo = photos[currentIdx];

  return (
    <div className={fillHeight ? 'flex h-full min-h-0 flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
      <p className="shrink-0 px-0.5 text-[11px] font-semibold text-slate-500">{title}</p>
      <div
        className={
          fillHeight
            ? 'relative min-h-0 flex-1 cursor-pointer overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800'
            : 'relative w-full cursor-pointer overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800'
        }
        style={fillHeight ? undefined : { aspectRatio: '16/9' }}
        onClick={onOpen}
        role={onOpen ? 'button' : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.thumbnailUrl ?? photo.imageUrl}
          alt=""
          className="h-full w-full object-cover transition-opacity duration-500"
          draggable={false}
        />
        {photo.monthAge !== null && (
          <div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
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
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === currentIdx ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
