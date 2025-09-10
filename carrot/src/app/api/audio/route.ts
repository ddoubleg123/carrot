import { NextRequest, NextResponse } from 'next/server';

// Simple audio proxy to work around Firebase Storage CORS for media playback
// Usage: /api/audio?url=<encoded Firebase download URL>
// - Forwards Range and relevant headers
// - Streams body and preserves 200/206 semantics
// - Sets CORS on our own response so the <audio> element can play

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
]);

function isAllowedUrl(u: URL) {
  return ALLOWED_HOSTS.has(u.hostname);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('url');
    if (!raw) {
      return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
    }
    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
    if (!isAllowedUrl(target)) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
    }

    // Forward important headers, especially Range for media streaming
    const fwdHeaders: HeadersInit = {};
    const range = req.headers.get('range');
    if (range) fwdHeaders['Range'] = range;
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch) fwdHeaders['If-None-Match'] = ifNoneMatch;
    const ifModifiedSince = req.headers.get('if-modified-since');
    if (ifModifiedSince) fwdHeaders['If-Modified-Since'] = ifModifiedSince;

    // Force alt=media for Firebase if not present
    if (!target.searchParams.has('alt')) {
      target.searchParams.set('alt', 'media');
    }

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: fwdHeaders,
      redirect: 'follow',
      // No need for cache: let Firebase and browser handle caching
    });

    const status = upstream.status;
    const headers = new Headers();
    // Copy through essential headers
    const copyHeaders = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified',
      'cache-control',
    ];
    for (const h of copyHeaders) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    // Our CORS + cache headers
    headers.set('Access-Control-Allow-Origin', '*');
    if (!headers.has('cache-control')) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // Stream body directly
    return new NextResponse(upstream.body, { status, headers });
  } catch (e: any) {
    console.error('[api/audio] proxy error', e);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}

export async function HEAD(req: NextRequest) {
  // Implement HEAD by delegating to GET and stripping body
  const res = await GET(req);
  return new NextResponse(null, {
    status: res.status,
    headers: res.headers,
  });
}
