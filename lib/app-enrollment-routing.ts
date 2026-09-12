import type { AuthBootstrapPayload } from '@/lib/auth-bootstrap-server';
import {
  buildOnboardingPath,
  isValidInviteCodeFormat,
} from '@/lib/family-auth-routing';
import { dashboardHrefWithOpenGroup } from '@/lib/group-id-resolve';

export const APP_ENROLL_PATH = '/app-enroll';

/** 멤버 기능 진입 전 앱 가입 동의가 필요한지 */
export function needsAppEnrollment(bootstrap: AuthBootstrapPayload): boolean {
  if (bootstrap.hasAppEnrollment) return false;
  // 시스템 관리자 + 무그룹 → /admin 콘솔만 enrollment 없이 허용
  if (bootstrap.isSystemAdmin && !bootstrap.hasGroups) return false;
  return true;
}

export function buildAppEnrollPath(invite: string | null | undefined): string {
  const v = invite?.trim();
  if (v && isValidInviteCodeFormat(v)) {
    return `${APP_ENROLL_PATH}?invite=${encodeURIComponent(v)}`;
  }
  return APP_ENROLL_PATH;
}

/**
 * 로그인/콜백 직후 목적지.
 * enrollment 없으면 /app-enroll (단, 무그룹 시스템 관리자는 /admin).
 */
export function resolvePostAuthPath(
  bootstrap: AuthBootstrapPayload,
  invite: string | null | undefined,
): string {
  if (!bootstrap.hasAppEnrollment) {
    if (bootstrap.isSystemAdmin && !bootstrap.hasGroups) {
      return '/admin';
    }
    return buildAppEnrollPath(invite);
  }

  if (invite) {
    return buildOnboardingPath(invite);
  }
  if (bootstrap.lookupFailed) {
    return buildOnboardingPath(null);
  }
  if (bootstrap.hasGroups && bootstrap.accessibleGroupIds.length === 0) {
    return '/suspended';
  }
  if (bootstrap.isSystemAdmin && !bootstrap.hasGroups) {
    return '/admin';
  }
  if (bootstrap.accessibleGroupIds.length === 1) {
    return dashboardHrefWithOpenGroup(bootstrap.accessibleGroupIds[0]);
  }
  return buildOnboardingPath(null);
}
