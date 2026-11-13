'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { BabyPhoto } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { calcAgeInMonths } from '../utils/age-calculator';

interface TodayPhotoSliderProps {
  babyId: string | null;
  currentGroupId: string | null;
  birthDate: string | null;
  t: BabyGrowthTranslations;
}

export function TodayPhotoSlider({
  babyId,
  currentGroupId,
  birthDate,
  t,
}: TodayPhotoSliderProps) {
  const [photos, setPhotos] = useState<BabyPhoto[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!babyId || !currentGroupId) return;
    let cancelled = false;

    const load = async () => {
      const session = await waitForSupabaseSession(supabase);
      if (cancelled || !session?.access_token) return;

      // 오늘 날짜 범위
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('attachments')
        .select('id, image_url, thumbnail_url, created_at')
        .eq('group_id', currentGroupId)
        .eq('feature_type', 'baby_growth')
        .like('mime_type', 'image/%')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (cancelled || error || !data) return;

      const mapped: BabyPhoto[] = data.map((row: any) => ({
        id: row.id,
        imageUrl: row.image_url ?? row.thumbnail_url ?? '',
        thumbnailUrl: row.thumbnail_url ?? null,
        takenAt: row.created_at,
        monthAge: birthDate ? calcAgeInMonths(birthDate) : null,
      }));
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
      <div className="w-full h-28 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-xs text-gray-400">
        {t.no_photos}
      </div>
    );
  }

  const photo = photos[currentIdx];

  return (
    <div className="w-full relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800" style={{ aspectRatio: '16/9' }}>
      <img
        key={photo.id}
        src={photo.thumbnailUrl ?? photo.imageUrl}
        alt=""
        className="w-full h-full object-cover transition-opacity duration-500"
        draggable={false}
      />
      {/* 월령 배지 */}
      {photo.monthAge !== null && (
        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
          {t.album_month_label.replace('{n}', String(photo.monthAge))}
        </div>
      )}
      {/* 인디케이터 */}
      {photos.length > 1 && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
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
