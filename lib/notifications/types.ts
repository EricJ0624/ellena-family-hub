/** 알림 대상 위젯 (album, travel_diary 제외) */
export const NOTIFIABLE_WIDGET_KEYS = [
  'tasks',
  'calendar',
  'chat',
  'location',
  'travel',
  'piggy',
  'games',
] as const;

export type NotifiableWidgetKey = (typeof NOTIFIABLE_WIDGET_KEYS)[number];

export function isNotifiableWidgetKey(value: string): value is NotifiableWidgetKey {
  return (NOTIFIABLE_WIDGET_KEYS as readonly string[]).includes(value);
}

export type NotificationEventType =
  | 'LOCATION_REQUEST'
  | 'LOCATION_RESPONSE'
  | 'CHAT_MESSAGE'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_EVENT_DELETED'
  | 'PIGGY_ACCOUNT_REQUEST'
  | 'PIGGY_ACCOUNT_RESOLVED'
  | 'PIGGY_OPEN_REQUEST'
  | 'PIGGY_OPEN_RESOLVED'
  | 'PIGGY_ALLOWANCE'
  | 'PIGGY_DEPOSIT'
  | 'GAME_SESSION_CREATED'
  | 'GAME_LOBBY_JOINED'
  | 'TRAVEL_TRIP_CREATED';

export interface NotifyFamilyInput {
  groupId: string;
  actorUserId: string | null;
  recipientUserIds: string[];
  widgetKey: NotifiableWidgetKey;
  eventType: NotificationEventType | string;
  title: string;
  body: string;
  url: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  tag?: string;
}

export interface NotifyFamilyResult {
  notified: number;
  skipped: number;
  pushSent: number;
  pushFailed: number;
}

export interface NotificationRow {
  id: string;
  group_id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  widget_key: NotifiableWidgetKey;
  event_type: string;
  title: string;
  body: string;
  url: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferenceRow {
  user_id: string;
  group_id: string;
  widget_key: NotifiableWidgetKey;
  push_enabled: boolean;
  inapp_enabled: boolean;
  updated_at: string;
}
