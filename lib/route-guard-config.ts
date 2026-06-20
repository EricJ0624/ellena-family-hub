import { AUTH_PRESENCE_COOKIE } from '@/lib/auth-presence-cookie';

export { AUTH_PRESENCE_COOKIE };

/** 세션 불필요 (정확히 일치) */
export const PUBLIC_EXACT_PATHS = ['/', '/reset-password', '/auth/callback'] as const;

/** 세션 필요, 그룹 멤버십 불필요 (prefix) */
export const AUTH_ONLY_PREFIXES = ['/onboarding', '/admin'] as const;

/** 세션 + 그룹(또는 sysadmin→/admin) 필요 (prefix) */
export const GROUP_REQUIRED_PREFIXES = [
  '/dashboard',
  '/piggy-bank',
  '/memories',
  '/travel',
  '/group-admin',
] as const;

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
}

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_EXACT_PATHS as readonly string[]).includes(normalizePathname(pathname));
}

export function isAuthOnlyPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return AUTH_ONLY_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isGroupRequiredPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return GROUP_REQUIRED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return isAuthOnlyPath(pathname) || isGroupRequiredPath(pathname);
}
