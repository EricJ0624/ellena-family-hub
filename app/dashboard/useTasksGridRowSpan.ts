'use client';

import { useEffect, useState, type RefObject } from 'react';
import { estimateTasksGridRowSpan, rowSpanFromChalkboardHeight } from '@/lib/widgets/grid';

/**
 * Family Tasks 그리드 rowSpan — 칠판 DOM 높이를 ResizeObserver로 반영해
 * 아래 위젯(캘린더 등)이 auto-flow에서 겹치지 않게 함.
 */
export function useTasksGridRowSpan(
  cellRef: RefObject<HTMLDivElement | null>,
  layoutRowSpan: number,
  cellRowH: number,
  taskCount: number,
  measureEnabled: boolean,
): number {
  const [span, setSpan] = useState(() => estimateTasksGridRowSpan(layoutRowSpan, taskCount));

  useEffect(() => {
    setSpan(estimateTasksGridRowSpan(layoutRowSpan, taskCount));
  }, [layoutRowSpan, taskCount]);

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
  }, [measureEnabled, cellRef, cellRowH, layoutRowSpan, taskCount]);

  return span;
}
