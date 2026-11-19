/**
 * 가로 스와이프/드래그로 삭제 확인을 띄운다.
 * - 버튼/체크 클릭은 가로채지 않음
 * - 가로 잠금이 확정된 뒤에만 pointer capture (클릭 방해 방지)
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';

const AXIS_LOCK_PX = 12;
const DELETE_THRESHOLD_PX = 72;
const MAX_DRAG_PX = 96;

type Props = {
  children: React.ReactNode;
  onDeleteRequest: () => void;
  className?: string;
  disabled?: boolean;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('button, a, input, select, textarea, label, [role="checkbox"], [role="button"]'),
  );
}

export function TaskSwipeRow({ children, onDeleteRequest, className, disabled }: Props) {
  const [offsetX, setOffsetX] = useState(0);
  const startRef = useRef<{
    x: number;
    y: number;
    locking: 'none' | 'h' | 'v';
    pointerId: number;
  } | null>(null);
  const offsetRef = useRef(0);
  offsetRef.current = offsetX;
  const rootRef = useRef<HTMLDivElement>(null);

  const endGesture = useCallback(() => {
    const dx = offsetRef.current;
    const start = startRef.current;
    startRef.current = null;
    if (start && rootRef.current?.hasPointerCapture?.(start.pointerId)) {
      try {
        rootRef.current.releasePointerCapture(start.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (dx <= -DELETE_THRESHOLD_PX) {
      setOffsetX(0);
      onDeleteRequest();
      return;
    }
    setOffsetX(0);
  }, [onDeleteRequest]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    if (e.button !== 0) return;
    if (isInteractiveTarget(e.target)) return;
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      locking: 'none',
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (start.locking === 'none') {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dx) >= AXIS_LOCK_PX) {
        start.locking = 'h';
        rootRef.current?.setPointerCapture?.(e.pointerId);
      } else {
        start.locking = 'v';
        return;
      }
    }
    if (start.locking === 'v') return;

    e.preventDefault();
    const next = Math.max(-MAX_DRAG_PX, Math.min(0, dx));
    setOffsetX(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    if (start.locking === 'h') endGesture();
    else {
      startRef.current = null;
      setOffsetX(0);
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    startRef.current = null;
    setOffsetX(0);
  };

  return (
    <div
      ref={rootRef}
      className={`relative touch-pan-y ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="relative transition-transform duration-150 ease-out will-change-transform"
        style={{ transform: offsetX ? `translateX(${offsetX}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
