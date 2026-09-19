/**
 * Kids 위치 위젯 오른쪽 위 타원: 앨범에서 이미 로드된 URL만 랜덤 표시.
 * FamilyLocationSection에 useGroup/useLanguage를 넣지 않기 위해 분리.
 *
 * 세로: 저장된 focus_y → FaceDetector → fallback. 미저장 세로만 클릭 1회 조정.
 * 가로: object-center, 클릭 무시.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getViewedAlbumPhotoMeta,
  getViewedAlbumPhotoUrls,
  markAlbumPhotoUrlViewed,
  subscribeViewedAlbumPhotoUrls,
} from '@/lib/album-viewed-photo-urls';
import {
  ALBUM_PHOTO_FOCUS_FALLBACK_Y,
  clampLocationOvalFocusY,
  detectFaceFocusY,
  objectPositionForFocusY,
} from '@/lib/album-photo-focus';
import { useAlbum, type Photo } from '@/app/contexts/AlbumContext';
import { DiaryPhotoFocusModal } from '@/app/features/travel-diary/components/DiaryPhotoFocusModal';
import { getTravelDiaryTranslation } from '@/lib/translations/travel-diary';
import type { LangCode } from '@/lib/language-fonts';

function pickRandomUrl(urls: string[], exclude?: string | null): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  const pool = exclude ? urls.filter((u) => u !== exclude) : urls;
  const list = pool.length > 0 ? pool : urls;
  return list[Math.floor(Math.random() * list.length)] ?? null;
}

function isPortraitDims(width: number, height: number): boolean {
  return height > width && width > 0 && height > 0;
}

function photoIdOf(photo: Photo | null | undefined): string | null {
  if (!photo) return null;
  const raw = photo.supabaseId ?? photo.id;
  if (raw == null || raw === '') return null;
  return String(raw);
}

function findAlbumPhoto(album: Photo[], url: string | null): Photo | null {
  if (!url) return null;
  const exact = album.find((p) => p.data === url);
  if (exact) return exact;
  const needle = url.split('?')[0]?.replace(/\/+$/, '') ?? url;
  return (
    album.find((p) => {
      if (!p.data) return false;
      const cand = p.data.split('?')[0]?.replace(/\/+$/, '') ?? p.data;
      return cand === needle || cand.endsWith(needle) || needle.endsWith(cand);
    }) ?? null
  );
}

type Props = {
  lang: LangCode;
};

export function LocationOvalFromViewedAlbum({ lang }: Props) {
  const { album, albumRef, updatePhotoFocusY } = useAlbum();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [autoFocusY, setAutoFocusY] = useState<number | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusSaving, setFocusSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const detectGenRef = useRef(0);

  const matchedPhoto = useMemo(() => findAlbumPhoto(album, photoUrl), [album, photoUrl]);
  const viewedMeta = photoUrl ? getViewedAlbumPhotoMeta(photoUrl) : undefined;

  const savedFocusY = useMemo(() => {
    if (matchedPhoto && typeof matchedPhoto.focus_y === 'number' && Number.isFinite(matchedPhoto.focus_y)) {
      return matchedPhoto.focus_y;
    }
    if (typeof viewedMeta?.focus_y === 'number' && Number.isFinite(viewedMeta.focus_y)) {
      return viewedMeta.focus_y;
    }
    return null;
  }, [matchedPhoto, viewedMeta?.focus_y]);

  const savedFocusYRef = useRef(savedFocusY);
  savedFocusYRef.current = savedFocusY;

  const displayFocusY = savedFocusY ?? autoFocusY ?? ALBUM_PHOTO_FOCUS_FALLBACK_Y;
  const showAdjustCursor = Boolean(isPortrait && savedFocusY == null && !focusSaving);

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

  const applyImageMetrics = useCallback(async (img: HTMLImageElement, skipFaceDetect: boolean) => {
    const portrait = isPortraitDims(img.naturalWidth, img.naturalHeight);
    setIsPortrait(portrait);
    if (!portrait) {
      setAutoFocusY(null);
      return;
    }
    if (skipFaceDetect || savedFocusYRef.current != null) {
      setAutoFocusY(null);
      return;
    }
    const gen = ++detectGenRef.current;
    const detected = await detectFaceFocusY(img);
    if (gen !== detectGenRef.current) return;
    setAutoFocusY(detected);
  }, []);

  useEffect(() => {
    setFocusOpen(false);
    detectGenRef.current += 1;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      void applyImageMetrics(img, savedFocusYRef.current != null);
    } else {
      setIsPortrait(false);
      setAutoFocusY(null);
    }
  }, [photoUrl, applyImageMetrics]);

  useEffect(() => {
    if (savedFocusY != null) setAutoFocusY(null);
  }, [savedFocusY]);

  const resolvePhotoId = useCallback((): string | null => {
    const photo = findAlbumPhoto(albumRef.current, photoUrl) ?? findAlbumPhoto(album, photoUrl);
    const fromAlbum = photoIdOf(photo);
    if (fromAlbum) return fromAlbum;
    const fromViewed = viewedMeta?.id ?? (photoUrl ? getViewedAlbumPhotoMeta(photoUrl)?.id : undefined);
    if (fromViewed == null || fromViewed === '') return null;
    return String(fromViewed);
  }, [album, albumRef, photoUrl, viewedMeta?.id]);

  const onOvalPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (focusSaving || focusOpen) return;

    const img = imgRef.current;
    const portrait =
      img && img.naturalWidth > 0
        ? isPortraitDims(img.naturalWidth, img.naturalHeight)
        : isPortrait;
    if (!portrait) return;

    // 이미 저장된 focus면 1회 제한 — 모달 안 염
    if (savedFocusYRef.current != null) return;

    // 세로면 모달은 무조건 오픈 (저장 id는 확인 시에 해석)
    setIsPortrait(true);
    setFocusOpen(true);
  };

  const onFocusConfirm = async (y: number) => {
    const photoId = resolvePhotoId();
    if (!photoId) {
      setFocusOpen(false);
      return;
    }
    const focusY = clampLocationOvalFocusY(y);
    setFocusSaving(true);
    try {
      const ok = await updatePhotoFocusY({ photoId, focusY });
      if (ok && photoUrl) {
        markAlbumPhotoUrlViewed(photoUrl, {
          id: photoId,
          focus_y: focusY,
        });
        setAutoFocusY(focusY);
      }
    } finally {
      setFocusSaving(false);
      setFocusOpen(false);
    }
  };

  if (!photoUrl) return null;

  return (
    <>
      <span className="location-oval-from-album">
        <button
          type="button"
          className={`location-oval-from-album-slot${showAdjustCursor ? ' location-oval-from-album-slot--adjustable' : ''}`}
          onPointerUp={onOvalPointerUp}
          onClick={(e) => {
            // pointerUp에서 처리. 확대 오버레이/부모 클릭 전파만 차단
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label={
            showAdjustCursor ? getTravelDiaryTranslation(lang, 'photo_focus_title') : undefined
          }
          tabIndex={0}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={photoUrl}
            alt=""
            draggable={false}
            onLoad={(e) => {
              void applyImageMetrics(e.currentTarget, savedFocusYRef.current != null);
            }}
            className="pointer-events-none block h-full w-full object-cover"
            style={{
              objectPosition: objectPositionForFocusY(displayFocusY, isPortrait),
            }}
          />
        </button>
      </span>

      <DiaryPhotoFocusModal
        open={focusOpen}
        imageUrl={photoUrl}
        initialY={displayFocusY}
        previewVariant="oval"
        title={getTravelDiaryTranslation(lang, 'photo_focus_title')}
        hint={getTravelDiaryTranslation(lang, 'photo_focus_hint')}
        confirmLabel={getTravelDiaryTranslation(lang, 'photo_focus_confirm')}
        skipLabel={getTravelDiaryTranslation(lang, 'photo_focus_skip')}
        onConfirm={(y) => {
          void onFocusConfirm(y);
        }}
        onSkip={() => setFocusOpen(false)}
      />
    </>
  );
}
