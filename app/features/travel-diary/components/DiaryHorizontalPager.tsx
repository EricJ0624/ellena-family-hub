'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  layout: 'vertical' | 'horizontal';
  label: string;
  isDark: boolean;
  children: React.ReactNode;
};

function nearestSlideIndex(el: HTMLElement): number {
  const host = el.getBoundingClientRect();
  const mid = host.left + host.width / 2;
  let best = 0;
  let bestDist = Infinity;
  Array.from(el.children).forEach((node, i) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    const dist = Math.abs(rect.left + rect.width / 2 - mid);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}

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

function snapSlide(el: HTMLElement) {
  const next = nearestSlideIndex(el);
  const slide = el.children.item(next) as HTMLElement | null;
  if (!slide) return;
  const elRect = el.getBoundingClientRect();
  const slideRect = slide.getBoundingClientRect();
  const delta = slideRect.left - elRect.left - (el.clientWidth - slide.clientWidth) / 2;
  el.scrollTo({ left: Math.max(0, el.scrollLeft + delta), behavior: 'smooth' });
}

type Drag = {
  x: number;
  y: number;
  lastY: number;
  left: number;
  moved: boolean;
  id: number;
  touch: boolean;
  axis: 'x' | 'y' | null;
  scroller: HTMLElement | null;
};

export function DiaryHorizontalPager({ layout, label, isDark, children }: Props) {
  const horizontal = layout === 'horizontal';
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const blockClickRef = useRef(false);
  const gestureActiveRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const slides = React.Children.toArray(children);

  const syncIndex = () => {
    if (gestureActiveRef.current) return;
    const el = scrollerRef.current;
    if (!el || el.children.length === 0) return;
    const next = nearestSlideIndex(el);
    setIndex((prev) => (prev === next ? prev : next));
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!horizontal || !el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      gestureActiveRef.current = true;
      dragRef.current = {
        x: t.clientX,
        y: t.clientY,
        lastY: t.clientY,
        left: el.scrollLeft,
        moved: false,
        id: -1,
        touch: true,
        axis: null,
        scroller: null,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag?.touch || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - drag.x;
      const dy = t.clientY - drag.y;
      if (!drag.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        drag.moved = true;
        if (Math.abs(dx) < 8 && Math.abs(dy) >= 8) {
          drag.axis = 'y';
          drag.scroller = nearestScrollable(el);
        } else {
          drag.axis = 'x';
          // Snap during the gesture cancels the touch on iOS, so turn it off until release.
          el.style.scrollSnapType = 'none';
        }
      }
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (drag.axis === 'x') {
        el.scrollLeft = drag.left - dx;
        return;
      }
      const step = t.clientY - drag.lastY;
      drag.lastY = t.clientY;
      if (drag.scroller) drag.scroller.scrollTop -= step;
      else window.scrollBy(0, -step);
    };

    const finishTouch = () => {
      const drag = dragRef.current;
      if (!drag?.touch) return;
      dragRef.current = null;
      gestureActiveRef.current = false;
      el.style.scrollSnapType = '';
      if (drag.moved) blockClickRef.current = true;
      if (drag.axis === 'x') snapSlide(el);
      const next = nearestSlideIndex(el);
      setIndex((prev) => (prev === next ? prev : next));
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    el.addEventListener('touchend', finishTouch);
    el.addEventListener('touchcancel', finishTouch);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove, true);
      el.removeEventListener('touchend', finishTouch);
      el.removeEventListener('touchcancel', finishTouch);
      el.style.scrollSnapType = '';
    };
  }, [horizontal]);

  return (
    <div className={horizontal ? 'mt-3' : 'mt-6'}>
      {horizontal ? (
        <p
          className={['mb-3 text-center text-sm tabular-nums', isDark ? 'text-slate-300' : 'text-slate-500'].join(' ')}
        >
          {slides.length === 0 ? '0 / 0' : `${index + 1} / ${slides.length}`}
        </p>
      ) : null}
      <div
        ref={scrollerRef}
        role="region"
        aria-label={label}
        onScroll={syncIndex}
        onDragStartCapture={(e) => {
          e.preventDefault();
        }}
        onPointerDown={(e) => {
          if (!horizontal || e.pointerType !== 'mouse' || e.button !== 0) return;
          const el = scrollerRef.current;
          if (!el) return;
          gestureActiveRef.current = true;
          dragRef.current = {
            x: e.clientX,
            y: e.clientY,
            lastY: e.clientY,
            left: el.scrollLeft,
            moved: false,
            id: e.pointerId,
            touch: false,
            axis: null,
            scroller: null,
          };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const el = scrollerRef.current;
          if (!drag || drag.touch || !el || drag.id !== e.pointerId) return;
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          if (!drag.moved) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            if (Math.abs(dx) < 8 && Math.abs(dy) >= 8) {
              dragRef.current = null;
              gestureActiveRef.current = false;
              return;
            }
            drag.moved = true;
            setDragging(true);
            try {
              el.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          el.scrollLeft = drag.left - dx;
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          const el = scrollerRef.current;
          if (!drag || drag.touch) return;
          dragRef.current = null;
          gestureActiveRef.current = false;
          setDragging(false);
          if (!el || drag.id !== e.pointerId) return;
          try {
            if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          if (!drag.moved) return;
          blockClickRef.current = true;
          snapSlide(el);
          const next = nearestSlideIndex(el);
          setIndex((prev) => (prev === next ? prev : next));
        }}
        onPointerCancel={() => {
          if (dragRef.current?.touch) return;
          dragRef.current = null;
          gestureActiveRef.current = false;
          setDragging(false);
        }}
        onClickCapture={(e) => {
          if (!blockClickRef.current) return;
          blockClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        className={
          horizontal
            ? [
                'flex items-start gap-3 touch-none overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch]',
                dragging ? 'cursor-grabbing snap-none select-none' : 'cursor-grab snap-x snap-mandatory',
              ].join(' ')
            : 'flex flex-col gap-4'
        }
      >
        {slides.map((child, i) => (
          <div
            key={i}
            className={[
              horizontal
                ? 'flex h-[min(70dvh,38rem)] w-[88%] shrink-0 snap-center flex-col overflow-hidden [&>div]:h-full [&>div]:min-h-0'
                : 'w-full',
              horizontal && (dragging || i !== index) ? 'pointer-events-none select-none' : '',
            ].join(' ')}
            inert={horizontal && (dragging || i !== index) ? true : undefined}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
