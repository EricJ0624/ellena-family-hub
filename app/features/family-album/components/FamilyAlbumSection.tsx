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
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#8b5cf6',
            color: '#fff',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          📸 {t.view_all}
          {photos.length > 0 && ` (${photos.length})`}
        </button>
      </div>
      <div className="section-body">
        {displayPhotos.length === 0 ? (
          <p
            style={{
              fontSize: '13px',
              color: '#64748b',
              textAlign: 'center',
              padding: '32px 16px',
            }}
          >
            {t.empty_state}
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '8px',
              padding: '4px',
            }}
          >
            {displayPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={onPhotoClick || onViewAllClick}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  backgroundColor: '#f1f5f9',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img
                  src={photo.data}
                  alt={photo.description || ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  loading="lazy"
                />
                {photo.isUploading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    업로드 중...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onViewAllClick}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {t.photos_count.replace('{count}', String(photos.length - maxPhotos))}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
