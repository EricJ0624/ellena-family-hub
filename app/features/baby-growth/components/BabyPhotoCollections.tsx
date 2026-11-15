'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BabyPhoto } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import {
  buildPhotoCollections,
  collectionTitle,
  orderCollectionPhotos,
  type PhotoCollection,
} from '../utils/build-photo-collections';
import { exportSlideshowVideo } from '../utils/export-slideshow-video';
import { imageFilesFromUrls, shareResult } from '@/lib/share/share-result';

const PLAY_INTERVAL_MS = 1000;

type PlayMode = 'highlight' | 'random';
type SlideEffect = 'fade' | 'slide';

type Props = {
  open: boolean;
  onClose: () => void;
  photos: BabyPhoto[];
  t: BabyGrowthTranslations;
};

export function BabyPhotoCollections({ open, onClose, photos, t }: Props) {
  const collections = useMemo(() => buildPhotoCollections(photos), [photos]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>('highlight');
  const [slideEffect, setSlideEffect] = useState<SlideEffect>('fade');
  const [slideIdx, setSlideIdx] = useState(0);
  const [videoBusy, setVideoBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  const active: PhotoCollection | null = useMemo(
    () => (activeId ? collections.find((c) => c.id === activeId) ?? null : null),
    [activeId, collections],
  );

  const playList = useMemo(() => {
    if (!active) return [] as BabyPhoto[];
    return orderCollectionPhotos(active.photos, playMode);
  }, [active, playMode]);

  useEffect(() => {
    if (!open) {
      setActiveId(null);
      setSlideIdx(0);
      setVideoBusy(false);
      setShareBusy(false);
      setPlayError(null);
    }
  }, [open]);

  useEffect(() => {
    if (activeId && !collections.some((c) => c.id === activeId)) {
      setActiveId(null);
    }
  }, [activeId, collections]);

  useEffect(() => {
    setSlideIdx(0);
    setPlayError(null);
  }, [activeId, playMode]);

  useEffect(() => {
    if (slideIdx > 0 && slideIdx >= playList.length) {
      setSlideIdx(0);
    }
  }, [playList.length, slideIdx]);

  useEffect(() => {
    if (!active || playList.length === 0 || videoBusy || shareBusy) return;
    const timer = setInterval(() => {
      setSlideIdx((i) => (i + 1) % playList.length);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, playList.length, videoBusy, shareBusy]);

  const titleOf = (c: PhotoCollection) =>
    collectionTitle(c, {
      day: t.album_collection_day,
      week: t.album_collection_week,
      month: t.album_collection_month,
    });

  const handleSharePhotos = async () => {
    if (!active || shareBusy || videoBusy || playList.length === 0) return;
    setShareBusy(true);
    setPlayError(null);
    try {
      const title = titleOf(active);
      const files = await imageFilesFromUrls(playList.map((p) => p.imageUrl));
      await shareResult({ title, text: title, files });
    } catch (err) {
      console.error('[BabyPhotoCollections] share:', err);
      setPlayError(err instanceof Error ? err.message : t.error_save);
    } finally {
      setShareBusy(false);
    }
  };

  const handleSaveVideo = async () => {
    if (!active || videoBusy || shareBusy || playList.length === 0) return;
    setVideoBusy(true);
    setPlayError(null);
    try {
      await exportSlideshowVideo({
        urls: playList.map((p) => p.imageUrl),
        intervalMs: PLAY_INTERVAL_MS,
        effect: slideEffect,
        fileName: `baby-collection-${Date.now()}.webm`,
      });
    } catch (err) {
      console.error('[BabyPhotoCollections] video export:', err);
      setPlayError(err instanceof Error ? err.message : t.error_save);
    } finally {
      setVideoBusy(false);
    }
  };

  if (!open) return null;

  const current = playList[slideIdx] ?? playList[0] ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black/95 text-white">
      {!active ? (
        <>
          <div className="flex shrink-0 items-center gap-2 px-4 py-3">
            <h2 className="mr-auto text-sm font-semibold">{t.album_collections}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
            >
              {t.close}
            </button>
          </div>
          {collections.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-white/60">
              {t.album_collection_empty}
            </div>
          ) : (
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-6">
              {collections.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-white/10 p-2.5 text-left transition-colors hover:bg-white/15"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.coverUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{titleOf(c)}</span>
                      <span className="text-[11px] text-white/60">
                        {t.album_collection_count.replace('{n}', String(c.photos.length))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold"
            >
              ←
            </button>
            <span className="mr-auto min-w-0 truncate text-xs font-semibold">{titleOf(active)}</span>
            <span className="tabular-nums text-[11px] text-white/70">
              {playList.length === 0 ? '0/0' : `${Math.min(slideIdx, playList.length - 1) + 1}/${playList.length}`}
            </span>
            <label className="flex items-center gap-1 text-[11px] text-white/80">
              {t.album_collection_mode}
              <select
                value={playMode}
                onChange={(e) => setPlayMode(e.target.value as PlayMode)}
                className="rounded-md border-0 bg-white/15 px-2 py-1 text-[11px] text-white"
              >
                <option value="highlight">{t.album_collection_highlight}</option>
                <option value="random">{t.album_collection_random}</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-[11px] text-white/80">
              {t.album_collection_effect}
              <select
                value={slideEffect}
                onChange={(e) => setSlideEffect(e.target.value as SlideEffect)}
                className="rounded-md border-0 bg-white/15 px-2 py-1 text-[11px] text-white"
              >
                <option value="fade">{t.album_collection_effect_fade}</option>
                <option value="slide">{t.album_collection_effect_slide}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={shareBusy || videoBusy || playList.length === 0}
              onClick={() => {
                void handleSharePhotos();
              }}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
            >
              {shareBusy ? '...' : t.report_share}
            </button>
            <button
              type="button"
              disabled={videoBusy || shareBusy || playList.length === 0}
              onClick={() => {
                void handleSaveVideo();
              }}
              className="rounded-full bg-pink-500 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {videoBusy ? t.album_collection_saving_video : t.album_collection_save_video}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
            >
              {t.close}
            </button>
          </div>
          {playError && (
            <p className="px-4 pb-2 text-xs text-red-300">{playError}</p>
          )}
          <div className="relative min-h-0 w-full flex-1 overflow-hidden">
            {current && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${current.id}-${slideEffect}-${slideIdx}-${playMode}`}
                src={current.imageUrl}
                alt=""
                className={`absolute inset-0 h-full w-full object-contain ${
                  slideEffect === 'fade'
                    ? 'animate-[sfh-col-fade_0.45s_ease]'
                    : 'animate-[sfh-col-slide_0.45s_ease]'
                }`}
              />
            )}
          </div>
          <style>{`
            @keyframes sfh-col-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes sfh-col-slide { from { opacity: 0.2; transform: translateX(8%); } to { opacity: 1; transform: translateX(0); } }
          `}</style>
        </>
      )}
    </div>,
    document.body,
  );
}
