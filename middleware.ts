import { auth } from '@/auth';
import { NextResponse } from 'next/server';

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

  // Sign-in page: redirect to home if already logged in
  if (nextUrl.pathname === '/sign-in') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', nextUrl));
    }
    return NextResponse.next();
  }

  // Protect all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/sign-in', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)'],
};
