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
    const urlObj = new URL(req.url);
    const { searchParams } = urlObj;
    const raw = searchParams.get('url');
    const pathParam = searchParams.get('path');
    const bucketParam = searchParams.get('bucket');

    let target: URL | null = null;
    // Preferred: path-based access to avoid expired signed URLs
    if (pathParam) {
      const bucket = bucketParam?.trim();
      if (!bucket) return NextResponse.json({ error: 'Missing bucket for path mode' }, { status: 400 });
      const encPath = encodeURIComponent(pathParam);
      target = new URL(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encPath}?alt=media`);
    }

    if (!target) {
      if (!raw) return NextResponse.json({ error: 'Missing url or path param' }, { status: 400 });
      // Unwrap '/api/img?url=...' forms accidentally passed in
      let candidate = raw;
      try {
        const maybeRel = new URL(raw, urlObj.origin);
        if (maybeRel.pathname.startsWith('/api/img')) {
          const inner = maybeRel.searchParams.get('url');
          if (inner) candidate = inner;
        }
      } catch {}

      try {
        target = new URL(candidate);
      } catch {
        // Support absolute-path URLs by resolving against origin
        try { target = new URL(candidate, urlObj.origin); } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }); }
      }
      if (!isAllowedUrl(target)) return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
    }

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
