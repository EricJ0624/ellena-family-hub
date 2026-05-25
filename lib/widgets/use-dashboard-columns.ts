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

function measureContentWidth(el: HTMLElement | null): number {
  if (el) {
    const w = el.getBoundingClientRect().width;
    if (w > 0) return w;
  }
  if (typeof window !== 'undefined') return window.innerWidth;
  return 0;
}

/**
 * 위젯 그리드 컨테이너 실측 너비 + 쉘 기준 열 수.
 * @param gridActive 대시보드 DOM(그리드 ref)이 붙은 뒤 true — isMounted 직후 effect 재실행용
 */
export function useDashboardGridLayout(
  gridRef: RefObject<HTMLElement | null>,
  previewOrientation: AppPreviewOrientation = 'portrait',
  gridActive = false,
): DashboardGridLayout {
  const [columnCount, setColumnCount] = useState(1);
  const [shell, setShell] = useState<DashboardShell>('mobile');
  const [contentWidth, setContentWidth] = useState(0);

  useLayoutEffect(() => {
    if (!gridActive) return;

    const read = () => {
      const nextShell = detectDashboardShell();
      const w = measureContentWidth(gridRef.current);
      setShell(nextShell);
      setContentWidth(w);
      setColumnCount(getDashboardColumnCount(w, nextShell, previewOrientation));
    };

    read();

    const el = gridRef.current;
    const ro = el ? new ResizeObserver(() => read()) : null;
    if (el && ro) ro.observe(el);

    const mqWide = window.matchMedia(WIDE_VIEWPORT_MEDIA_QUERY);
    const mqTouchOnly = window.matchMedia(TOUCH_ONLY_DEVICE_MEDIA_QUERY);
    const onMq = () => read();
    mqWide.addEventListener('change', onMq);
    mqTouchOnly.addEventListener('change', onMq);
    window.addEventListener('resize', onMq);

    return () => {
      ro?.disconnect();
      mqWide.removeEventListener('change', onMq);
      mqTouchOnly.removeEventListener('change', onMq);
      window.removeEventListener('resize', onMq);
    };
  }, [gridRef, previewOrientation, gridActive]);

  return { columnCount, shell, contentWidth };
}

/** @deprecated useDashboardGridLayout 사용 */
export function useDashboardColumnCount(
  gridRef: RefObject<HTMLElement | null>,
  previewOrientation?: AppPreviewOrientation,
  gridActive?: boolean,
): number {
  return useDashboardGridLayout(gridRef, previewOrientation, gridActive).columnCount;
}
