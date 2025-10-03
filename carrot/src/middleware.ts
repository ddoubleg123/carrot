console.log("MIDDLEWARE LOADED");
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Log all API requests to track routing
  if (req.nextUrl.pathname.startsWith('/api/')) {
    console.error('[MIDDLEWARE] API Request:', {
      path: req.nextUrl.pathname,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico).*)"],
};
