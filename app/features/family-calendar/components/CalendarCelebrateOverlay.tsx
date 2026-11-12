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

const captionChip = 'rounded-2xl bg-white text-violet-800 shadow-md';

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
      className="pointer-events-auto relative z-[40] flex h-full w-full flex-col items-center rounded-[inherit] bg-[linear-gradient(160deg,rgba(124,58,237,0.92)_0%,rgba(236,72,153,0.9)_45%,rgba(251,146,60,0.88)_100%)] px-[4cqmin] py-[3cqmin] [container-type:size]"
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
              className="pointer-events-none absolute select-none text-[clamp(0.9rem,6cqmin,1.6rem)] opacity-90"
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

      {group ? (
        <div
          className="relative z-[1] grid min-h-0 w-full flex-1 grid-cols-2 gap-x-[2cqmin] gap-y-[1cqmin]"
          // 같은 날 일정 수에 따라 줄 수가 바뀌므로 행 높이만 여기서 나눈다.
          style={{ gridTemplateRows: `repeat(${Math.ceil(group.length / 2)}, minmax(0, 1fr))` }}
        >
          {group.map((item) => (
            <div
              key={item.eventId}
              className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-[3cqmin] px-[4%] [container-type:size]"
            >
              <span className="text-[32cqmin] leading-none drop-shadow-md" aria-hidden>
                {item.stickerEmoji || '🎉'}
              </span>
              <p className={`m-0 line-clamp-2 max-w-full break-words px-[0.7em] py-[0.28em] text-center text-[clamp(0.8rem,20cqmin,1.05rem)] font-bold leading-tight ${captionChip}`}>
                {item.title}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-[1] grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)_auto] gap-[1.2cqmin]">
          <div className="flex min-h-0 items-center justify-center [container-type:size]">
            <span className="text-[52cqmin] leading-none drop-shadow-md" aria-hidden>
              {stickerEmoji || scatter[0] || '🎉'}
            </span>
          </div>
          <p className={`m-0 line-clamp-2 max-w-[92%] justify-self-center break-words px-[0.75em] py-[0.3em] text-center text-[clamp(0.95rem,5.2cqmin,1.4rem)] font-bold leading-tight ${captionChip}`}>
            {title}
          </p>
        </div>
      )}
      {eventDateLabel ? (
        <p className={`relative z-[1] m-0 mt-[1cqmin] max-w-full shrink-0 whitespace-nowrap px-[0.7em] py-[0.22em] text-center text-[clamp(0.8rem,7.2cqw,1.65rem)] font-extrabold leading-none ${captionChip}`}>
          {eventDateLabel}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onConfirm}
        className="relative z-[1] mt-[1.2cqmin] shrink-0 cursor-pointer rounded-2xl border-none bg-white px-[5cqmin] py-[1.6cqmin] text-[clamp(0.72rem,3.6cqmin,0.95rem)] font-bold text-violet-700 shadow-md transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        {confirmLabel}
      </button>
    </div>
  );
}
