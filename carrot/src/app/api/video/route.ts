import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Rate-limited aggregate logging ---
const STAT: Record<string, number> = Object.create(null);
let STAT_LAST_FLUSH = Date.now();
function statBump(code: number) {
  const k = String(code);
  STAT[k] = (STAT[k] || 0) + 1;
  const now = Date.now();
  if (now - STAT_LAST_FLUSH > 60_000) { // 1 minute
    try { console.log('[api/video] minute status counts', { ...STAT }); } catch {}
    for (const key of Object.keys(STAT)) delete STAT[key];
    STAT_LAST_FLUSH = now;
  }
}

// Video proxy with Range and CORS support
// Usage: /api/video?url=<encoded public/download URL>
// - Forwards Range and selected cache validators
// - Streams body and preserves upstream status (200/206/304)
// - Adds permissive CORS so browsers can play media from our origin

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'commondatastorage.googleapis.com',
  'firebasestorage.app', // generic, also allow subdomains via endsWith
]);

function isAllowedUrl(u: URL) {
  if (ALLOWED_HOSTS.has(u.hostname)) return true;
  // Allow any subdomain of firebasestorage.app
  if (u.hostname.endsWith('.firebasestorage.app')) return true;
  return false;
}

export async function GET(req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
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

    let mode: 'preserved' | 'rewritten' | 'path' = target ? 'path' : 'preserved';
    if (!target) {
      if (!raw) return NextResponse.json({ error: 'Missing url or path param' }, { status: 400 });
      // Unwrap '/api/img?url=...' forms accidentally passed in
      let candidate = raw;
      // Decode at most once. Over-decoding will break signed GCS URLs since the signature
      // is computed over the exact encoded path/query.
      try {
        if (/%[0-9A-Fa-f]{2}/.test(candidate)) {
          candidate = decodeURIComponent(candidate);
        }
      } catch {}
      try {
        const maybeRel = new URL(candidate, urlObj.origin);
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

    // Normalize storage.googleapis.com/<project>.firebasestorage.app/<path> to Firebase v0 only when unsigned.
    // If URL contains GoogleAccessId/Signature/Expires (signed), DO NOT rewrite; those signatures are specific to the original path.
    try {
      if (target && target.hostname === 'storage.googleapis.com') {
        const hasSignedParams = target.searchParams.has('GoogleAccessId') || target.searchParams.has('Signature') || target.searchParams.has('Expires');
        if (!hasSignedParams) {
          // Example path: "/involuted-...p0.firebasestorage.app/ingest/job-123/video.mp4"
          const m = target.pathname.match(/^\/([^/]+)\.firebasestorage\.app\/(.+)$/);
          if (m) {
            const project = decodeURIComponent(m[1]);
            const objectPath = decodeURIComponent(m[2]);
            const bucket = `${project}.appspot.com`;
            const encPath = encodeURIComponent(objectPath);
            const rewritten = new URL(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encPath}?alt=media`);
            // Carry through public download token if present (rare on GCS form)
            const token = target.searchParams.get('token');
            if (token) rewritten.searchParams.set('token', token);
            target = rewritten;
            mode = 'rewritten';
          }
        }
      }
    } catch {}

    // Normalize Firebase v0 path: ensure /o/<object> is encoded exactly once
    if (target.hostname === 'firebasestorage.googleapis.com') {
      try {
        const parts = target.pathname.split('/');
        const oIdx = parts.findIndex((p) => p === 'o');
        if (oIdx > -1 && parts[oIdx + 1]) {
          const rawSeg = parts[oIdx + 1];
          // If looks double-encoded (%252F), decode once and re-encode
          const looksDouble = /%25/i.test(rawSeg);
          const onceDecoded = looksDouble ? decodeURIComponent(rawSeg) : rawSeg;
          const normalizedSeg = encodeURIComponent(onceDecoded);
          if (normalizedSeg !== rawSeg) {
            parts[oIdx + 1] = normalizedSeg;
            target = new URL(target.origin + parts.join('/') + target.search);
          }
        }
      } catch {}
      // Firebase download endpoints often need alt=media
      if (!target.searchParams.has('alt')) target.searchParams.set('alt', 'media');
    }

    // Forward important headers
    const fwdHeaders: HeadersInit = {};
    const range = req.headers.get('range'); if (range) fwdHeaders['Range'] = range;
    const ifNoneMatch = req.headers.get('if-none-match'); if (ifNoneMatch) fwdHeaders['If-None-Match'] = ifNoneMatch;
    const ifModifiedSince = req.headers.get('if-modified-since'); if (ifModifiedSince) fwdHeaders['If-Modified-Since'] = ifModifiedSince;

    // In-flight dedupe: avoid multiple parallel fetches for the same normalized URL
    const k = target.toString();
    try {
      console.log('[api/video] proxy', {
        host: target.hostname,
        pathPrefix: target.pathname.slice(0, 64),
        mode,
      });
    } catch {}
    const upstream = await fetchDedupe(k, () => fetch(k, {
      method: 'GET',
      headers: fwdHeaders,
      redirect: 'follow',
      cache: 'no-store',
    }));

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
    // Short negative caching to prevent request storms on missing/forbidden objects
    if (status === 404 || status === 410 || status === 403) {
      headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    } else if (!headers.has('cache-control')) {
      headers.set('Cache-Control', 'public, max-age=86400');
    }

    // Debug headers (do not leak full URL)
    headers.set('x-video-proxy-host', target.hostname);
    headers.set('x-video-proxy-mode', mode);

    // On errors, log a small snippet of the upstream body to aid diagnosis
    if (status >= 400) {
      try {
        const clone = upstream.clone();
        const text = await clone.text();
        console.warn('[api/video] upstream error', {
          host: target.hostname,
          status,
          mode,
          bodySnippet: text?.slice(0, 256),
        });
      } catch {}
    }
    statBump(status);
    return new NextResponse(upstream.body, { status, headers });
  } catch (e: any) {
    console.error('[api/video] proxy error', e);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}

export async function HEAD(req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
  const res = await GET(req, _ctx);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}

// --- In-flight dedupe helper (simple in-memory short-lived cache) ---
const inflight = new Map<string, Promise<Response>>();
function fetchDedupe(key: string, factory: () => Promise<Response>): Promise<Response> {
  const normalized = key;
  const existing = inflight.get(normalized);
  if (existing) {
    // Important: clone the Response for subsequent consumers to avoid locked body errors
    return existing.then((res) => res.clone());
  }
  const p = factory()
    .catch((e) => { throw e; })
    .finally(() => {
      // Evict after microtask to allow awaiters to read
      queueMicrotask(() => inflight.delete(normalized));
    });
  inflight.set(normalized, p);
  return p;
}
