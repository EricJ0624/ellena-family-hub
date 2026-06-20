import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_PRESENCE_COOKIE } from '@/lib/auth-presence-cookie';
import { isProtectedPath, isPublicPath } from '@/lib/route-guard-config';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasAuthHint = request.cookies.get(AUTH_PRESENCE_COOKIE)?.value === '1';
  if (!hasAuthHint) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
