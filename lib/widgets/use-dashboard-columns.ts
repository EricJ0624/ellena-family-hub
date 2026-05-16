'use client';

import { type RefObject, useLayoutEffect, useState } from 'react';
import { detectDashboardShell, type DashboardShell } from './layout-shell';
import { getDashboardColumnCount } from './grid';

export interface DashboardGridLayout {
  columnCount: number;
  shell: DashboardShell;
  contentWidth: number;
}

/**
 * 위젯 그리드 컨테이너 실측 너비 + 쉘 기준 열 수.
 * SSR·초기값 1열(mobile) — Hydration 후 ResizeObserver로 갱신.
 */
export function useDashboardGridLayout(
  gridRef: RefObject<HTMLElement | null>,
): DashboardGridLayout {
  const [columnCount, setColumnCount] = useState(1);
  const [shell, setShell] = useState<DashboardShell>('mobile');
  const [contentWidth, setContentWidth] = useState(0);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const read = () => {
      const nextShell = detectDashboardShell();
      const w = el.getBoundingClientRect().width;
      setShell(nextShell);
      setContentWidth(w);
      setColumnCount(getDashboardColumnCount(w, nextShell));
    };

    read();

    const ro = new ResizeObserver(() => read());
    ro.observe(el);

    const mq = window.matchMedia('(min-width: 768px)');
    mq.addEventListener('change', read);
    window.addEventListener('resize', read);

    return () => {
      ro.disconnect();
      mq.removeEventListener('change', read);
      window.removeEventListener('resize', read);
    };
  }, [gridRef]);

  return { columnCount, shell, contentWidth };
}

/** @deprecated useDashboardGridLayout 사용 */
export function useDashboardColumnCount(gridRef: RefObject<HTMLElement | null>): number {
  return useDashboardGridLayout(gridRef).columnCount;
}
