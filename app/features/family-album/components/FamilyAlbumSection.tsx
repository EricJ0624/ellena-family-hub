/**
 * 가족 앨범(Family Album) 섹션 컴포넌트
 * Dashboard용 가로 스크롤 사진 그리드 뷰
 * rowSpan 기반으로 사진 행 수(1~3행) 자동 결정
 */

'use client';

import React from 'react';
import type { Photo } from '../types';

interface FamilyAlbumSectionProps {
  photos: Photo[];
  onPhotoClick?: () => void;
  onViewAllClick: () => void;
  rowSpan?: number;
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
  rowSpan,
  translations: t,
}: FamilyAlbumSectionProps) {
  // rowSpan 기반으로 사진 행 수 결정
  // rowSpan ≤ 6 (S/M): 1행, rowSpan 7-10: 2행, rowSpan ≥ 11 (L 이상): 3행
  const photoRows = rowSpan && rowSpan >= 11 ? 3 : rowSpan && rowSpan >= 7 ? 2 : 1;

  return (
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title">{t.section_title}</h3>
        <button
          type="button"
          onClick={onViewAllClick}
          className="inline-flex cursor-pointer items-center rounded-lg border-0 bg-[#8b5cf6] font-bold text-white transition-colors hover:bg-[#7c3aed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
          style={{ gap: '1.5cqmin', padding: '2cqmin 3cqmin', fontSize: '4cqmin' }}
        >
          📸 {t.view_all}
          {photos.length > 0 && ` (${photos.length})`}
        </button>
      </div>
      <div className="section-body">
        {photos.length === 0 ? (
          <p className="text-center text-[#64748b]" style={{ padding: '8cqmin 4cqmin', fontSize: '5cqmin' }}>
            {t.empty_state}
          </p>
        ) : (
          <div
            className="album-photo-grid"
            data-rows={String(photoRows)}
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={onPhotoClick || onViewAllClick}
                className="album-photo-cell relative cursor-pointer overflow-hidden rounded-lg bg-[#f1f5f9] transition-[transform,box-shadow,filter] duration-200 ease-in-out hover:scale-105 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:brightness-105"
              >
                <img
                  src={photo.data}
                  alt={photo.description || ''}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {photo.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 font-semibold text-white" style={{ fontSize: '4cqmin' }}>
                    업로드 중...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
