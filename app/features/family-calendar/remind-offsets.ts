/** Allowed reminder offsets in days before event_date (no hour-based reminders). */
export const CALENDAR_REMIND_OFFSET_DAYS = [1, 3, 7, 14, 30] as const;

export type CalendarRemindOffsetDays = (typeof CALENDAR_REMIND_OFFSET_DAYS)[number];

const ALLOWED = new Set<number>(CALENDAR_REMIND_OFFSET_DAYS);

export function normalizeRemindOffsets(input: unknown): CalendarRemindOffsetDays[] {
  if (!Array.isArray(input)) return [];
  const next = new Set<CalendarRemindOffsetDays>();
  for (const raw of input) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    const days = Math.trunc(n);
    if (ALLOWED.has(days)) next.add(days as CalendarRemindOffsetDays);
  }
  return CALENDAR_REMIND_OFFSET_DAYS.filter((d) => next.has(d));
}
