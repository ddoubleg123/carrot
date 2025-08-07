console.log("MIDDLEWARE LOADED");
import { NextResponse } from 'next/server';

export function middleware(req) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico).*)"],
};
