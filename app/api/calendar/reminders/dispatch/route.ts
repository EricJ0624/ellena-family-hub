import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { dispatchDueRemindersForEvent, loadCalendarReminderEvent } from '@/lib/calendar/reminders-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 일정 저장 직후, 이미 발송일이 된 알림만 한 번 보낸다.
 * 발송일 전 알림은 여기서 만들지 않는다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => null);
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    if (!eventId || /^\d+$/.test(eventId)) {
      return NextResponse.json({ error: 'eventId가 필요합니다.' }, { status: 400 });
    }

    const event = await loadCalendarReminderEvent(eventId);
    if (!event) {
      return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const memberCheck = await requireGroupMember(user.id, event.groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const result = await dispatchDueRemindersForEvent(event, body?.title);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[calendar/reminders/dispatch]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
