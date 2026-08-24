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

  // Same-origin via proxy reverso (`/bff/*`). URL absoluta na própria origem do
  // request — o cookie setado no callback cai no host do web e o middleware o vê.
  const returnTo = encodeURIComponent(`${pathname}${search}`);
  const loginUrl = new URL(`/bff/auth/login?returnTo=${returnTo}`, request.nextUrl.origin);
  return NextResponse.redirect(loginUrl, 307);
}

export const config = {
  // Exclui `bff` — são rotas do proxy reverso (login/callback/API do BFF). O middleware
  // roda antes dos rewrites; sem isso, /bff/auth/login entraria em loop de redirect.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|bff/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
