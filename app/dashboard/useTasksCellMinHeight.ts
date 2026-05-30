'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * tasks 그리드 셀 min-height만 칠판 실측에 맞춤 (grid-row span / 칠판 CSS 미변경).
 */
export function useTasksCellMinHeight(
  cellRef: RefObject<HTMLDivElement | null>,
  layoutMinPx: number,
  measureEnabled: boolean,
): number {
  const [minPx, setMinPx] = useState(layoutMinPx);

  useEffect(() => {
    setMinPx(layoutMinPx);
  }, [layoutMinPx]);

  useEffect(() => {
    if (!measureEnabled || layoutMinPx <= 0) return;
    const cell = cellRef.current;
    if (!cell) return;
    const frame = cell.querySelector('.chalkboard-frame');
    if (!frame) return;

    const apply = () => {
      const h = frame.getBoundingClientRect().height;
      if (!Number.isFinite(h) || h <= 0) return;
      setMinPx(Math.max(layoutMinPx, Math.ceil(h)));
    };

    const ro = new ResizeObserver(apply);
    ro.observe(frame);
    apply();
    return () => ro.disconnect();
  }, [measureEnabled, cellRef, layoutMinPx]);

  return minPx;
}
