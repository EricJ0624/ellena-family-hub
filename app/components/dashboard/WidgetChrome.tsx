'use client';

import { useRef, useEffect, useState } from 'react';
import type { DashboardWidgetKey } from '@/lib/widgets/types';
import { USABILITY_MIN_W_PX, USABILITY_MIN_H_PX } from '@/lib/widgets/layout-constants';

/**
 * WidgetChrome — 위젯 컨테이너 래퍼 (Phase 4·5)
 *
 * Phase 4: container-type: inline-size + container-name: widget 컨텍스트 제공
 * Phase 5: 실측 픽셀 크기가 usability threshold 미만일 때 🔍 버튼 노출
 *
 * 설계 원칙:
 *  - 부모 grid 셀의 width/height를 따름 (min-w-0, width: 100%)
 *  - overflow는 부모 div(overflow-x-clip)에서 처리
 *  - ResizeObserver로 실측 크기를 측정 — 서버 렌더에서는 false 유지
 */

export interface WidgetChromeProps {
  widgetKey: DashboardWidgetKey;
  /** 12열 정규화 너비 (null = layout 미설정) */
  layoutW: number | null;
  /** 12열 정규화 높이 (null = layout 미설정) */
  layoutH: number | null;
  colSpan: number;
  rowSpan: number;
  /**
   * 돋보기 버튼 클릭 시 호출. 미제공·null이면 버튼을 렌더하지 않는다.
   * 버튼은 실측 픽셀 크기 < threshold일 때만 표시된다.
   */
  onExpand?: (() => void) | null;
  /** 돋보기 버튼 aria-label (번역 전달) */
  expandLabel?: string;
  children: React.ReactNode;
}

export function WidgetChrome({
  widgetKey,
  layoutW,
  layoutH,
  colSpan,
  rowSpan,
  onExpand,
  expandLabel = '확대 보기',
  children,
}: WidgetChromeProps) {
  const chromeRef = useRef<HTMLDivElement>(null);
  const [isTooSmall, setIsTooSmall] = useState(false);

  useEffect(() => {
    const el = chromeRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setIsTooSmall(width < USABILITY_MIN_W_PX || height < USABILITY_MIN_H_PX);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showExpandBtn = Boolean(onExpand) && isTooSmall;

  return (
    <div
      ref={chromeRef}
      className="widget-chrome relative"
      data-widget-key={widgetKey}
      data-layout-w={layoutW ?? undefined}
      data-layout-h={layoutH ?? undefined}
      data-col-span={colSpan}
      data-row-span={rowSpan}
    >
      {children}

      {/* 🔍 돋보기 버튼 — 위젯이 사용성 임계값 미만일 때만 표시 */}
      {showExpandBtn && (
        <button
          type="button"
          onClick={onExpand!}
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-[11px] text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          title={expandLabel}
          aria-label={expandLabel}
        >
          🔍
        </button>
      )}
    </div>
  );
}
