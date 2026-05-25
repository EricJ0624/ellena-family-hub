'use client';

import { type RefObject, useLayoutEffect, useState } from 'react';
import {
  detectDashboardShell,
  TOUCH_PRIMARY_MEDIA_QUERY,
  WEB_PREVIEW_MEDIA_QUERY,
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

    const mqDesktop = window.matchMedia(WEB_PREVIEW_MEDIA_QUERY);
    const mqTouch = window.matchMedia(TOUCH_PRIMARY_MEDIA_QUERY);
    const onMq = () => read();
    mqDesktop.addEventListener('change', onMq);
    mqTouch.addEventListener('change', onMq);
    window.addEventListener('resize', onMq);

    return () => {
      ro.disconnect();
      mqDesktop.removeEventListener('change', onMq);
      mqTouch.removeEventListener('change', onMq);
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
