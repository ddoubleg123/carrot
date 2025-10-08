import { NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
import { fetchWithRetry, isNetworkProtocolError } from '@/lib/retryUtils';

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
    const rangeParam = searchParams.get('range');
    // Track whether we performed a single decode on the incoming url param
    let decodedOnce = false;

    // Helper: stream via Firebase Admin (supports private objects and Range)
    const adminDownload = async (bucketName: string, objectPath: string): Promise<NextResponse> => {
      try {
        // Initialize admin app if needed
        if (!admin.apps || !admin.apps.length) {
          const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
          if (!PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
            console.warn('[api/video] Firebase Admin SDK not configured, falling back to direct proxy');
            throw new Error('Firebase Admin SDK not configured'); // Throw error to trigger fallback
          }
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          });
        }
        const bucket = admin.storage().bucket(bucketName);
        const file = bucket.file(objectPath.replace(/^\/+/, ''));
        const [meta] = await file.getMetadata().catch(() => [{ contentType: 'video/mp4', cacheControl: 'public, max-age=604800, immutable' }]);

        const range = req.headers.get('range') || rangeParam;
        const size = Number(meta?.size || 0);
        const contentType = meta?.contentType || 'application/octet-stream';
        const cacheControl = meta?.cacheControl || 'public, max-age=604800, immutable';
        if (range && size > 0) {
          const m = /bytes=(\d+)-(\d*)/.exec(range);
          const start = m ? parseInt(m[1], 10) : 0;
          const end = m && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : Math.min(start + 1024 * 1024 - 1, size - 1);
          if (isNaN(start) || isNaN(end) || start > end) return new NextResponse('Malformed Range', { status: 416 });
          const stream = file.createReadStream({ start, end });
          return new NextResponse(stream as any, {
            status: 206,
            headers: {
              'content-type': contentType,
              'cache-control': cacheControl,
              'content-length': String(end - start + 1),
              'content-range': `bytes ${start}-${end}/${size}`,
              'accept-ranges': 'bytes',
              'Access-Control-Allow-Origin': '*',
              'x-video-proxy-host': 'admin',
              'x-video-proxy-mode': 'admin-range',
            },
          });
        }
        const stream = file.createReadStream();
        return new NextResponse(stream as any, {
          status: 200,
          headers: {
            'content-type': contentType,
            'cache-control': cacheControl,
            'accept-ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'x-video-proxy-host': 'admin',
            'x-video-proxy-mode': 'admin-stream',
          },
        });
      } catch (error) {
        console.error('[api/video] Admin SDK error:', error);
        throw error;
      }
    };

    // Helper: simple proxy without Admin SDK (fallback)
    const simpleProxy = async (url: string) => {
      const headers = new Headers();
      const range = req.headers.get('range') || rangeParam;
      if (range) headers.set('range', range);
      const ifModifiedSince = req.headers.get('if-modified-since');
      if (ifModifiedSince) headers.set('if-modified-since', ifModifiedSince);
      const ifNoneMatch = req.headers.get('if-none-match');
      if (ifNoneMatch) headers.set('if-none-match', ifNoneMatch);

      const upstreamRes = await fetchWithRetry(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
      }, {
        maxRetries: 2,
        baseDelay: 1000,
        retryCondition: (error) => error instanceof Error ? isNetworkProtocolError(error) : false
      });

      const responseHeaders = new Headers(upstreamRes.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Cache-Control');
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Cache-Control');
      responseHeaders.set('x-video-proxy-host', 'simple');
      responseHeaders.set('x-video-proxy-mode', 'direct');

      return new NextResponse(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: responseHeaders,
      });
    };

    let target: URL | null = null;
    // Preferred: path-based access using Admin SDK (private-safe) with Range support
    if (pathParam) {
      const bucket = (bucketParam || process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim();
      if (!bucket) return NextResponse.json({ error: 'Missing bucket for path mode' }, { status: 400 });
      // Stream directly via Admin SDK and return early
      try {
        return await adminDownload(bucket, pathParam);
      } catch (e: any) {
        console.warn('[api/video] admin stream failed, falling back to HTTPS', e?.message);
        const encPath = encodeURIComponent(pathParam);
        target = new URL(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encPath}?alt=media`);
      }
    }

    let mode: 'preserved' | 'rewritten' | 'path' = target ? 'path' : 'preserved';
    if (!target) {
      if (!raw) return NextResponse.json({ error: 'Missing url or path param' }, { status: 400 });
      // Unwrap '/api/img?url=...' forms accidentally passed in
      let candidate = raw;
      // Detect signed URLs (GCS V2: GoogleAccessId/Signature/Expires, or GCS V4: X-Goog-*)
      const looksSigned = /(?:[?&])(GoogleAccessId|Signature|Expires|X-Goog-Algorithm|X-Goog-Credential|X-Goog-Date|X-Goog-Expires|X-Goog-SignedHeaders|X-Goog-Signature)=/i.test(candidate);
      // Decode multiple times to handle triple+ encoding. The client encodes the entire URL when passing as query,
      // which turns %40/%2F inside the signed URL into %2540/%252F; we must reduce multiple layers back.
      try {
        let prev = candidate;
        for (let i = 0; i < 5; i++) {
          if (/%[0-9A-Fa-f]{2}/.test(candidate)) {
            const decoded = decodeURIComponent(candidate);
            if (prev === decoded) break; // No more decoding needed
            candidate = decoded;
            prev = candidate;
            decodedOnce = true;
          } else {
            break;
          }
        }
      } catch {}
      try {
        const maybeRel = new URL(candidate, urlObj.origin);
        if (maybeRel.pathname.startsWith('/api/img')) {
          const inner = maybeRel.searchParams.get('url');
          if (inner) candidate = inner;
        }
      } catch {}
      // Additional unwrapping for /api/img patterns
      try {
        if (/%25[0-9A-Fa-f]{2}/.test(candidate)) {
          candidate = decodeURIComponent(candidate);
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

        // Handle Firebase Storage URLs by extracting file path and using Admin SDK
        // This works for both signed and unsigned URLs
        try {
          if (target && (target.hostname === 'firebasestorage.googleapis.com' || target.hostname === 'storage.googleapis.com')) {
            let bucket: string | null = null;
            let objectPath: string | null = null;
            
            // Handle firebasestorage.googleapis.com/v0/b/<bucket>/o/<path> format
            if (target.hostname === 'firebasestorage.googleapis.com') {
              const m = target.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
              if (m) {
                bucket = decodeURIComponent(m[1]);
                objectPath = decodeURIComponent(m[2]);
              }
            }
            // Handle storage.googleapis.com/<bucket>/<path> format
            else if (target.hostname === 'storage.googleapis.com') {
              const m = target.pathname.match(/^\/([^/]+)\/(.+)$/);
              if (m) {
                bucket = decodeURIComponent(m[1]);
                objectPath = decodeURIComponent(m[2]);
              }
            }
            
            // If we extracted bucket and path, use Admin SDK to stream directly
            if (bucket && objectPath) {
              // For modern Firebase projects, keep .firebasestorage.app bucket names as-is
              // Only convert legacy .appspot.com buckets if needed
              if (bucket.endsWith('.firebasestorage.app')) {
                // Keep the .firebasestorage.app bucket name - don't convert to .appspot.com
                console.log('[api/video] Using Firebase bucket:', bucket);
              }
              
              try {
                return await adminDownload(bucket, objectPath);
              } catch (e: any) {
                console.warn('[api/video] admin stream failed, falling back to simple proxy', e?.message);
                // Fall back to simple proxy
                return await simpleProxy(target.toString());
              }
            }
          }
        } catch (error) {
          console.warn('[api/video] Firebase URL processing failed, using simple proxy:', error);
          // Fall back to simple proxy
          if (target) {
            return await simpleProxy(target.toString());
          }
        }

    // Normalize Firebase v0 path: ensure bucket host and /o/<object> are normalized (only for unsigned URLs)
    if (target.hostname === 'firebasestorage.googleapis.com') {
        // Keep .firebasestorage.app bucket names as-is for modern Firebase projects
        try {
          const b = target.searchParams.get('b');
          if (b && b.endsWith('.firebasestorage.app')) {
            // Don't convert .firebasestorage.app to .appspot.com - keep as-is
            console.log('[api/video] Keeping Firebase bucket name:', b);
          }
        } catch {}

      // Also fix when the bucket appears within the v0 path: /v0/b/<bucket>/o/<object>
      try {
        // Only adjust unsigned URLs; signed URLs must not change path semantics
        const isSigned = target.searchParams.has('GoogleAccessId') || target.searchParams.has('Signature') || target.searchParams.has('Expires') ||
          target.searchParams.has('X-Goog-Algorithm');
        if (!isSigned) {
          const m = target.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
          if (m) {
            let bucket = decodeURIComponent(m[1]);
            const objectPart = m[2];
            if (bucket.endsWith('.firebasestorage.app')) {
              // Keep .firebasestorage.app bucket names as-is for modern Firebase projects
              console.log('[api/video] Keeping Firebase bucket in path:', bucket);
            }
          }
        }
      } catch {}

      try {
        const isSigned = target.searchParams.has('GoogleAccessId') || target.searchParams.has('Signature') || target.searchParams.has('Expires') ||
          target.searchParams.has('X-Goog-Algorithm');
        if (!isSigned) {
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
        }
      } catch {}
      // Firebase download endpoints often need alt=media
      try {
        const isSigned = target.searchParams.has('GoogleAccessId') || target.searchParams.has('Signature') || target.searchParams.has('Expires') ||
          target.searchParams.has('X-Goog-Algorithm');
        if (!isSigned && !target.searchParams.has('alt')) target.searchParams.set('alt', 'media');
      } catch {}
    }

    // Forward important headers (exclude problematic headers that cause CORS issues)
    const fwdHeaders: HeadersInit = {};
    const range = req.headers.get('range') || rangeParam; if (range) fwdHeaders['Range'] = range;
    const ifNoneMatch = req.headers.get('if-none-match'); if (ifNoneMatch) fwdHeaders['If-None-Match'] = ifNoneMatch;
    const ifModifiedSince = req.headers.get('if-modified-since'); if (ifModifiedSince) fwdHeaders['If-Modified-Since'] = ifModifiedSince;
    
    // Explicitly exclude headers that cause CORS issues with Firebase Storage
    // Don't forward upgrade-insecure-requests, user-agent, or other browser-specific headers

    // In-flight dedupe: avoid multiple parallel fetches for the same normalized URL
    const k = target.toString();
    try {
      console.log('[api/video] proxy', {
        host: target.hostname,
        pathPrefix: target.pathname.slice(0, 64),
        mode,
      });
    } catch {}
    
    // Add timeout and better error handling for the fetch with retry logic
    const upstream = await fetchDedupe(k, () => fetchWithRetry(k, {
      method: 'GET',
      headers: fwdHeaders,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000), // 15 second timeout
    }, {
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      retryCondition: (error) => error instanceof Error ? isNetworkProtocolError(error) : false
    }).catch(error => {
      console.error('[api/video] Fetch error:', error);
      throw new Error(`Failed to fetch video: ${error.message}`);
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

    // Ensure a safe default content-type for video if upstream omitted it
    if (!headers.has('content-type')) {
      headers.set('content-type', 'video/mp4');
    }

    // Optional redirect for signed or token URLs to avoid any proxy byte-mismatch (feature flagged)
    try {
      const ALLOW_REDIRECT = String(process.env.VIDEO_PROXY_ALLOW_REDIRECT || '0').toLowerCase() === '1';
      const isSignedFinal = target.searchParams.has('GoogleAccessId') || target.searchParams.has('Signature') || target.searchParams.has('Expires') ||
        target.searchParams.has('X-Goog-Algorithm') || target.searchParams.has('token');
      if (ALLOW_REDIRECT && isSignedFinal) {
        const redir = NextResponse.redirect(target.toString(), 302);
        redir.headers.set('Access-Control-Allow-Origin', '*');
        redir.headers.set('Cache-Control', 'public, max-age=300');
        redir.headers.set('x-video-proxy-mode', 'redirect');
        redir.headers.set('x-video-proxy-signed', '1');
        return redir;
      }
    } catch {}

    // Add CORS for our origin with more permissive headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Cache-Control, If-None-Match, If-Modified-Since, Connection');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Cache-Control, Accept-Ranges');
    // Do not set a Connection header in HTTP/2; intermediaries may reject it
    // Short negative caching to prevent request storms on missing/forbidden objects
    if (status === 404 || status === 410 || status === 403) {
      headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    } else if (!headers.has('cache-control')) {
      headers.set('Cache-Control', 'public, max-age=604800, immutable');
    }
    // Ensure Accept-Ranges present for seekability
    if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');

    // Debug headers (do not leak full URL)
    headers.set('x-video-proxy-host', target.hostname);
    headers.set('x-video-proxy-mode', mode);
    try {
      const isSignedFinal = target.searchParams.has('GoogleAccessId') || target.searchParams.has('Signature') || target.searchParams.has('Expires') ||
        target.searchParams.has('X-Goog-Algorithm');
      headers.set('x-video-proxy-decoded', decodedOnce ? '1' : '0');
      headers.set('x-video-proxy-signed', isSignedFinal ? '1' : '0');
      // For unsigned URLs, prefer a strong immutable cache
      if (!isSignedFinal && status >= 200 && status < 300) {
        headers.set('Cache-Control', 'public, max-age=604800, immutable');
      }
    } catch {}

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
    console.error('[api/video] Error details:', {
      message: e.message,
      stack: e.stack,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });
    
    // Check if this is a network protocol error
    const isNetworkError = isNetworkProtocolError(e);
    
    if (isNetworkError) {
      console.warn('[api/video] Network protocol error detected, returning 503 for retry', {
        error: e.message,
        url: req.url,
        isRetryable: true
      });
      return NextResponse.json({ 
        error: 'Network error - please retry', 
        details: 'Temporary network issue',
        retryable: true,
        url: req.url,
        errorType: 'network_protocol_error'
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Video proxy failed', 
      details: e.message,
      url: req.url 
    }, { status: 502 });
  }
}

export async function HEAD(req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
  const res = await GET(req, _ctx);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}

export async function OPTIONS(req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
  // Handle CORS preflight requests
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Cache-Control, If-None-Match, If-Modified-Since',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Cache-Control, Accept-Ranges',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
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
