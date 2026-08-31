/** 이메일 초대 API 공통 상수·유틸 */

export const GROUP_EMAIL_INVITE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GROUP_EMAIL_INVITE_ERROR = {
  INVALID_EMAIL: 'INVALID_EMAIL',
  USER_NOT_REGISTERED: 'USER_NOT_REGISTERED',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  ALREADY_PENDING: 'ALREADY_PENDING',
  CANNOT_INVITE_SELF: 'CANNOT_INVITE_SELF',
  GROUP_SUSPENDED: 'GROUP_SUSPENDED',
} as const;

export type GroupEmailInviteErrorCode =
  (typeof GROUP_EMAIL_INVITE_ERROR)[keyof typeof GROUP_EMAIL_INVITE_ERROR];

export function normalizeInviteEmail(value: string): string {
  return value.trim().toLowerCase();
}

export type PendingGroupEmailInvite = {
  id: string;
  group_id: string;
  group_name: string;
  invited_by_name: string | null;
  created_at: string;
  expires_at: string;
};
