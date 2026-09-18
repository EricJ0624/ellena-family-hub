/** 첫 미확인 알림 전달 모드 */
export const FIRST_ALERT_MODES = ['voice', 'vibrate', 'silent'] as const;
export type FirstAlertMode = (typeof FIRST_ALERT_MODES)[number];

/** 연속(2번째+) 알림 전달 모드 */
export const SUBSEQUENT_ALERT_MODES = ['vibrate', 'silent'] as const;
export type SubsequentAlertMode = (typeof SUBSEQUENT_ALERT_MODES)[number];

export const DEFAULT_FIRST_ALERT_MODE: FirstAlertMode = 'voice';
export const DEFAULT_SUBSEQUENT_ALERT_MODE: SubsequentAlertMode = 'silent';

/** 하쓰 알림음 (원본 WAV — 확장자 .wav) */
export const HATSU_SOUND_URL = '/sounds/hatsu.wav';

export interface NotificationAlertPreferences {
  first_mode: FirstAlertMode;
  subsequent_mode: SubsequentAlertMode;
}

export function isFirstAlertMode(value: unknown): value is FirstAlertMode {
  return typeof value === 'string' && (FIRST_ALERT_MODES as readonly string[]).includes(value);
}

export function isSubsequentAlertMode(value: unknown): value is SubsequentAlertMode {
  return (
    typeof value === 'string' && (SUBSEQUENT_ALERT_MODES as readonly string[]).includes(value)
  );
}

export function normalizeAlertPreferences(input?: {
  first_mode?: unknown;
  subsequent_mode?: unknown;
} | null): NotificationAlertPreferences {
  return {
    first_mode: isFirstAlertMode(input?.first_mode)
      ? input!.first_mode
      : DEFAULT_FIRST_ALERT_MODE,
    subsequent_mode: isSubsequentAlertMode(input?.subsequent_mode)
      ? input!.subsequent_mode
      : DEFAULT_SUBSEQUENT_ALERT_MODE,
  };
}

/** 포그라운드/푸시 공통: 이번 알림에 적용할 모드 */
export function resolveAlertMode(
  isFirstUnread: boolean,
  prefs: NotificationAlertPreferences,
): FirstAlertMode | SubsequentAlertMode {
  return isFirstUnread ? prefs.first_mode : prefs.subsequent_mode;
}

/** 내 계정에서 알림 모드 저장 후 NotificationCenter 동기화 */
export const NOTIFICATION_ALERT_PREFS_UPDATED_EVENT = 'hearth:notification-alert-prefs-updated';

/** 알림 UI용 위젯 라벨 (설정·목록 공통) */
export const NOTIFIABLE_WIDGET_LABELS: Record<
  import('./types').NotifiableWidgetKey,
  string
> = {
  tasks: '가족 임무',
  calendar: '가족 일정',
  chat: '가족 채팅',
  location: '가족 위치',
  travel: '여행 플래너',
  piggy: '저금통',
  games: '가족 게임',
  group: '그룹',
};
