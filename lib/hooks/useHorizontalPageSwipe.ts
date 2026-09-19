'use client';

import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

export type PageSwipeDir = 'next' | 'prev';

type Options = {
  enabled?: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPage: (dir: PageSwipeDir) => void;
  /** 가로로 이 이상 움직여야 페이지 전환 (px) */
  thresholdPx?: number;
  /** |dy| 가 |dx| * 이 비율보다 크면 세로 제스처로 무시 */
  verticalCancelRatio?: number;
};

/**
 * 책형 위젯용 가로 스와이프.
 * 짧은 탭(일정/사진 클릭)은 통과시키고, 가로 드래그만 페이지 전환에 사용한다.
 */
export function useHorizontalPageSwipe({
  enabled = true,
  canPrev,
  canNext,
  onPage,
  thresholdPx = 48,
  verticalCancelRatio = 0.85,
}: Options) {
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const armedRef = useRef(false);

  const clear = useCallback(() => {
    startRef.current = null;
    armedRef.current = false;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      armedRef.current = false;
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const start = startRef.current;
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (
        !armedRef.current &&
        Math.abs(dx) > 14 &&
        Math.abs(dx) > Math.abs(dy) / Math.max(verticalCancelRatio, 0.1)
      ) {
        armedRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [enabled, verticalCancelRatio],
  );

  const finish = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) {
        clear();
        return;
      }
      const start = startRef.current;
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const wasArmed = armedRef.current;
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      clear();

      if (!wasArmed) return;
      if (Math.abs(dx) < thresholdPx) return;
      if (Math.abs(dy) > Math.abs(dx) * verticalCancelRatio) return;

      /* 왼쪽 스와이프(손가락→왼쪽) = 다음 장 */
      if (dx < 0) {
        if (canNext) onPage('next');
        return;
      }
      if (canPrev) onPage('prev');
    },
    [canNext, canPrev, clear, enabled, onPage, thresholdPx, verticalCancelRatio],
  );

  const style: CSSProperties = enabled
    ? { touchAction: 'pan-y', cursor: 'grab' }
    : {};

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    style,
  };
}
