'use client';

import { useMemo } from 'react';
import { CALENDAR_STICKER_EMOJIS } from '../calendar-sticker-emoji';

function pickRandomEmojis(seed: string, count: number): string[] {
  const pool = CALENDAR_STICKER_EMOJIS;
  if (pool.length === 0) return ['🎉'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: string[] = [];
  const used = new Set<number>();
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    let idx = h % pool.length;
    let guard = 0;
    while (used.has(idx) && guard < pool.length) {
      idx = (idx + 1) % pool.length;
      guard += 1;
    }
    used.add(idx);
    out.push(pool[idx]!);
  }
  return out;
}

export type CalendarCelebrateItem = {
  eventId: string;
  title: string;
  stickerEmoji: string | null;
};

export type CalendarCelebrateOverlayProps = {
  title: string;
  eventDateLabel: string;
  stickerEmoji: string | null;
  birthdayFrameSrc?: string | null;
  eventId: string;
  items?: CalendarCelebrateItem[];
  confirmLabel: string;
  onConfirm: () => void;
};

export function CalendarCelebrateOverlay({
  title,
  eventDateLabel,
  stickerEmoji,
  birthdayFrameSrc = null,
  eventId,
  items,
  confirmLabel,
  onConfirm,
}: CalendarCelebrateOverlayProps) {
  const group = items && items.length > 1 ? items : null;
  const scatter = useMemo(() => {
    if (group || stickerEmoji) return [] as string[];
    return pickRandomEmojis(eventId || title, 8);
  }, [eventId, group, stickerEmoji, title]);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[40] flex flex-col items-center justify-center overflow-hidden rounded-[inherit] bg-[linear-gradient(160deg,rgba(124,58,237,0.92)_0%,rgba(236,72,153,0.9)_45%,rgba(251,146,60,0.88)_100%)] px-3 py-4"
      role="dialog"
      aria-modal="true"
      aria-label={eventDateLabel || title}
    >
      {birthdayFrameSrc ? (
        <img
          src={birthdayFrameSrc}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain"
        />
      ) : null}
      {!group && !stickerEmoji
        ? scatter.map((emoji, i) => (
            <span
              key={`${emoji}-${i}`}
              aria-hidden
              className="pointer-events-none absolute select-none text-[clamp(1.2rem,8cqmin,2.4rem)] opacity-90"
              style={{
                left: `${8 + ((i * 17) % 76)}%`,
                top: `${10 + ((i * 23) % 70)}%`,
                transform: `rotate(${(i % 5) * 12 - 24}deg)`,
              }}
            >
              {emoji}
            </span>
          ))
        : null}

      <div className="relative z-[1] flex max-w-full flex-col items-center gap-3 text-center">
        {group ? (
          <div className="flex w-full max-w-full flex-wrap items-start justify-center gap-x-3 gap-y-2">
            {group.map((item) => (
              <div key={item.eventId} className="flex min-w-0 max-w-[46%] flex-1 flex-col items-center gap-1">
                <span className="text-[clamp(3rem,22cqmin,5.5rem)] leading-none drop-shadow-md" aria-hidden>
                  {item.stickerEmoji || '🎉'}
                </span>
                <p className="m-0 max-w-full break-words text-[clamp(0.95rem,5.5cqmin,1.45rem)] font-bold leading-tight text-white drop-shadow">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        ) : stickerEmoji ? (
          <span className="text-[clamp(3rem,22cqmin,5.5rem)] leading-none drop-shadow-md" aria-hidden>
            {stickerEmoji}
          </span>
        ) : (
          <span className="text-[clamp(2.2rem,16cqmin,4rem)] leading-none drop-shadow-md" aria-hidden>
            {scatter[0] || '🎉'}
          </span>
        )}
        {eventDateLabel ? (
          <p className="m-0 max-w-[96%] text-[clamp(1.6rem,11cqmin,3.2rem)] font-extrabold leading-none text-white drop-shadow">
            {eventDateLabel}
          </p>
        ) : null}
        {group ? null : (
          <p className="m-0 max-w-[92%] break-words text-[clamp(0.95rem,5.5cqmin,1.45rem)] font-bold leading-tight text-white drop-shadow">
            {title}
          </p>
        )}
        <button
          type="button"
          onClick={onConfirm}
          className="mt-2 cursor-pointer rounded-2xl border-none bg-white px-6 py-2.5 text-[clamp(0.85rem,4.5cqmin,1rem)] font-bold text-violet-700 shadow-md transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
