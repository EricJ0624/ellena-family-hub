/**
 * 가족 앨범(Family Album) 섹션 컴포넌트
 * Dashboard용 위챗식 썸네일 그리드
 * - 기본 위젯: 5×2 슬롯 기준으로 ~10장 맞춤 (스크롤 없음)
 * - 10장 초과: 열/행을 늘리고 칸을 줄여 위젯 안에 모두 표시
 * - 모든 칸은 동일 정사각(px 고정). 세로는 contain으로 칸 안에만 맞춤
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Photo } from '../types';

interface FamilyAlbumSectionProps {
  photos: Photo[];
  onPhotoClick?: () => void;
  onViewAllClick: () => void;
  /** @deprecated 레이아웃은 사진 수 기반으로 결정. 호출부 호환용으로 유지 */
  rowSpan?: number;
  translations: {
    section_title: string;
    view_all: string;
    empty_state: string;
    photos_count: string;
  };
}

const ALBUM_GAP_PX = 6;
const ALBUM_THUMB_MIN_PX = 28;

/** 위젯 영역에 맞출 그리드(열×행). ≤10은 항상 5×2 슬롯 크기로 맞춤 */
function getAlbumGridLayout(count: number): { cols: number; rows: number } {
  if (count <= 10) return { cols: 5, rows: 2 };
  const cols = Math.max(4, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return { cols, rows };
}

function computeThumbSize(width: number, height: number, cols: number, rows: number): number {
  if (width <= 0 || height <= 0 || cols <= 0 || rows <= 0) return ALBUM_THUMB_MIN_PX;
  const byW = (width - ALBUM_GAP_PX * (cols - 1)) / cols;
  const byH = (height - ALBUM_GAP_PX * (rows - 1)) / rows;
  return Math.max(ALBUM_THUMB_MIN_PX, Math.floor(Math.min(byW, byH)));
}

export function FamilyAlbumSection({
  photos,
  onPhotoClick,
  onViewAllClick,
  translations: t,
}: FamilyAlbumSectionProps) {
  const { cols, rows } = getAlbumGridLayout(photos.length);
  const gridRef = useRef<HTMLDivElement>(null);
  const [thumbPx, setThumbPx] = useState(ALBUM_THUMB_MIN_PX);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const update = () => {
      setThumbPx(computeThumbSize(el.clientWidth, el.clientHeight, cols, rows));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows, photos.length]);

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
            ref={gridRef}
            className="album-photo-grid"
            style={{ gap: ALBUM_GAP_PX }}
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={onPhotoClick || onViewAllClick}
                className="album-photo-cell relative cursor-pointer overflow-hidden rounded-md bg-[#f1f5f9] transition-[filter] duration-200 ease-in-out hover:brightness-105"
                style={{
                  width: thumbPx,
                  height: thumbPx,
                  flex: `0 0 ${thumbPx}px`,
                }}
              >
                <img
                  src={photo.data}
                  alt={photo.description || ''}
                  loading="lazy"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    objectFit: 'contain',
                    objectPosition: 'center',
                  }}
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
