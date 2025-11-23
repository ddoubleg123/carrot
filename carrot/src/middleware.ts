console.log("MIDDLEWARE LOADED");
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Log all API requests to track routing (especially internal routes)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const isInternal = req.nextUrl.pathname.startsWith('/api/internal/')
    console.error('[MIDDLEWARE] API Request:', {
      path: req.nextUrl.pathname,
      method: req.method,
      isInternal,
      timestamp: new Date().toISOString()
    });
  }
  
  // Allow through - route handlers do their own auth
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico).*)"],
};
