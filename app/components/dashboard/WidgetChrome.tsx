'use client';

import type { DashboardWidgetKey } from '@/lib/widgets/types';

/**
 * WidgetChrome — 위젯 컨테이너 래퍼 (Phase 4·5·E)
 *
 * Phase 4: container-type: inline-size + container-name: widget 컨텍스트 제공
 * Phase E: 돋보기 버튼 제거 → S 사이즈 위젯 전체를 터치하면 magnify 자동 실행.
 *          onExpand가 제공될 때(= 호출자가 S 사이즈로 판단)만 투명 오버레이 활성화.
 *          M 이상에서는 onExpand=undefined로 전달해 오버레이를 렌더하지 않는다.
 *
 * 설계 원칙:
 *  - 부모 grid 셀의 width/height를 따름 (min-w-0, width: 100%)
 *  - overflow는 부모 div(overflow-x-clip)에서 처리
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
   * Phase E: S 사이즈 위젯에서만 전달. 전달 시 위젯 전체가 탭-to-expand 영역이 된다.
   * undefined 또는 null이면 오버레이를 렌더하지 않는다 (M/L 위젯).
   */
  onExpand?: (() => void) | null;
  /** 접근성용 aria-label */
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
  return (
    <div
      className="widget-chrome relative"
      data-widget-key={widgetKey}
      data-layout-w={layoutW ?? undefined}
      data-layout-h={layoutH ?? undefined}
      data-col-span={colSpan}
      data-row-span={rowSpan}
    >
      {children}

      {/* Phase E: S 사이즈 위젯 — 버튼 없이 위젯 전체가 터치 확대 영역
          onExpand가 있을 때만 렌더 (호출자가 S 사이즈 여부를 결정).
          cursor-zoom-in 으로 확대 가능함을 암시, 키보드 접근성(Enter/Space) 지원. */}
      {onExpand && (
        <div
          role="button"
          tabIndex={0}
          aria-label={expandLabel}
          className="absolute inset-0 z-10 cursor-zoom-in"
          onClick={onExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpand();
            }
          }}
        />
      )}
    </div>
  );
}
