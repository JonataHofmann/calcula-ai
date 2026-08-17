import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/auth/error'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('finance_session');
  if (hasSession) {
    return NextResponse.next();
  }

  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3002';
  const returnTo = encodeURIComponent(`${pathname}${search}`);
  return NextResponse.redirect(`${bffUrl}/auth/login?returnTo=${returnTo}`, 307);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
