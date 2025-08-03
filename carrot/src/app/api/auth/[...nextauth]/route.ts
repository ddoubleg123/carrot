import { handlers } from '@/auth';
import { NextResponse, NextRequest } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import { serialize } from 'cookie';

// Patch GET and POST handlers to clear stale session cookies before delegating to NextAuth
function clearStaleSessionCookies(request: NextRequest) {
  // Get all cookies from the request
  const cookieHeader = request.headers.get('cookie') || '';
  const all = cookieHeader.split(';').map(c => c.trim());
  const stale = all.filter(c => c.startsWith('next-auth.session-token'));
  // Build Set-Cookie headers to expire each stale cookie
  return stale.map(c => {
    const name = c.split('=')[0];
    return serialize(name, '', {
      maxAge: 0,
      path: '/',
      domain: 'localhost',
      sameSite: 'lax',
    });
  });
}

async function handle(method: 'GET' | 'POST', request: NextRequest, ...args: any[]) {
  const clears = clearStaleSessionCookies(request);
  // Delegate to NextAuth handler
  const handler = handlers[method];
  const response = await handler(request);
  // Set all cookie-clearing headers
  clears.forEach(setCookie => {
    response.headers.append('Set-Cookie', setCookie);
  });
  return response;
}

export const GET = (request: NextRequest, ...args: any[]) => handle('GET', request, ...args);
export const POST = (request: NextRequest, ...args: any[]) => handle('POST', request, ...args);

export const dynamic = 'force-dynamic'; // Ensure the route is dynamic
export const runtime = 'nodejs'; // Ensure we're using Node.js runtime
