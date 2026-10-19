'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { clampFamilyLogFocusY, familyLogObjectPosition } from '../collage';

type Props = {
  open: boolean;
  imageUrl: string;
  initialY?: number;
  title: string;
  hint: string;
  confirmLabel: string;
  skipLabel: string;
  onConfirm: (y: number) => void;
  onSkip: () => void;
};

export function FamilyLogPhotoFocus({
  open,
  imageUrl,
  initialY = 50,
  title,
  hint,
  confirmLabel,
  skipLabel,
  onConfirm,
  onSkip,
}: Props) {
  const [y, setY] = useState(() => clampFamilyLogFocusY(initialY));
  const dragging = useRef(false);
  const lastY = useRef(0);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setY(clampFamilyLogFocusY(initialY));
  }, [open, initialY, imageUrl]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    lastY.current = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const frameH = frameRef.current?.clientHeight ?? 1;
    const dy = event.clientY - lastY.current;
    lastY.current = event.clientY;
    setY((prev) => clampFamilyLogFocusY(prev - (dy / frameH) * 100));
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
        <div
          ref={frameRef}
          className="relative mt-4 aspect-[4/3] w-full cursor-grab touch-none overflow-hidden rounded-xl border-2 border-zinc-800 bg-zinc-950 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-cover"
            style={{ objectPosition: familyLogObjectPosition({ y }) }}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
          >
            {skipLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(clampFamilyLogFocusY(y))}
            className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
