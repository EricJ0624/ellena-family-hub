'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clampPhotoFocusY } from '@/lib/modules/travel-planner/diary-collage';

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

/**
 * 세로 사진용: 가로 프레임 안에서 드래그로 object-position y 를 맞춤.
 */
export function DiaryPhotoFocusModal({
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
  const [y, setY] = useState(clampPhotoFocusY(initialY));
  const dragging = useRef(false);
  const lastY = useRef(0);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setY(clampPhotoFocusY(initialY));
  }, [open, initialY, imageUrl]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const frameH = frameRef.current?.clientHeight ?? 1;
    const dy = e.clientY - lastY.current;
    lastY.current = e.clientY;
    // 사진을 아래로 드래그 → 위쪽이 더 보임 → y 감소
    setY((prev) => clampPhotoFocusY(prev - (dy / frameH) * 100));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-cover"
            style={{ objectPosition: `50% ${y}%` }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 py-2 text-center text-[11px] font-medium text-white">
            ↕
          </div>
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
            onClick={() => onConfirm(y)}
            className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
