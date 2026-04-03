import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/** Build a base URL that respects reverse-proxy headers (CF GoRouter, etc.) */
function getBaseUrl(req: { headers: Headers; nextUrl: URL }): URL {
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  return new URL(`${proto}://${host}`);
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Always allow: NextAuth internal routes
  if (nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Always allow: health check
  if (nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  // Always allow: public share link (/?share=xxx)
  if (nextUrl.pathname === '/' && nextUrl.searchParams.has('share')) {
    return NextResponse.next();
  }

  // Always allow: public checklist share link (/?cshare=xxx)
  if (nextUrl.pathname === '/' && nextUrl.searchParams.has('cshare')) {
    return NextResponse.next();
  }

  const base = getBaseUrl(req);

  // Sign-in page: redirect to home if already logged in
  if (nextUrl.pathname === '/sign-in') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', base));
    }
    return NextResponse.next();
  }

  // Protect all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/sign-in', base));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)'],
};
