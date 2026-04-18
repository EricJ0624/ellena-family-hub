/**
 * 가족 앨범(Family Album) 섹션 컴포넌트
 * Dashboard용 간단한 사진 그리드 뷰
 */

'use client';

import React from 'react';
import type { Photo } from '@/app/contexts/AlbumContext';

interface FamilyAlbumSectionProps {
  photos: Photo[];
  onPhotoClick?: () => void;
  onViewAllClick: () => void;
  maxPhotos?: number;
  translations: {
    section_title: string;
    view_all: string;
    empty_state: string;
    photos_count: string;
  };
}

export function FamilyAlbumSection({
  photos,
  onPhotoClick,
  onViewAllClick,
  maxPhotos = 9,
  translations: t,
}: FamilyAlbumSectionProps) {
  const displayPhotos = photos.slice(0, maxPhotos);
  const hasMore = photos.length > maxPhotos;

  return (
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title">{t.section_title}</h3>
        <button
          type="button"
          onClick={onViewAllClick}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#8b5cf6] px-3 py-2 text-xs font-bold text-white"
        >
          📸 {t.view_all}
          {photos.length > 0 && ` (${photos.length})`}
        </button>
      </div>
      <div className="section-body">
        {displayPhotos.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[#64748b]">
            {t.empty_state}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 p-1">
            {displayPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={onPhotoClick || onViewAllClick}
                className="relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-[#f1f5f9] transition-[transform,box-shadow] duration-200 ease-in-out hover:scale-105 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
              >
                <img
                  src={photo.data}
                  alt={photo.description || ''}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {photo.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold text-white">
                    업로드 중...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onViewAllClick}
              className="cursor-pointer rounded-lg border border-solid border-[#cbd5e1] bg-[#f8fafc] px-5 py-2.5 text-[13px] font-semibold text-[#475569]"
            >
              {t.photos_count.replace('{count}', String(photos.length - maxPhotos))}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
