import { NextResponse } from 'next/server';
import { fetchWithRetry, isNetworkProtocolError } from '@/lib/retryUtils';

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

export async function GET(req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
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

    // Forward a bounded Range so seeking still works. Do not forward
    // If-None-Match / If-Modified-Since: a 304 has no bytes, and the player
    // stops after the first buffered slice. bytes=0- means "the whole file".
    const fwdHeaders: Record<string, string> = {};
    const range = req.headers.get('range');
    const wantsWholeFile = !range || /^bytes=0-$/i.test(range.trim());
    if (range && !wantsWholeFile) fwdHeaders['Range'] = range;

    // Force alt=media for Firebase if not present
    if (!target.searchParams.has('alt')) {
      target.searchParams.set('alt', 'media');
    }

    // CRITICAL FIX: Use native fetch with proper stream handling instead of retry wrapper
    // The retry wrapper was causing 502 errors due to stream interruptions
    console.log('[api/audio] Fetching audio', {
      url: target.toString().substring(0, 100) + '...',
      hasRange: !!fwdHeaders['Range'],
      range: fwdHeaders['Range']
    });
    
    const fetchAudio = () => fetch(target.toString(), {
      method: 'GET',
      headers: {
        ...fwdHeaders,
        'Accept': 'audio/*',
        'User-Agent': 'Mozilla/5.0 (compatible; AudioProxy/1.0)',
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(60000), // 60 second timeout for large audio files
    });

    let upstream = await fetchAudio();
    // A conditional request can still come back empty. Fetch the bytes again.
    if (upstream.status === 304) {
      delete fwdHeaders['Range'];
      upstream = await fetchAudio();
    }
    
    console.log('[api/audio] Fetch response', {
      status: upstream.status,
      statusText: upstream.statusText,
      contentLength: upstream.headers.get('content-length'),
      contentType: upstream.headers.get('content-type'),
      url: target.toString().substring(0, 100) + '...'
    });
    
    if (!upstream.ok) {
      throw new Error(`HTTP ${upstream.status}: ${upstream.statusText}`);
    }

    const status = upstream.status;
    const headers = new Headers();
    // Copy through essential headers
    const copyHeaders = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
    ];
    for (const h of copyHeaders) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    // A full-file response must not look like a partial one, or the player
    // treats the first slice as the end of the recording.
    if (status !== 206) headers.delete('content-range');
    if (!headers.has('accept-ranges')) headers.set('Accept-Ranges', 'bytes');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'no-store');

    // Stream body directly
    return new NextResponse(upstream.body, { status, headers });
  } catch (e: any) {
    console.error('[api/audio] proxy error', e);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}

export async function HEAD(req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
  // Implement HEAD by delegating to GET and stripping body
  const res = await GET(req, _ctx);
  return new NextResponse(null, {
    status: res.status,
    headers: res.headers,
  });
}
