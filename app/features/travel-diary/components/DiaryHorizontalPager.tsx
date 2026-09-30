'use client';

import React, { useRef, useState } from 'react';

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

export function DiaryHorizontalPager({ layout, label, isDark, children }: Props) {
  const horizontal = layout === 'horizontal';
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; moved: boolean; id: number } | null>(null);
  const blockClickRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const slides = React.Children.toArray(children);

  const syncIndex = () => {
    const el = scrollerRef.current;
    if (!el || el.children.length === 0) return;
    const next = nearestSlideIndex(el);
    setIndex((prev) => (prev === next ? prev : next));
  };

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
          if (!horizontal || (e.pointerType === 'mouse' && e.button !== 0)) return;
          const el = scrollerRef.current;
          if (!el) return;
          dragRef.current = {
            x: e.clientX,
            y: e.clientY,
            left: el.scrollLeft,
            moved: false,
            id: e.pointerId,
          };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const el = scrollerRef.current;
          if (!drag || !el || drag.id !== e.pointerId) return;
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          if (!drag.moved) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            if (Math.abs(dx) < 8 && Math.abs(dy) >= 8) {
              dragRef.current = null;
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
          dragRef.current = null;
          setDragging(false);
          if (!drag || !el || drag.id !== e.pointerId) return;
          try {
            if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          if (!drag.moved) return;
          blockClickRef.current = true;
          const next = nearestSlideIndex(el);
          const slide = el.children.item(next) as HTMLElement | null;
          if (!slide) return;
          const elRect = el.getBoundingClientRect();
          const slideRect = slide.getBoundingClientRect();
          const delta = slideRect.left - elRect.left - (el.clientWidth - slide.clientWidth) / 2;
          el.scrollTo({ left: Math.max(0, el.scrollLeft + delta), behavior: 'smooth' });
        }}
        onPointerCancel={() => {
          dragRef.current = null;
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
                'flex items-start gap-3 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch]',
                dragging ? 'cursor-grabbing snap-none select-none' : 'cursor-grab snap-x snap-mandatory',
              ].join(' ')
            : 'flex flex-col gap-4'
        }
        style={horizontal ? { touchAction: 'pan-y' } : undefined}
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
