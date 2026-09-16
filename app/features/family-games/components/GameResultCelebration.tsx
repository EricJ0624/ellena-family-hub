'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type GameResultCelebrationProps = {
  open: boolean;
  /** Same key → confetti fires only once (e.g. sessionId:revealStartedAt) */
  celebrationKey: string;
  title: string;
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
  /** false for draws — skip confetti */
  celebrate?: boolean;
};

/**
 * Full-screen result overlay for all game participants.
 * Renders above GamePlayModal so nobody misses the outcome.
 */
export function GameResultCelebration({
  open,
  celebrationKey,
  title,
  message,
  dismissLabel,
  onDismiss,
  celebrate = true,
}: GameResultCelebrationProps) {
  const firedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !celebrate) return;
    if (firedKeyRef.current === celebrationKey) return;
    firedKeyRef.current = celebrationKey;

    let cancelled = false;
    let removeCanvas: (() => void) | undefined;

    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10030';
      document.body.appendChild(canvas);
      const fire = confetti.create(canvas, { resize: true, useWorker: false });
      const colors = ['#059669', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'];
      fire({
        particleCount: 90,
        spread: 76,
        origin: { x: 0.5, y: 0.55 },
        colors,
        ticks: 220,
      });
      fire({
        particleCount: 40,
        spread: 100,
        startVelocity: 28,
        origin: { x: 0.2, y: 0.35 },
        colors,
        ticks: 180,
      });
      fire({
        particleCount: 40,
        spread: 100,
        startVelocity: 28,
        origin: { x: 0.8, y: 0.35 },
        colors,
        ticks: 180,
      });
      removeCanvas = () => {
        fire.reset();
        canvas.remove();
      };
      window.setTimeout(() => removeCanvas?.(), 2800);
    });

    return () => {
      cancelled = true;
      removeCanvas?.();
    };
  }, [open, celebrationKey, celebrate]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center p-4"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/45" onClick={onDismiss} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="game-result-celebration-title"
        aria-describedby="game-result-celebration-message"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white px-6 py-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="game-result-celebration-title"
          className="m-0 text-base font-semibold text-emerald-700 sm:text-lg"
        >
          {title}
        </p>
        <p
          id="game-result-celebration-message"
          className="mt-3 m-0 text-2xl font-extrabold leading-snug text-slate-800 sm:text-3xl"
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {dismissLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
