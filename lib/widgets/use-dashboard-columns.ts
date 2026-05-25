'use client';

import { type RefObject, useLayoutEffect, useState } from 'react';
import {
  detectDashboardShell,
  TOUCH_ONLY_DEVICE_MEDIA_QUERY,
  WIDE_VIEWPORT_MEDIA_QUERY,
  type DashboardShell,
} from './layout-shell';
import { getDashboardColumnCount } from './grid';
import type { AppPreviewOrientation } from './preview-orientation';

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
  previewOrientation: AppPreviewOrientation = 'portrait',
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
      setColumnCount(getDashboardColumnCount(w, nextShell, previewOrientation));
    };

    read();

    const ro = new ResizeObserver(() => read());
    ro.observe(el);

    const mqWide = window.matchMedia(WIDE_VIEWPORT_MEDIA_QUERY);
    const mqTouchOnly = window.matchMedia(TOUCH_ONLY_DEVICE_MEDIA_QUERY);
    const onMq = () => read();
    mqWide.addEventListener('change', onMq);
    mqTouchOnly.addEventListener('change', onMq);
    window.addEventListener('resize', onMq);

    return () => {
      ro.disconnect();
      mqWide.removeEventListener('change', onMq);
      mqTouchOnly.removeEventListener('change', onMq);
      window.removeEventListener('resize', onMq);
    };
  }, [gridRef, previewOrientation]);

  return { columnCount, shell, contentWidth };
}

/** @deprecated useDashboardGridLayout 사용 */
export function useDashboardColumnCount(
  gridRef: RefObject<HTMLElement | null>,
  previewOrientation?: AppPreviewOrientation,
): number {
  return useDashboardGridLayout(gridRef, previewOrientation).columnCount;
}
