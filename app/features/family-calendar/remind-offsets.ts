/** Allowed reminder offsets in days before event_date. The send clock is 09:00 Asia/Seoul. */
export const CALENDAR_REMIND_OFFSET_DAYS = [1, 3, 7, 14, 30] as const;

export const CALENDAR_REMIND_SEND_HOUR_KST = 9;

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

/** Asia/Seoul 기준 YYYY-MM-DD */
export function kstTodayDateStr(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function kstTimeParts(now = new Date()): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const num = (type: Intl.DateTimeFormatPartTypes) => {
    const value = Number(parts.find((part) => part.type === type)?.value ?? '0');
    return Number.isFinite(value) ? value : 0;
  };
  return { hour: num('hour') % 24, minute: num('minute'), second: num('second') };
}

function kstHour(now = new Date()): number {
  return kstTimeParts(now).hour;
}

/** 발송일 당일, 한국 시간 9시까지 남은 밀리초. 9시가 지났으면 0. */
export function msUntilKstSendHour(now = new Date(), hour = CALENDAR_REMIND_SEND_HOUR_KST): number {
  const clock = kstTimeParts(now);
  const current = clock.hour * 3600 + clock.minute * 60 + clock.second;
  const target = hour * 3600;
  if (current >= target) return 0;
  return (target - current) * 1000;
}

/** 발송일이 오늘이고, 아직 오전 9시 전인 알림이 있는지. */
export function hasRemindOffsetWaitingForSendHour(
  eventDate: string | null | undefined,
  offsets: unknown,
  now = new Date(),
): boolean {
  if (kstHour(now) >= CALENDAR_REMIND_SEND_HOUR_KST) return false;
  const today = kstTodayDateStr(now);
  const eventDay = toDateOnly(eventDate);
  if (!eventDay) return false;
  return normalizeRemindOffsets(offsets).some((offset) => shiftDateStr(eventDay, -offset) === today);
}

/** date 또는 timestamptz 값을 한국 달력의 YYYY-MM-DD로 맞춘다. */
export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  return kstTodayDateStr(d);
}

export function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return kstTodayDateStr(d);
}

export function daysBetweenDateStr(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00+09:00`).getTime();
  const b = new Date(`${to}T12:00:00+09:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * 발송일 오전 9시(한국)부터 일정 다음 날까지 보낼 알림이다.
 * 발송일 당일 9시 전은 아직 아니다. 그 아침을 놓친 뒤는 시각과 관계없이 한 번 보낸다.
 */
export function isRemindOffsetDue(
  eventDate: string | null | undefined,
  offsetDays: number,
  today = kstTodayDateStr(),
  now = new Date(),
): boolean {
  const eventDay = toDateOnly(eventDate);
  if (!eventDay) return false;
  const dueDate = shiftDateStr(eventDay, -offsetDays);
  const lastSendDay = shiftDateStr(eventDay, 1);
  if (today < dueDate || today > lastSendDay) return false;
  const realToday = kstTodayDateStr(now);
  if (today === dueDate && today === realToday && kstHour(now) < CALENDAR_REMIND_SEND_HOUR_KST) return false;
  return true;
}

/** 지금 보내야 하는 알림 종류. 1일·3일·1주·2주·1개월을 같은 규칙으로 본다. */
export function dueRemindOffsets(
  eventDate: string | null | undefined,
  offsets: unknown,
  today = kstTodayDateStr(),
  now = new Date(),
): CalendarRemindOffsetDays[] {
  return normalizeRemindOffsets(offsets).filter((offset) => isRemindOffsetDue(eventDate, offset, today, now));
}

export function reminderBody(eventDate: string, fireDate: string): string {
  const daysUntil = daysBetweenDateStr(fireDate, eventDate);
  if (daysUntil === 1) return '내일 일정이 있어요.';
  if (daysUntil === 0) return '오늘 일정이 있어요.';
  if (daysUntil > 1) return `${daysUntil}일 뒤 일정이 있어요.`;
  return '가족 일정 알림이 있어요.';
}
