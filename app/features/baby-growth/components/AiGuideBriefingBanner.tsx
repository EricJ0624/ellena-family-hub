'use client';

import React, { useEffect, useRef, useState } from 'react';

/** 짧은 브리핑용 — 공지보다 느리게 (px/s). globals.css `@keyframes marquee` 사용 */
const MARQUEE_PX_PER_SEC = 22;
const MARQUEE_DURATION_MIN = 10;
const MARQUEE_DURATION_MAX = 60;

/**
 * guide 결과 1줄 브리핑. 클릭 없음.
 * 짧으면 고정, 컨테이너보다 길면 공지형 마퀴.
 */
export function AiGuideBriefingBanner({ text }: { text: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [durationSec, setDurationSec] = useState(MARQUEE_DURATION_MIN);

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const update = () => {
      const need = measure.scrollWidth > viewport.clientWidth + 1;
      setOverflows((prev) => (prev === need ? prev : need));
      if (need) {
        // 트랙 한 절반 ≈ 텍스트 폭 + pr-8(32px)
        const cycle = measure.scrollWidth + 32;
        const next = Math.max(
          MARQUEE_DURATION_MIN,
          Math.min(MARQUEE_DURATION_MAX, cycle / MARQUEE_PX_PER_SEC),
        );
        setDurationSec((prev) => (Math.abs(prev - next) < 0.05 ? prev : next));
      }
    };

    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [text]);

  const label = `🤖 ${text}`;

  return (
    <div
      className="relative z-20 mt-1.5 shrink-0 overflow-hidden rounded-xl bg-blue-50 px-3 py-2 text-xs leading-none text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
      role="status"
      aria-live="polite"
    >
      {/* 측정용 — 레이아웃에 영향 없이 실제 텍스트 폭만 잼 */}
      <span
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 -z-10 whitespace-nowrap opacity-0"
        aria-hidden
      >
        {label}
      </span>
      <div ref={viewportRef} className="overflow-hidden">
        {overflows ? (
          <div
            className="flex w-max"
            style={{
              animation: `marquee ${durationSec}s linear infinite`,
              willChange: 'transform',
            }}
          >
            {/* 각 절반이 동일해야 @keyframes marquee(-50%)가 끊김 없이 돈다 */}
            <span className="whitespace-nowrap pr-8">{label}</span>
            <span className="whitespace-nowrap pr-8" aria-hidden>
              {label}
            </span>
          </div>
        ) : (
          <span className="block truncate whitespace-nowrap">{label}</span>
        )}
      </div>
    </div>
  );
}
