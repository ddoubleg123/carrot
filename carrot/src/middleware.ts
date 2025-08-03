import { NextResponse } from 'next/server';
import { TEST_USERS, ADMIN_USERS } from '@/config/auth';
import { getToken } from 'next-auth/jwt';

// Paths
const ONBOARDING_PATH = '/onboarding';
const PORTAL_PATH = '/portal';

export async function middleware(req: any) {
  const { pathname } = req.nextUrl;
  // Allow public auth pages
  const PUBLIC_PATHS = ['/login', '/login/', '/signup', '/signup/', '/reset-password', '/reset-password/'];
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  // Allow public assets and Next.js internals
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Get session token (from next-auth)
  const token = await getToken({ req });
  const email = token?.email;
  const isOnboarded = token?.isOnboarded;

  // 1. Always force onboarding for TEST_USERS
  if (email && TEST_USERS.includes(email)) {
    if (pathname !== ONBOARDING_PATH) {
      return NextResponse.redirect(new URL(ONBOARDING_PATH, req.url));
    }
    return NextResponse.next();
  }

  // 2. Allow ADMIN_USERS to access /portal only if logged in with Google
  if (pathname.startsWith(PORTAL_PATH)) {
    if (email && ADMIN_USERS.includes(email) && token?.provider === 'google') {
      return NextResponse.next();
    } else {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // 3. For all other users, require onboarding once
  if (email && !isOnboarded && pathname !== ONBOARDING_PATH) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, req.url));
  }
  // If already onboarded, prevent access to onboarding page
  if (email && isOnboarded && pathname === ONBOARDING_PATH) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico).*)"],
};
