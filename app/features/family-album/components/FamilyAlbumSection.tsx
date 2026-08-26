/**
 * 가족 앨범(Family Album) 섹션 컴포넌트
 * Dashboard용 위챗식 썸네일 그리드
 * - 기본 위젯: 5×2 슬롯 기준으로 ~10장 맞춤 (스크롤 없음)
 * - 10장 초과: 열/행을 늘리고 칸을 줄여 위젯 안에 모두 표시
 * - 정사각 통일, cover로 여백 없이 채움, 사진 모서리만 둥글게
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { markAlbumPhotoUrlViewed } from '@/lib/album-viewed-photo-urls';
import type { Photo } from '../types';

interface FamilyAlbumSectionProps {
  photos: Photo[];
  /** 썸네일 클릭 시 해당 사진 전달. 없으면 onViewAllClick */
  onPhotoClick?: (photo: Photo) => void;
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

function computeThumbSize(width: number, height: number, cols: number, rows: number): number {
  if (width <= 0 || height <= 0 || cols <= 0 || rows <= 0) return ALBUM_THUMB_MIN_PX;
  const byW = (width - ALBUM_GAP_PX * (cols - 1)) / cols;
  const byH = (height - ALBUM_GAP_PX * (rows - 1)) / rows;
  return Math.max(ALBUM_THUMB_MIN_PX, Math.floor(Math.min(byW, byH)));
}

/**
 * 위젯 영역에 맞출 그리드(열×행).
 * ≤10: 항상 5×2 슬롯 크기.
 * 10장 초과: 스크롤 없이 모두 넣되, 칸을 최대한 키우는 열 수를 고름 (빈 여백 최소화).
 */
function pickAlbumGridLayout(
  count: number,
  width: number,
  height: number,
): { cols: number; rows: number } {
  if (count <= 10) return { cols: 5, rows: 2 };
  const minCols = 4;
  const maxCols = Math.min(count, 8);
  let bestCols = Math.max(minCols, Math.ceil(Math.sqrt(count)));
  let bestRows = Math.max(1, Math.ceil(count / bestCols));
  let bestSize = computeThumbSize(width, height, bestCols, bestRows);
  for (let cols = minCols; cols <= maxCols; cols += 1) {
    const rows = Math.max(1, Math.ceil(count / cols));
    const size = computeThumbSize(width, height, cols, rows);
    if (size > bestSize) {
      bestSize = size;
      bestCols = cols;
      bestRows = rows;
    }
  }
  return { cols: bestCols, rows: bestRows };
}

export function FamilyAlbumSection({
  photos,
  onPhotoClick,
  onViewAllClick,
  translations: t,
}: FamilyAlbumSectionProps) {
  /** 위젯이 잡아 주는 고정 영역 — 썸네일 크기와 무관해야 Resize 루프가 안 생김 */
  const measureRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState({ cols: 5, rows: 2, thumbPx: ALBUM_THUMB_MIN_PX });
  const { cols, thumbPx } = grid;

  useEffect(() => {
    const el = measureRef.current;
    if (!el || photos.length === 0) return;

    let rafId = 0;
    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const width = el.clientWidth;
        const height = el.clientHeight;
        const layout = pickAlbumGridLayout(photos.length, width, height);
        const nextThumb = computeThumbSize(width, height, layout.cols, layout.rows);
        setGrid((prev) => {
          if (prev.cols === layout.cols && prev.rows === layout.rows && prev.thumbPx === nextThumb) {
            return prev;
          }
          return { cols: layout.cols, rows: layout.rows, thumbPx: nextThumb };
        });
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [photos.length]);

  return (
    <section className="content-section album-widget-section">
      <div className="section-header">
        <h3 className="section-title album-widget-title">{t.section_title}</h3>
      </div>
      <div ref={measureRef} className="section-body">
        {photos.length === 0 ? (
          <p className="text-center text-[#64748b]" style={{ padding: '8cqmin 4cqmin', fontSize: '5cqmin' }}>
            {t.empty_state}
          </p>
        ) : (
          <div
            className="album-photo-grid"
            style={{
              gap: ALBUM_GAP_PX,
              gridTemplateColumns: `repeat(${cols}, ${thumbPx}px)`,
            }}
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => {
                  if (onPhotoClick) onPhotoClick(photo);
                  else onViewAllClick();
                }}
                className="album-photo-cell cursor-pointer transition-[filter] duration-200 ease-in-out hover:brightness-105"
                style={{ width: thumbPx }}
              >
                <div className="album-photo-frame">
                  <img
                    src={photo.data}
                    alt={photo.description || ''}
                    loading="lazy"
                    draggable={false}
                    onLoad={() => markAlbumPhotoUrlViewed(photo.data)}
                  />
                </div>
                {photo.isUploading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 font-semibold text-white" style={{ fontSize: '4cqmin' }}>
                    업로드 중...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onViewAllClick}
        className="album-widget-view-all inline-flex cursor-pointer items-center justify-center border-0 font-bold text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
        style={{ gap: '1.5cqmin', padding: '2cqmin 3cqmin', fontSize: '4cqmin' }}
      >
        📸 {t.view_all}
        {photos.length > 0 && ` (${photos.length})`}
      </button>
    </section>
  );
}
