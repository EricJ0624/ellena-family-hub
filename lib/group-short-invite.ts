/** 4자리 승인형 초대 코드 공통 상수/헬퍼 (관리자 입력형) */

export const SHORT_INVITE_CODE_REGEX = /^\d{4}$/;

export const GROUP_SHORT_INVITE_ERROR = {
  INVALID_OR_EXPIRED: 'INVALID_OR_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  ALREADY_PENDING: 'ALREADY_PENDING',
  NOT_ADMIN: 'NOT_ADMIN',
  NOT_FOUND: 'NOT_FOUND',
  NO_LONGER_PENDING: 'NO_LONGER_PENDING',
  GROUP_SUSPENDED: 'GROUP_SUSPENDED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  CODE_IN_USE: 'CODE_IN_USE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type GroupShortInviteErrorCode =
  (typeof GROUP_SHORT_INVITE_ERROR)[keyof typeof GROUP_SHORT_INVITE_ERROR];

export function isShortInviteCode(value: string): boolean {
  return SHORT_INVITE_CODE_REGEX.test(value.trim());
}

/** RPC/서버 오류 → 안정적 code (UI는 code로 i18n 매핑) */
export function mapShortInviteRpcError(message: string): {
  status: number;
  code: GroupShortInviteErrorCode;
} {
  const msg = message || '';
  if (msg.includes('User must be authenticated')) {
    return { status: 401, code: GROUP_SHORT_INVITE_ERROR.UNAUTHENTICATED };
  }
  if (msg.includes('Too many attempts')) {
    return { status: 429, code: GROUP_SHORT_INVITE_ERROR.RATE_LIMITED };
  }
  if (msg.includes('GROUP_SUSPENDED')) {
    return { status: 403, code: GROUP_SHORT_INVITE_ERROR.GROUP_SUSPENDED };
  }
  if (msg.includes('Already a member')) {
    return { status: 409, code: GROUP_SHORT_INVITE_ERROR.ALREADY_MEMBER };
  }
  if (msg.includes('already pending')) {
    return { status: 409, code: GROUP_SHORT_INVITE_ERROR.ALREADY_PENDING };
  }
  if (msg.includes('Only ADMIN')) {
    return { status: 403, code: GROUP_SHORT_INVITE_ERROR.NOT_ADMIN };
  }
  if (msg.includes('no longer pending')) {
    return { status: 409, code: GROUP_SHORT_INVITE_ERROR.NO_LONGER_PENDING };
  }
  if (msg.includes('already in use')) {
    return { status: 409, code: GROUP_SHORT_INVITE_ERROR.CODE_IN_USE };
  }
  if (msg.includes('not found') || msg.includes('Group not found')) {
    return { status: 404, code: GROUP_SHORT_INVITE_ERROR.NOT_FOUND };
  }
  if (
    msg.includes('Invalid short invite code') ||
    msg.includes('Invalid or expired') ||
    msg.includes('Invalid invite')
  ) {
    return { status: 400, code: GROUP_SHORT_INVITE_ERROR.INVALID_OR_EXPIRED };
  }
  return { status: 500, code: GROUP_SHORT_INVITE_ERROR.UNKNOWN };
}

export function extractBearerToken(request: {
  headers: { get(name: string): string | null };
}): string | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}
