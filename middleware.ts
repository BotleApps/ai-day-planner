import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { NextResponse } from 'next/server';

// Use the edge-safe config in middleware (no Node-only deps like
// google-auth-library, which only lives in the full `auth.ts`).
const { auth } = NextAuth(authConfig);

/** Build a base URL that respects reverse-proxy headers (Render's edge sets X-Forwarded-*). */
function getBaseUrl(req: { headers: Headers; nextUrl: URL }): URL {
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  return new URL(`${proto}://${host}`);
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Always allow: NextAuth internal routes and health check
  const PUBLIC_API_PREFIXES = ['/api/auth', '/api/health'];
  if (PUBLIC_API_PREFIXES.some(p => nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Share-link API routes are public (they serve unauthenticated viewers)
  const PUBLIC_API_EXACT = ['/api/plans', '/api/checklists', '/api/activities'];
  if (PUBLIC_API_EXACT.some(p => nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Landing page and share links — always public
  if (nextUrl.pathname === '/') {
    return NextResponse.next();
  }

  // Template detail pages — public so anyone with a shared link can view
  if (nextUrl.pathname.startsWith('/templates/')) {
    return NextResponse.next();
  }

  const base = getBaseUrl(req);

  // Sign-in page: redirect logged-in users to callbackUrl (or home)
  if (nextUrl.pathname === '/sign-in') {
    if (isLoggedIn) {
      const raw = nextUrl.searchParams.get('callbackUrl') ?? '/';
      // Reject external/protocol-relative redirects
      const safe = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(':') ? raw : '/';
      return NextResponse.redirect(new URL(safe, base));
    }
    return NextResponse.next();
  }

  // Protect all other routes — send to landing page where user can sign in.
  // We redirect to '/' rather than '/sign-in' to avoid redirect loops, since
  // the session JWT may not be readable by middleware in all edge cases.
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/', base));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)'],
};
