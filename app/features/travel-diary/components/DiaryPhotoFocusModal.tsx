'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clampPhotoFocusY } from '@/lib/modules/travel-planner/diary-collage';
import {
  clampLocationOvalFocusY,
  LOCATION_OVAL_FOCUS_Y_MAX,
  LOCATION_OVAL_FOCUS_Y_MIN,
} from '@/lib/album-photo-focus';

type PreviewVariant = 'rect' | 'oval';

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
  /** rect = 일기 콜라주용 4:3, oval = 가족 위치 타원 미리보기 */
  previewVariant?: PreviewVariant;
};

/**
 * 세로 사진용: 프레임 안에서 드래그로 object-position y 를 맞춤.
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
  previewVariant = 'rect',
}: Props) {
  const isOval = previewVariant === 'oval';
  const clampY = useCallback(
    (v: number) => (isOval ? clampLocationOvalFocusY(v) : clampPhotoFocusY(v)),
    [isOval],
  );

  const [y, setY] = useState(() => clampY(initialY));
  const dragging = useRef(false);
  const lastY = useRef(0);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setY(clampY(initialY));
  }, [open, initialY, imageUrl, clampY]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const frameH = frameRef.current?.clientHeight ?? 1;
      const dy = e.clientY - lastY.current;
      lastY.current = e.clientY;
      // 사진을 아래로 드래그 → 위쪽이 더 보임 → y 감소
      setY((prev) => clampY(prev - (dy / frameH) * 100));
    },
    [clampY],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  if (!open) return null;

  // 위젯 타원: width 39.5% × height 23% of 992×1070 → ≈391.8×246.1 → aspect ≈ 1.592
  const frameClass = isOval
    ? 'relative mx-auto mt-4 aspect-[392/246] w-[min(100%,300px)] cursor-grab touch-none overflow-hidden rounded-[50%] border-2 border-amber-800/80 bg-zinc-950 shadow-inner active:cursor-grabbing'
    : 'relative mt-4 aspect-[4/3] w-full cursor-grab touch-none overflow-hidden rounded-xl border-2 border-zinc-800 bg-zinc-950 active:cursor-grabbing';

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
        {isOval ? (
          <p className="mt-1 text-[11px] text-slate-400">
            위·아래 범위는 {LOCATION_OVAL_FOCUS_Y_MIN}–{LOCATION_OVAL_FOCUS_Y_MAX}%로 제한됩니다. 타원에
            보이는 그대로 저장됩니다.
          </p>
        ) : null}

        <div
          ref={frameRef}
          className={frameClass}
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
            onClick={() => onConfirm(clampY(y))}
            className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
