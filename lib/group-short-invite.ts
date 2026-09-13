/** 4자리 승인형 초대 코드 공통 상수/헬퍼 */

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
} as const;

export type GroupShortInviteErrorCode =
  (typeof GROUP_SHORT_INVITE_ERROR)[keyof typeof GROUP_SHORT_INVITE_ERROR];

export function isShortInviteCode(value: string): boolean {
  return SHORT_INVITE_CODE_REGEX.test(value.trim());
}

export function mapShortInviteRpcError(message: string): {
  status: number;
  code: GroupShortInviteErrorCode | 'UNKNOWN';
  error: string;
} {
  const msg = message || '';
  if (msg.includes('Too many attempts')) {
    return {
      status: 429,
      code: GROUP_SHORT_INVITE_ERROR.RATE_LIMITED,
      error: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    };
  }
  if (msg.includes('GROUP_SUSPENDED')) {
    return {
      status: 403,
      code: GROUP_SHORT_INVITE_ERROR.GROUP_SUSPENDED,
      error: '이 그룹은 현재 이용할 수 없습니다.',
    };
  }
  if (msg.includes('Already a member')) {
    return {
      status: 409,
      code: GROUP_SHORT_INVITE_ERROR.ALREADY_MEMBER,
      error: '이미 이 그룹의 멤버입니다.',
    };
  }
  if (msg.includes('already pending')) {
    return {
      status: 409,
      code: GROUP_SHORT_INVITE_ERROR.ALREADY_PENDING,
      error: '이미 가입 승인 대기 중입니다.',
    };
  }
  if (msg.includes('Only ADMIN')) {
    return {
      status: 403,
      code: GROUP_SHORT_INVITE_ERROR.NOT_ADMIN,
      error: '그룹 관리자만 할 수 있습니다.',
    };
  }
  if (msg.includes('no longer pending')) {
    return {
      status: 409,
      code: GROUP_SHORT_INVITE_ERROR.NO_LONGER_PENDING,
      error: '이미 처리된 요청입니다.',
    };
  }
  if (msg.includes('not found') || msg.includes('Group not found')) {
    return {
      status: 404,
      code: GROUP_SHORT_INVITE_ERROR.NOT_FOUND,
      error: '요청을 찾을 수 없습니다.',
    };
  }
  if (msg.includes('Invalid or expired') || msg.includes('Invalid invite')) {
    return {
      status: 400,
      code: GROUP_SHORT_INVITE_ERROR.INVALID_OR_EXPIRED,
      error: '유효하지 않거나 만료된 초대 코드입니다.',
    };
  }
  return { status: 500, code: 'UNKNOWN', error: '처리에 실패했습니다.' };
}

export function extractBearerToken(request: { headers: { get(name: string): string | null } }): string | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}
