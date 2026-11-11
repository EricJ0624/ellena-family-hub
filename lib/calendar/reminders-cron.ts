import { CURRENT_APP_ID } from '@/lib/apps';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import {
  CALENDAR_REMIND_OFFSET_DAYS,
  isRemindOffsetDue,
  kstTodayDateStr,
  normalizeRemindOffsets,
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

async function deleteDispatch(
  supabase: ReturnType<typeof getSupabaseServerClient>,
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

    const offsets = normalizeRemindOffsets(event.remind_offsets);

    for (const offsetDays of offsets) {
      // 발송일 당일만 보면, 그 날 크론이 빠지면 다음 날부터 영원히 건너뛴다.
      if (!isRemindOffsetDue(eventDate, offsetDays, fireDate)) continue;
      const dueDate = shiftDateStr(eventDate, -offsetDays);

      result.due += 1;

      if (dryRun) {
        result.notified += 1;
        continue;
      }

      const { error: insertError } = await supabase.from('calendar_reminder_dispatches').insert({
        event_id: eventId,
        group_id: groupId,
        offset_days: offsetDays,
        fire_date: dueDate,
      });

      if (insertError) {
        if (String(insertError.code) === '23505' || /duplicate|unique/i.test(insertError.message)) {
          result.skipped += 1;
          continue;
        }
        result.errors.push(`${eventId}/${offsetDays}: ${insertError.message}`);
        continue;
      }

      try {
        const recipients = await getGroupMemberUserIds(groupId, supabase);
        if (recipients.length === 0) {
          await deleteDispatch(supabase, eventId, offsetDays, dueDate);
          result.skipped += 1;
          continue;
        }

        const sticker =
          typeof event.sticker_emoji === 'string' && event.sticker_emoji.trim()
            ? event.sticker_emoji.trim()
            : null;
        const notifyResult = await notifyFamily({
          groupId,
          actorUserId: null,
          recipientUserIds: recipients,
          widgetKey: 'calendar',
          eventType: 'CALENDAR_EVENT_REMINDER',
          title: '📅 다가오는 가족 일정',
          body: reminderBody(eventDate, fireDate),
          url: `/dashboard?focus=calendar&celebrate=${encodeURIComponent(eventId)}`,
          entityId: eventId,
          payload: {
            celebration: true,
            eventId,
            offsetDays,
            eventDate,
            sticker_emoji: sticker,
          },
          tag: `calendar-reminder-${eventId}-${offsetDays}-${dueDate}`,
          appId: CURRENT_APP_ID,
        });

        const delivered = notifyResult.notified > 0 || notifyResult.pushSent > 0;
        if (delivered) {
          result.notified += 1;
          result.skipped += notifyResult.skipped;
          continue;
        }

        // 전원 수신 거부(prefs off)면 재시도 불필요. 그 외 soft-fail은 dispatch 롤백.
        if (notifyResult.skipped > 0) {
          result.skipped += notifyResult.skipped;
          continue;
        }

        await deleteDispatch(supabase, eventId, offsetDays, dueDate);
        result.errors.push(`${eventId}/${offsetDays}: notify produced no delivery`);
      } catch (err) {
        await deleteDispatch(supabase, eventId, offsetDays, dueDate);
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`${eventId}/${offsetDays}: ${message}`);
      }
    }
  }

  return result;
}
