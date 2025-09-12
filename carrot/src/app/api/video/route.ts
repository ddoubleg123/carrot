import { NextRequest, NextResponse } from 'next/server';

// Video proxy with Range and CORS support
// Usage: /api/video?url=<encoded public/download URL>
// - Forwards Range and selected cache validators
// - Streams body and preserves upstream status (200/206/304)
// - Adds permissive CORS so browsers can play media from our origin

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

function isAllowedUrl(u: URL) {
  return ALLOWED_HOSTS.has(u.hostname);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('url');
    if (!raw) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

    let target: URL;
    try { target = new URL(raw); } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }); }
    if (!isAllowedUrl(target)) return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });

    // Forward important headers
    const fwdHeaders: HeadersInit = {};
    const range = req.headers.get('range'); if (range) fwdHeaders['Range'] = range;
    const ifNoneMatch = req.headers.get('if-none-match'); if (ifNoneMatch) fwdHeaders['If-None-Match'] = ifNoneMatch;
    const ifModifiedSince = req.headers.get('if-modified-since'); if (ifModifiedSince) fwdHeaders['If-Modified-Since'] = ifModifiedSince;

    // Firebase download endpoints often need alt=media
    if (target.hostname === 'firebasestorage.googleapis.com' && !target.searchParams.has('alt')) {
      target.searchParams.set('alt', 'media');
    }

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: fwdHeaders,
      redirect: 'follow',
    });

    const status = upstream.status;
    const headers = new Headers();
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

    // Add CORS for our origin
    headers.set('Access-Control-Allow-Origin', '*');
    if (!headers.has('cache-control')) headers.set('Cache-Control', 'public, max-age=86400');

    return new NextResponse(upstream.body, { status, headers });
  } catch (e: any) {
    console.error('[api/video] proxy error', e);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}

export async function HEAD(req: NextRequest) {
  const res = await GET(req);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
