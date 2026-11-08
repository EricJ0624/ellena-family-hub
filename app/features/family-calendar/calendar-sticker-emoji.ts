import type { FamilyEvent } from './types';

/** 일정에 직접 고를 수 있는 이모지. 날짜 칸 자동 스티커와 별개다. */
export const CALENDAR_STICKER_GROUPS = [
  { id: 'health', emojis: ['🏥', '🦷', '💉', '💊'] },
  { id: 'kids', emojis: ['🚌', '🚗', '📚', '🎹', '⚽', '🏊', '🎓'] },
  { id: 'together', emojis: ['🍽️', '🎬', '🎮', '🏖️', '⛺', '✈️', '🛒', '🧹'] },
  { id: 'celebrate', emojis: ['🎂', '💐', '🎁', '👴', '📞', '🎄', '🎃'] },
] as const;

export const CALENDAR_STICKER_EMOJIS = CALENDAR_STICKER_GROUPS.flatMap((group) => group.emojis);

const CALENDAR_STICKER_EMOJI_SET = new Set<string>(CALENDAR_STICKER_EMOJIS);

export function normalizeCalendarStickerEmoji(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return CALENDAR_STICKER_EMOJI_SET.has(trimmed) ? trimmed : null;
}

function savedOrder(event: FamilyEvent): string {
  if (event.created_at) return event.created_at;
  if (typeof event.id === 'number') return new Date(event.id).toISOString();
  return '9999';
}

/** 같은 날 여러 일정이면 먼저 저장된 일정의 이모지를 쓴다. */
export function firstCalendarStickerEmoji(events: readonly FamilyEvent[]): string | null {
  const ordered = [...events].sort((a, b) => {
    const byTime = savedOrder(a).localeCompare(savedOrder(b));
    if (byTime !== 0) return byTime;
    return String(a.id).localeCompare(String(b.id));
  });
  for (const event of ordered) {
    const emoji = normalizeCalendarStickerEmoji(event.sticker_emoji);
    if (emoji) return emoji;
  }
  return null;
}
