/**
 * 가족 앨범 위젯 — 펼친 스크랩북 + 쪽 넘김
 * 사진은 프레임리스 라운드 그리드. 한 쪽 9장(3×3), 한 펼침 18장.
 * 표지는 빈 스크랩북 PNG, 사진은 속지 칸 위에 올린다.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { markAlbumPhotoUrlViewed } from '@/lib/album-viewed-photo-urls';
import type { Photo } from '../types';

interface FamilyAlbumSectionProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  onViewAllClick: () => void;
  translations: {
    section_title: string;
    view_all: string;
    empty_state: string;
  };
}

const PHOTOS_PER_PAGE = 9;
const PHOTOS_PER_SPREAD = PHOTOS_PER_PAGE * 2;

export function AlbumPageDoodles() {
  return (
    <svg className="album-book-doodles" viewBox="0 0 1500 1000" aria-hidden>
      <path d="M196 198c0-11 8-20 19-20 7 0 13 4 16 10 3-6 9-10 16-10 11 0 19 9 19 20 0 22-35 42-35 42s-35-20-35-42z" />
      <path d="M418 718c0-9 7-16 15-16 6 0 10 3 13 8 3-5 7-8 13-8 8 0 15 7 15 16 0 18-28 34-28 34s-28-16-28-34z" />
      <path d="M248 486c0-8 6-14 13-14 5 0 9 3 11 7 2-4 6-7 11-7 7 0 13 6 13 14 0 16-24 30-24 30s-24-14-24-30z" />
      <path d="M828 196c0-11 8-20 19-20 7 0 13 4 16 10 3-6 9-10 16-10 11 0 19 9 19 20 0 22-35 42-35 42s-35-20-35-42z" />
      <path d="M972 478c0-10 8-18 17-18 6 0 12 4 14 9 2-5 8-9 14-9 9 0 17 8 17 18 0 20-31 38-31 38s-31-18-31-38z" />
      <path d="M1088 708c0-9 7-16 15-16 6 0 10 3 13 8 3-5 7-8 13-8 8 0 15 7 15 16 0 18-28 34-28 34s-28-16-28-34z" />
      <path d="M990 692c0-7 5-12 11-12 4 0 8 2 10 6 2-4 6-6 10-6 6 0 11 5 11 12 0 14-21 26-21 26s-21-12-21-26z" />
      <path d="M338 176l6 17 18 1-14 11 5 17-15-10-15 10 5-17-14-11 18-1z" />
      <path d="M358 164l4 11 12 1-9 7 3 11-10-7-10 7 3-11-9-7 12-1z" />
      <path d="M320 158l3 9 10 .8-8 6 3 9-8-5-8 5 3-9-8-6 10-.8z" />
      <circle cx="348" cy="154" r="2.2" />
      <circle cx="368" cy="186" r="1.8" />
      <path d="M186 442l5 14 15 1-12 9 4 14-12-8-12 8 4-14-12-9 15-1z" />
      <path d="M204 428l3 10 11 .8-8 6 3 10-9-6-9 6 3-10-8-6 11-.8z" />
      <path d="M172 426l3 8 9 .6-7 5 2 8-7-5-7 5 2-8-7-5 9-.6z" />
      <circle cx="196" cy="418" r="1.8" />
      <path d="M352 738l5 13 14 1-11 8 4 13-12-8-12 8 4-13-11-8 14-1z" />
      <path d="M1124 182l6 17 18 1-14 11 5 17-15-10-15 10 5-17-14-11 18-1z" />
      <path d="M1146 170l4 11 12 1-9 7 3 11-10-7-10 7 3-11-9-7 12-1z" />
      <path d="M1106 166l3 9 10 .8-8 6 3 9-8-5-8 5 3-9-8-6 10-.8z" />
      <circle cx="1136" cy="160" r="2.2" />
      <circle cx="1156" cy="194" r="1.8" />
    </svg>
  );
}

function photoAlt(photo: Photo): string {
  const text = photo.description?.trim();
  if (text) return text;
  if (!photo.taken_at) return '';
  const year = new Date(photo.taken_at).getFullYear();
  return Number.isFinite(year) ? String(year) : '';
}

function AlbumTile({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const alt = photoAlt(photo);
  return (
    <button type="button" onClick={onOpen} className="album-tile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.data}
        alt={alt}
        loading="lazy"
        draggable={false}
        onLoad={() => markAlbumPhotoUrlViewed(photo.data)}
      />
      {photo.isUploading ? (
        <span className="album-tile-uploading">업로드 중...</span>
      ) : null}
    </button>
  );
}

function AlbumPageGrid({
  photos,
  onOpen,
}: {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="album-book-grid">
      {photos.map((photo) => (
        <AlbumTile key={photo.id} photo={photo} onOpen={() => onOpen(photo)} />
      ))}
    </div>
  );
}

export function FamilyAlbumSection({
  photos,
  onPhotoClick,
  onViewAllClick,
  translations: t,
}: FamilyAlbumSectionProps) {
  const spreadCount = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_SPREAD));
  const [page, setPage] = useState(0);
  const [flipDir, setFlipDir] = useState<'next' | 'prev'>('next');

  useEffect(() => {
    setPage((prev) => {
      const max = Math.max(0, spreadCount - 1);
      return prev > max ? max : prev;
    });
  }, [spreadCount]);

  const start = page * PHOTOS_PER_SPREAD;
  const spread = photos.slice(start, start + PHOTOS_PER_SPREAD);
  const left = spread.slice(0, PHOTOS_PER_PAGE);
  const right = spread.slice(PHOTOS_PER_PAGE, PHOTOS_PER_SPREAD);
  const canPrev = page > 0;
  const canNext = page < spreadCount - 1 && photos.length > 0;

  const openPhoto = (photo: Photo) => {
    if (onPhotoClick) onPhotoClick(photo);
    else onViewAllClick();
  };

  return (
    <section className="content-section album-widget-section">
      <div className="album-book-stage">
        <button
          type="button"
          className="album-book-nav album-book-nav--prev"
          disabled={!canPrev}
          aria-label="이전 페이지"
          onClick={() => {
            if (!canPrev) return;
            setFlipDir('prev');
            setPage((prev) => Math.max(0, prev - 1));
          }}
        >
          ‹
        </button>
        <div className="album-book-cover">
          <div className="album-book-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="album-book-art"
              src="/family-album/spread-frame.png?v=2"
              alt=""
              draggable={false}
            />
            <h3 className="album-book-title">{t.section_title}</h3>
            <div key={page} className={`album-book-spread album-book-spread--${flipDir}`}>
              <div className="album-book-page album-book-page--left">
                {photos.length === 0 ? (
                  <p className="album-book-empty">{t.empty_state}</p>
                ) : (
                  <AlbumPageGrid photos={left} onOpen={openPhoto} />
                )}
              </div>
              <div className="album-book-page album-book-page--right">
                <AlbumPageGrid photos={right} onOpen={openPhoto} />
              </div>
            </div>
            <AlbumPageDoodles />
          </div>
        </div>
        <button
          type="button"
          className="album-book-nav album-book-nav--next"
          disabled={!canNext}
          aria-label="다음 페이지"
          onClick={() => {
            if (!canNext) return;
            setFlipDir('next');
            setPage((prev) => Math.min(spreadCount - 1, prev + 1));
          }}
        >
          ›
        </button>
      </div>
      <div className="album-book-footer">
        {photos.length > 0 ? (
          <span className="album-book-pager">
            {page + 1} / {spreadCount}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onViewAllClick}
          className="album-widget-view-all inline-flex cursor-pointer items-center justify-center border-0 font-bold text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
        >
          📸 {t.view_all}
          {photos.length > 0 && ` (${photos.length})`}
        </button>
      </div>
    </section>
  );
}
