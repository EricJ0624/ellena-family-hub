/**
 * Kids 위치 위젯 오른쪽 위 타원: 앨범에서 이미 로드된 URL만 랜덤 표시.
 * FamilyLocationSection에 useGroup/useLanguage를 넣지 않기 위해 분리.
 * 호스트(inset-0)와 슬롯(% 타원)을 분리 — img가 지도/위젯 전체로 커지지 않게.
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  getViewedAlbumPhotoUrls,
  subscribeViewedAlbumPhotoUrls,
} from '@/lib/album-viewed-photo-urls';

function pickRandomUrl(urls: string[], exclude?: string | null): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  const pool = exclude ? urls.filter((u) => u !== exclude) : urls;
  const list = pool.length > 0 ? pool : urls;
  return list[Math.floor(Math.random() * list.length)] ?? null;
}

export function LocationOvalFromViewedAlbum() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const syncPick = () => {
      const urls = getViewedAlbumPhotoUrls();
      setPhotoUrl((prev) => {
        if (prev && urls.includes(prev)) return prev;
        return pickRandomUrl(urls, prev);
      });
    };
    syncPick();
    return subscribeViewedAlbumPhotoUrls(syncPick);
  }, []);

  if (!photoUrl) return null;

  return (
    <span className="location-oval-from-album pointer-events-none" aria-hidden>
      <span className="location-oval-from-album-slot">
        {/* 앨범에서 이미 onLoad 된 URL — 브라우저 캐시 재사용 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt=""
          draggable={false}
          className="block h-full w-full object-cover object-center"
        />
      </span>
    </span>
  );
}
