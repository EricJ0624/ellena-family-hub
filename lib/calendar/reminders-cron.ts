import { CURRENT_APP_ID } from '@/lib/apps';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import {
  CALENDAR_REMIND_OFFSET_DAYS,
  dueRemindOffsets,
  isRemindOffsetDue,
  kstTodayDateStr,
  reminderBody,
  shiftDateStr,
  toDateOnly,
} from '@/app/features/family-calendar/remind-offsets';
import { getGroupMemberUserIds, notifyFamily } from '@/lib/notifications/notify';

export type CalendarReminderCronResult = {
  fireDate: string;
  scanned: number;
  due: number;
  notified: number;
  skipped: number;
  errors: string[];
};

type SupabaseServer = ReturnType<typeof getSupabaseServerClient>;

type DispatchStatus = 'notified' | 'skipped' | 'error';

type ReminderEvent = {
  id: string;
  groupId: string;
  eventDate: string;
  stickerEmoji: string | null;
  remindOffsets: unknown;
};

function plainReminderTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned || null;
}

function readSticker(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function recordDispatch(
  result: { notified: number; skipped: number; errors: string[] },
  label: string,
  run: () => Promise<DispatchStatus>,
) {
  try {
    const status = await run();
    if (status === 'notified') result.notified += 1;
    else if (status === 'skipped') result.skipped += 1;
    else result.errors.push(`${label}: notify produced no delivery`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${label}: ${message}`);
  }
}

async function deleteDispatch(
  supabase: SupabaseServer,
  eventId: string,
  offsetDays: number,
  fireDate: string,
) {
  await supabase
    .from('calendar_reminder_dispatches')
    .delete()
    .eq('event_id', eventId)
    .eq('offset_days', offsetDays)
    .eq('fire_date', fireDate);
}

/** 이미 발송일이 된 알림 하나를 기록하고 가족에게 보낸다. 같은 발송일은 한 번만. */
async function dispatchOneCalendarReminder(
  supabase: SupabaseServer,
  input: {
    eventId: string;
    groupId: string;
    eventDate: string;
    offsetDays: number;
    stickerEmoji: string | null;
    plainTitle?: string | null;
    today: string;
    dryRun?: boolean;
  },
): Promise<DispatchStatus> {
  const dueDate = shiftDateStr(input.eventDate, -input.offsetDays);
  if (!isRemindOffsetDue(input.eventDate, input.offsetDays, input.today)) return 'skipped';
  if (input.dryRun) return 'notified';

  const { error: insertError } = await supabase.from('calendar_reminder_dispatches').insert({
    event_id: input.eventId,
    group_id: input.groupId,
    offset_days: input.offsetDays,
    fire_date: dueDate,
  });

  if (insertError) {
    if (String(insertError.code) === '23505' || /duplicate|unique/i.test(insertError.message)) {
      return 'skipped';
    }
    throw new Error(insertError.message);
  }

  try {
    const recipients = await getGroupMemberUserIds(input.groupId, supabase);
    if (recipients.length === 0) {
      await deleteDispatch(supabase, input.eventId, input.offsetDays, dueDate);
      return 'skipped';
    }

    const title = input.plainTitle
      ? `📅 ${input.plainTitle}`
      : '📅 다가오는 가족 일정';
    const notifyResult = await notifyFamily({
      groupId: input.groupId,
      actorUserId: null,
      recipientUserIds: recipients,
      widgetKey: 'calendar',
      eventType: 'CALENDAR_EVENT_REMINDER',
      title,
      body: reminderBody(input.eventDate, input.today),
      url: `/dashboard?focus=calendar&celebrate=${encodeURIComponent(input.eventId)}`,
      entityId: input.eventId,
      payload: {
        celebration: true,
        eventId: input.eventId,
        offsetDays: input.offsetDays,
        eventDate: input.eventDate,
        sticker_emoji: input.stickerEmoji,
      },
      tag: `calendar-reminder-${input.eventId}-${input.offsetDays}-${dueDate}`,
      appId: CURRENT_APP_ID,
    });

    const delivered = notifyResult.notified > 0 || notifyResult.pushSent > 0;
    if (delivered) return 'notified';
    if (notifyResult.skipped > 0) return 'skipped';

    await deleteDispatch(supabase, input.eventId, input.offsetDays, dueDate);
    return 'error';
  } catch (err) {
    await deleteDispatch(supabase, input.eventId, input.offsetDays, dueDate);
    throw err;
  }
}

export async function runCalendarReminderCron(options?: {
  fireDate?: string;
  dryRun?: boolean;
}): Promise<CalendarReminderCronResult> {
  const fireDate = options?.fireDate || kstTodayDateStr();
  const dryRun = !!options?.dryRun;
  const result: CalendarReminderCronResult = {
    fireDate,
    scanned: 0,
    due: 0,
    notified: 0,
    skipped: 0,
    errors: [],
  };

  const supabase = getSupabaseServerClient();
  const { data: events, error } = await supabase
    .from('family_events')
    .select('id, group_id, event_date, sticker_emoji, remind_offsets')
    .eq('app_id', CURRENT_APP_ID)
    .overlaps('remind_offsets', [...CALENDAR_REMIND_OFFSET_DAYS]);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = events || [];
  result.scanned = rows.length;

  for (const event of rows) {
    const eventId = String(event.id);
    const groupId = event.group_id ? String(event.group_id) : '';
    if (!groupId) {
      result.skipped += 1;
      continue;
    }

    const eventDate = toDateOnly(event.event_date);
    if (!eventDate) {
      result.skipped += 1;
      continue;
    }

    const sticker = readSticker(event.sticker_emoji);
    for (const offsetDays of dueRemindOffsets(event.event_date, event.remind_offsets, fireDate)) {
      result.due += 1;
      await recordDispatch(result, `${eventId}/${offsetDays}`, () =>
        dispatchOneCalendarReminder(supabase, {
          eventId,
          groupId,
          eventDate,
          offsetDays,
          stickerEmoji: sticker,
          today: fireDate,
          dryRun,
        }),
      );
    }
  }

  return result;
}

/** 저장 API가 멤버 확인에 쓰는 일정. 없거나 다른 앱이면 null. */
export async function loadCalendarReminderEvent(eventId: string): Promise<ReminderEvent | null> {
  const supabase = getSupabaseServerClient();
  const { data: event, error } = await supabase
    .from('family_events')
    .select('id, group_id, event_date, sticker_emoji, remind_offsets, app_id')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !event?.group_id) return null;
  if (String(event.app_id || '') !== CURRENT_APP_ID) return null;
  const eventDate = toDateOnly(event.event_date);
  if (!eventDate) return null;

  return {
    id: String(event.id),
    groupId: String(event.group_id),
    eventDate,
    stickerEmoji: readSticker(event.sticker_emoji),
    remindOffsets: event.remind_offsets,
  };
}

/** 저장 직후, 이미 발송일이 된 알림만 보낸다. 아직 전인 알림은 아침 크론에 남긴다. */
export async function dispatchDueRemindersForEvent(
  event: ReminderEvent,
  plainTitle: unknown,
): Promise<Pick<CalendarReminderCronResult, 'due' | 'notified' | 'skipped' | 'errors'>> {
  const today = kstTodayDateStr();
  const result = { due: 0, notified: 0, skipped: 0, errors: [] as string[] };
  const supabase = getSupabaseServerClient();
  const title = plainReminderTitle(plainTitle);

  for (const offsetDays of dueRemindOffsets(event.eventDate, event.remindOffsets, today)) {
    result.due += 1;
    await recordDispatch(result, String(offsetDays), () =>
      dispatchOneCalendarReminder(supabase, {
        eventId: event.id,
        groupId: event.groupId,
        eventDate: event.eventDate,
        offsetDays,
        stickerEmoji: event.stickerEmoji,
        plainTitle: title,
        today,
      }),
    );
  }

  return result;
}
