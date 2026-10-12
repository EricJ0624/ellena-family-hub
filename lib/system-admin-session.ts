import { AsyncLocalStorage } from 'node:async_hooks';

type SystemAdminSession = {
  userId: string;
  aal: string | null;
};

const systemAdminSession = new AsyncLocalStorage<SystemAdminSession>();

/** getUser로 검증된 액세스 토큰의 aal. 서명이 확인된 뒤에만 호출한다. */
export function readJwtAal(accessToken: string): string | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { aal?: unknown };
    return typeof json.aal === 'string' ? json.aal : null;
  } catch {
    return null;
  }
}

/** 이 요청의 남은 처리에서 시스템 관리자 권한 판정에 쓴다. */
export function enterSystemAdminSession(userId: string, aal: string | null): void {
  systemAdminSession.enterWith({ userId, aal });
}

/**
 * 요청 안에서 호출자 본인의 시스템 관리자 권한은 AAL2일 때만 허용한다.
 * 로그인 bootstrap처럼 세션 맥락이 없거나, 다른 사용자 소속 조회는 막지 않는다.
 */
export function systemAdminPrivilegeAllowed(userId: string): boolean {
  const current = systemAdminSession.getStore();
  if (!current || current.userId !== userId) return true;
  return current.aal === 'aal2';
}
