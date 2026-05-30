'use client';

import { useEffect, useState, type RefObject } from 'react';
import { rowSpanFromChalkboardHeight } from '@/lib/widgets/grid';

/**
 * 칠판 실측 높이 → grid-row span (layout M 바닥 이상).
 * 셀 overflow:hidden + span으로 auto-flow가 캘린더를 칠판 아래에 둠.
 */
export function useTasksGridRowSpan(
  cellRef: RefObject<HTMLDivElement | null>,
  layoutRowSpan: number,
  cellRowH: number,
  measureEnabled: boolean,
): number {
  const [span, setSpan] = useState(layoutRowSpan);

  useEffect(() => {
    setSpan(layoutRowSpan);
  }, [layoutRowSpan]);

  useEffect(() => {
    if (!measureEnabled || cellRowH <= 0) return;
    const cell = cellRef.current;
    if (!cell) return;
    const frame = cell.querySelector('.chalkboard-frame');
    if (!frame) return;

    const apply = () => {
      const h = frame.getBoundingClientRect().height;
      setSpan(rowSpanFromChalkboardHeight(h, cellRowH, layoutRowSpan));
    };

    const ro = new ResizeObserver(apply);
    ro.observe(frame);
    apply();
    return () => ro.disconnect();
  }, [measureEnabled, cellRef, cellRowH, layoutRowSpan]);

  return span;
}
