import { normalizeRemindOffsets } from '@/app/features/family-calendar/remind-offsets';
import { supabase } from '@/lib/supabase';
import type { NotifiableWidgetKey, NotificationEventType } from './types';

export interface EmitNotificationClientInput {
  groupId: string;
  widgetKey: NotifiableWidgetKey;
  eventType: NotificationEventType | string;
  title: string;
  body: string;
  url: string;
  entityId?: string | null;
  /** 없으면 서버가 그룹 멤버(본인 제외)로 채움. 지정 시 해당 유저만 */
  recipientUserIds?: string[];
  payload?: Record<string, unknown>;
}

/** 클라이언트 mutation 성공 후 알림 emit (실패해도 본 기능에 영향 없음) */
export async function emitNotificationClient(input: EmitNotificationClientInput): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    void fetch('/api/notifications/emit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    }).catch((err) => {
      console.warn('[emitNotificationClient] 요청 실패:', err);
    });
  } catch (error) {
    console.warn('[emitNotificationClient] 오류:', error);
  }
}

/** 저장 직후, 이미 발송일이 된 일정 알림만 서버에 맡긴다. 실패해도 일정 저장은 유지. */
export async function dispatchDueCalendarReminderClient(input: {
  eventId: string;
  title: string;
  eventDate: string;
  remindOffsets: number[];
}): Promise<void> {
  try {
    if (!input.eventId || /^\d+$/.test(input.eventId)) return;
    if (normalizeRemindOffsets(input.remindOffsets).length === 0) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch('/api/calendar/reminders/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        eventId: input.eventId,
        title: input.title,
      }),
    });
    if (!res.ok) {
      console.warn('[dispatchDueCalendarReminderClient] 요청 실패:', res.status);
    }
  } catch (error) {
    console.warn('[dispatchDueCalendarReminderClient] 오류:', error);
  }
}
