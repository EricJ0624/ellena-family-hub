'use client';

import {
  useCallback,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
} from 'react';

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

type Gesture = {
  x: number;
  y: number;
  id: number;
  axis: 'x' | 'y' | null;
  lastY: number;
  scroller: HTMLElement | null;
  isTouch: boolean;
};

const AXIS_LOCK_PX = 10;

/**
 * 가장 가까운 세로 스크롤 컨테이너.
 * 대시보드는 `.main-content` / `.app-container` 가 overflow-y: auto 이다.
 */
function nearestScrollable(from: HTMLElement | null): HTMLElement | null {
  let node = from?.parentElement ?? null;
  while (node) {
    const oy = window.getComputedStyle(node).overflowY;
    if (
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * 책형 위젯용 가로 스와이프.
 * 방향이 정해지기 전에는 브라우저 스크롤을 맡기지 않는다.
 * 가로로 고정되면 페이지 스크롤을 막고, 세로로 고정되면 스크롤 부모만 움직인다.
 * 짧은 탭(일정/사진 클릭)은 통과시킨다.
 */
export function useHorizontalPageSwipe({
  enabled = true,
  canPrev,
  canNext,
  onPage,
  thresholdPx = 48,
  verticalCancelRatio = 0.85,
}: Options) {
  const gestureRef = useRef<Gesture | null>(null);
  const blockClickRef = useRef(false);
  const unbindRef = useRef<(() => void) | null>(null);
  const optsRef = useRef({ enabled, verticalCancelRatio });
  optsRef.current = { enabled, verticalCancelRatio };

  const lockAxis = useCallback((g: Gesture, dx: number, dy: number, fromEl: HTMLElement | null) => {
    if (g.axis) return;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < AXIS_LOCK_PX && ady < AXIS_LOCK_PX) return;
    const ratio = Math.max(optsRef.current.verticalCancelRatio, 0.1);
    if (adx > ady / ratio) {
      g.axis = 'x';
      return;
    }
    g.axis = 'y';
    if (g.isTouch) g.scroller = nearestScrollable(fromEl);
  }, []);

  const ref = useCallback<RefCallback<HTMLElement>>((node) => {
    if (unbindRef.current) {
      unbindRef.current();
      unbindRef.current = null;
    }
    if (!node) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!optsRef.current.enabled) return;
      const g = gestureRef.current;
      if (!g || !g.isTouch || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - g.x;
      const dy = touch.clientY - g.y;
      lockAxis(g, dx, dy, node);
      if (!g.axis) return;
      if (e.cancelable) e.preventDefault();
      if (g.axis !== 'y' || !g.scroller) return;
      const step = touch.clientY - g.lastY;
      g.lastY = touch.clientY;
      g.scroller.scrollTop -= step;
    };

    node.addEventListener('touchmove', onTouchMove, { passive: false });
    unbindRef.current = () => node.removeEventListener('touchmove', onTouchMove);
  }, [lockAxis]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gestureRef.current = {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
        axis: null,
        lastY: e.clientY,
        scroller: null,
        isTouch: e.pointerType !== 'mouse',
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const g = gestureRef.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      lockAxis(g, dx, dy, e.currentTarget);
      if (g.axis !== 'x') return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [enabled, lockAxis],
  );

  const finish = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) {
        gestureRef.current = null;
        return;
      }
      const g = gestureRef.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      const axis = g.axis;
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      gestureRef.current = null;

      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const pageTurn = axis === 'x' && adx >= thresholdPx;
      if (pageTurn) {
        blockClickRef.current = true;
        if (dx < 0) {
          if (canNext) onPage('next');
        } else if (canPrev) {
          onPage('prev');
        }
        return;
      }

      // 10px만 움직여도 브라우저가 클릭을 취소한다. 페이지를 넘기지 않은 짧은 탭은 버튼을 직접 누른다.
      // 세로로 길게 움직인 경우는 스크롤이므로 사진을 열지 않는다.
      if (axis === 'y' && ady > 24) {
        blockClickRef.current = true;
        return;
      }
      // touchAction:'none' 환경에서 모바일 브라우저는 pointerup 후 네이티브 click을 발생시키지
      // 않을 수 있다. axis=null(깨끗한 탭)도 포함해 항상 button.click()을 직접 호출한다.
      if (adx >= thresholdPx) return;
      const target = e.target;
      const button = target instanceof Element ? target.closest('button') : null;
      if (!button) return;
      button.click();
      blockClickRef.current = true;
    },
    [canNext, canPrev, enabled, onPage, thresholdPx],
  );

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!blockClickRef.current) return;
    blockClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const style: CSSProperties = enabled
    ? { touchAction: 'none', cursor: 'grab' }
    : {};

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    onClickCapture,
    style,
  };
}
