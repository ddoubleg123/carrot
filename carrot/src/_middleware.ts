// Minimal middleware that allows all requests to pass through
export default function middleware() {
  // No-op middleware that allows all requests
  return null;
}

export const config = {
  // Match all routes except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
