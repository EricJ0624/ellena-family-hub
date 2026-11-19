import type { TaskRemindOffsetMinutes } from './types';

/** 허용 마감 알림: 1시간 전(60)만. (구 정각 0은 더 이상 쓰지 않음) */
export const TASK_REMIND_OFFSET_MINUTES = [60] as const;

const ALLOWED = new Set<number>(TASK_REMIND_OFFSET_MINUTES);

/** 마감을 넣을 때 기본: 1시간 전 */
export const DEFAULT_TASK_REMIND_OFFSETS: TaskRemindOffsetMinutes[] = [60];

export function normalizeTaskRemindOffsets(input: unknown): TaskRemindOffsetMinutes[] {
  if (!Array.isArray(input)) return [];
  const next = new Set<TaskRemindOffsetMinutes>();
  for (const raw of input) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    const minutes = Math.trunc(n);
    if (ALLOWED.has(minutes)) next.add(minutes as TaskRemindOffsetMinutes);
  }
  return TASK_REMIND_OFFSET_MINUTES.filter((d) => next.has(d));
}

/** due_at 시각에서 offset 분을 뺀 발송 시각 */
export function taskReminderFireAt(dueAtIso: string, offsetMinutes: number): Date | null {
  const due = new Date(dueAtIso);
  if (Number.isNaN(due.getTime())) return null;
  return new Date(due.getTime() - offsetMinutes * 60_000);
}

export function isTaskReminderFireDue(dueAtIso: string, offsetMinutes: number, now = new Date()): boolean {
  const fire = taskReminderFireAt(dueAtIso, offsetMinutes);
  if (!fire) return false;
  return fire.getTime() <= now.getTime();
}

/** datetime-local input 값 → ISO */
export function localInputValueToDueAtIso(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatTaskDueShort(dueAtIso: string | null | undefined, locale?: string): string {
  if (!dueAtIso) return '';
  const d = new Date(dueAtIso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}
