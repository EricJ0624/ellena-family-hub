'use client';

import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import {
  detectDashboardShell,
  TOUCH_ONLY_DEVICE_MEDIA_QUERY,
  WIDE_VIEWPORT_MEDIA_QUERY,
  type DashboardShell,
} from './layout-shell';
import {
  getDashboardColumnCount,
  usesLandscapeWidgetGridLayout,
} from './grid';
import type { WidgetConfigDraft } from './types';
import type { AppPreviewOrientation } from './preview-orientation';

export const DEVICE_ORIENTATION_LANDSCAPE_MEDIA_QUERY = '(orientation: landscape)';

export interface DashboardGridLayout {
  columnCount: number;
  shell: DashboardShell;
  contentWidth: number;
  isLandscapeGrid: boolean;
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
  widgetConfigs: readonly WidgetConfigDraft[] = [],
): DashboardGridLayout {
  const [columnCount, setColumnCount] = useState(1);
  const [shell, setShell] = useState<DashboardShell>('mobile');
  const [contentWidth, setContentWidth] = useState(0);
  const [isLandscapeGrid, setIsLandscapeGrid] = useState(false);

  /**
   * [Fix 4] widgetConfigs를 ref로 보관 — useLayoutEffect deps에서 제거.
   * widgetConfigs 배열 레퍼런스가 바뀔 때마다 effect가 재실행되면
   * ResizeObserver 재등록 + read() 호출이 반복되어 불필요한 레이아웃 재측정이 발생함.
   * read() 내부에서 최신 값을 ref로 읽으면 deps 없이도 항상 최신 상태를 사용할 수 있음.
   */
  const widgetConfigsRef = useRef(widgetConfigs);
  widgetConfigsRef.current = widgetConfigs;

  /**
   * [Fix 3] 마운트 직후 window.innerWidth 기반 초기 레이아웃 추정.
   * useLayoutEffect는 paint 전 동기 실행 → 첫 렌더에서 1열(기본값) → 실제 열로
   * 전환되는 레이아웃 점프를 제거한다.
   * widgetConfigs는 아직 없으므로 빈 배열로 추정(ResizeObserver에서 정확히 보정됨).
   */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const w = Math.round(window.innerWidth);
    if (w <= 0) return;
    const initShell = detectDashboardShell();
    const deviceLandscape = window.matchMedia(DEVICE_ORIENTATION_LANDSCAPE_MEDIA_QUERY).matches;
    const landscapeGrid = usesLandscapeWidgetGridLayout(initShell, previewOrientation, deviceLandscape);
    const cols = getDashboardColumnCount(w, initShell, previewOrientation, deviceLandscape, []);
    setShell(initShell);
    setContentWidth(w);
    setIsLandscapeGrid(landscapeGrid);
    setColumnCount(cols > 0 ? cols : 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 1회 실행 — previewOrientation 초기 추정용

  useLayoutEffect(() => {
    if (!gridActive) return;

    const read = () => {
      const nextShell = detectDashboardShell();
      const w = Math.round(measureContentWidth(gridRef.current));
      const deviceLandscape = window.matchMedia(DEVICE_ORIENTATION_LANDSCAPE_MEDIA_QUERY).matches;
      const landscapeGrid = usesLandscapeWidgetGridLayout(
        nextShell,
        previewOrientation,
        deviceLandscape,
      );
      // [Fix 4] widgetConfigs는 ref로 참조 — 배열 레퍼런스 변경으로 effect 재실행 방지
      const nextColumns = getDashboardColumnCount(
        w,
        nextShell,
        previewOrientation,
        deviceLandscape,
        widgetConfigsRef.current,
      );
      // 너비 1px 출렁임 → cellRowH → 모든 위젯 --widget-scale-box-h → cqmin 전체 재계산
      setShell((prev) => (prev === nextShell ? prev : nextShell));
      setContentWidth((prev) => (Math.abs(prev - w) < 2 ? prev : w));
      setIsLandscapeGrid((prev) => (prev === landscapeGrid ? prev : landscapeGrid));
      setColumnCount((prev) => (prev === nextColumns ? prev : nextColumns));
    };

    read();

    let raf = 0;
    const scheduleRead = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        read();
      });
    };

    const el = gridRef.current;
    const ro = el ? new ResizeObserver(() => scheduleRead()) : null;
    if (el && ro) ro.observe(el);

    const mqWide = window.matchMedia(WIDE_VIEWPORT_MEDIA_QUERY);
    const mqTouchOnly = window.matchMedia(TOUCH_ONLY_DEVICE_MEDIA_QUERY);
    const mqLandscape = window.matchMedia(DEVICE_ORIENTATION_LANDSCAPE_MEDIA_QUERY);
    const onMq = () => scheduleRead();
    mqWide.addEventListener('change', onMq);
    mqTouchOnly.addEventListener('change', onMq);
    mqLandscape.addEventListener('change', onMq);
    window.addEventListener('resize', onMq);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      mqWide.removeEventListener('change', onMq);
      mqTouchOnly.removeEventListener('change', onMq);
      mqLandscape.removeEventListener('change', onMq);
      window.removeEventListener('resize', onMq);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridRef, previewOrientation, gridActive]);
  // widgetConfigs는 widgetConfigsRef.current로 읽으므로 deps 불필요 — [Fix 4]

  return { columnCount, shell, contentWidth, isLandscapeGrid };
}

/** @deprecated useDashboardGridLayout 사용 */
export function useDashboardColumnCount(
  gridRef: RefObject<HTMLElement | null>,
  previewOrientation?: AppPreviewOrientation,
  gridActive?: boolean,
): number {
  return useDashboardGridLayout(gridRef, previewOrientation, gridActive).columnCount;
}
