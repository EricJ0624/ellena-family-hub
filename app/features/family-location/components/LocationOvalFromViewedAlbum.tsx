/**
 * Kids 위치 위젯 오른쪽 위 타원: 앨범에서 이미 로드된 URL만 랜덤 표시.
 * FamilyLocationSection에 useGroup/useLanguage를 넣지 않기 위해 분리.
 * 호스트(inset-0)와 슬롯(% 타원)을 분리 — img가 지도/위젯 전체로 커지지 않게.
 *
 * 세로 사진은 상단 22% 기준(인물·얼굴 우선)으로 크롭한다. 가로는 object-center 유지.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
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

function isPortraitImage(img: HTMLImageElement): boolean {
  return img.naturalHeight > img.naturalWidth;
}

export function LocationOvalFromViewedAlbum() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

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

  useEffect(() => {
    setIsPortrait(false);
    const img = imgRef.current;
    // 캐시 hit 등으로 onLoad가 이미 지난 경우 비율을 즉시 반영
    if (img && img.complete && img.naturalWidth > 0) {
      setIsPortrait(isPortraitImage(img));
    }
  }, [photoUrl]);

  if (!photoUrl) return null;

  return (
    <span className="location-oval-from-album pointer-events-none" aria-hidden>
      <span className="location-oval-from-album-slot">
        {/* 앨범에서 이미 onLoad 된 URL — 브라우저 캐시 재사용 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={photoUrl}
          alt=""
          draggable={false}
          onLoad={(e) => {
            setIsPortrait(isPortraitImage(e.currentTarget));
          }}
          className={`block h-full w-full object-cover ${
            isPortrait ? 'object-[center_22%]' : 'object-center'
          }`}
        />
      </span>
    </span>
  );
}
