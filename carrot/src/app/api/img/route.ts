import { NextResponse } from 'next/server'
import type { StorageOptions } from '@google-cloud/storage'
let GCS: any = null; // lazy import to avoid bundling when unused

// Image proxy: fetches bytes server-side and streams to the client.
// Supports either:
//  - url: full remote URL
//  - path: storage path appended to STORAGE_PUBLIC_BASE
// Avoids cross-origin access issues for Firebase/GCS.

const PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE
  || 'https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/';

const ENV_BUCKET = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '').trim();

const PUBLIC_THUMBNAIL_BASE = process.env.PUBLIC_THUMBNAIL_BASE
  || 'https://storage.googleapis.com/carrot-public-thumbnails/';

const SIGN_TTL_SECONDS = (() => {
  const envVal = process.env.STORAGE_SIGN_TTL_SECONDS;
  if (!envVal) return 60 * 60; // default 1h
  const v = parseInt(envVal, 10);
  if (Number.isFinite(v) && v > 0 && v <= 24 * 60 * 60) return v; // up to 24h
  return 60 * 60; // default 1h
})();

// Image proxy + optional transform with long cache
// Usage: /api/img?url=<encoded>&w=400&h=300&q=75&format=webp
// - Preserves aspect ratio by default
// - Prevents upscaling (won't resize beyond source dimensions)
// - Chooses modern format based on Accept if format is not specified
// - Falls back to passthrough if sharp is unavailable or processing fails

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOW_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'images.unsplash.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'localhost',
  '127.0.0.1'
])

function hostAllowed(u: URL) {
  if (ALLOW_HOSTS.has(u.hostname)) return true
  if (u.hostname.endsWith('.firebasestorage.app')) return true
  // Allow localhost in development
  if (process.env.NODE_ENV === 'development' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true
  return false
}

// Extract bucket and object path from various Firebase/GCS URL shapes
function tryExtractBucketAndPath(raw: string): { bucket?: string; path?: string; kind?: 'firebase' | 'gcs' } {
  try {
    const u = new URL(raw)
    const host = u.hostname
    // Firebase REST: /v0/b/<bucket>/o/<ENCODED_PATH>
    const m1 = u.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/)
    if (host === 'firebasestorage.googleapis.com' && m1) {
      return { bucket: decodeURIComponent(m1[1]), path: decodeURIComponent(m1[2]), kind: 'firebase' }
    }
    // GCS XML-style: /<bucket>/<path>
    const m2 = u.pathname.match(/^\/([^/]+)\/(.+)$/)
    if (host === 'storage.googleapis.com' && m2) {
      return { bucket: decodeURIComponent(m2[1]), path: decodeURIComponent(m2[2]), kind: 'gcs' }
    }
    // App subdomain: <sub>.firebasestorage.app/o/<ENCODED_PATH>
    const m3 = u.pathname.match(/^\/o\/([^?]+)$/)
    if (host.endsWith('.firebasestorage.app') && m3) {
      // Best-effort: infer bucket from PUBLIC_BASE fallback if configured
      const baseM = PUBLIC_BASE.match(/\/v0\/b\/([^/]+)\/o\//)
      const fallbackBucket = baseM ? baseM[1] : undefined
      return { bucket: fallbackBucket, path: decodeURIComponent(m3[1]), kind: 'firebase' }
    }
    // Firebase Storage subdomain: <bucket>.firebasestorage.app/<path>
    const m4 = u.pathname.match(/^\/(.+)$/)
    if (host.endsWith('.firebasestorage.app') && m4) {
      // Extract bucket from hostname
      const bucket = host.replace('.firebasestorage.app', '')
      return { bucket, path: decodeURIComponent(m4[1]), kind: 'firebase' }
    }
  } catch {}
  return {}
}

// Lazy-init GCS Storage client from either GOOGLE_APPLICATION_CREDENTIALS (file) or GCS_SA_JSON env
let storageClient: any = null;
function ensureStorage(): any | null {
  try {
    if (storageClient) return storageClient;

    // Use individual Firebase environment variables
    const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
    
    if (firebaseClientEmail && firebasePrivateKey && firebaseProjectId) {
      const opts: StorageOptions = {
        projectId: firebaseProjectId,
        credentials: {
          client_email: firebaseClientEmail,
          private_key: firebasePrivateKey,
        },
      } as any;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      GCS = GCS || require('@google-cloud/storage');
      storageClient = new GCS.Storage(opts);
      return storageClient;
    }

    // Fallback to GCS_SA_JSON if individual Firebase vars not available
    const jsonEnv = process.env.GCS_SA_JSON;
    if (jsonEnv) {
      let creds;
      try { creds = JSON.parse(jsonEnv); } catch { return null; }
      const opts: StorageOptions = {
        projectId: creds.project_id,
        credentials: {
          client_email: creds.client_email,
          private_key: creds.private_key,
        },
      } as any;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      GCS = GCS || require('@google-cloud/storage');
      storageClient = new GCS.Storage(opts);
      return storageClient;
    }

    // Else rely on GOOGLE_APPLICATION_CREDENTIALS or default ADC
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    GCS = GCS || require('@google-cloud/storage');
    storageClient = new GCS.Storage();
    return storageClient;
  } catch {
    return null;
  }
}

async function getFreshSignedUrl(bucket: string, path: string, ttlSec = SIGN_TTL_SECONDS): Promise<string | null> {
  const client = ensureStorage();
  if (!client) {
    console.warn('[Image Proxy] No Firebase Storage client available - credentials missing');
    return null;
  }
  try {
    const b = client.bucket(bucket);
    const f = b.file(path);
    const [url] = await f.getSignedUrl({ action: 'read', expires: Date.now() + ttlSec * 1000 });
    return url;
  } catch (error) {
    console.warn('[Image Proxy] Failed to generate signed URL:', error);
    return null;
  }
}

// Check if path looks like a thumbnail and try public bucket first
function tryPublicThumbnail(path: string): string | null {
  if (!path.includes('thumb') && !path.includes('poster')) return null;
  const cleanPath = path.replace(/^\/+/, '').replace(/\?.*$/, '');
  return `${PUBLIC_THUMBNAIL_BASE}${cleanPath}`;
}

function chooseFormat(acceptHeader?: string | null, explicit?: string | null) {
  if (explicit) return explicit.toLowerCase()
  const a = (acceptHeader || '').toLowerCase()
  if (a.includes('image/avif')) return 'avif'
  if (a.includes('image/webp')) return 'webp'
  return 'jpeg'
}

function clampQuality(q?: number) {
  if (!q || isNaN(q)) return 75
  return Math.min(95, Math.max(30, Math.round(q)))
}

async function fetchUpstream(req: Request, target: URL) {
  // CRITICAL FIX: Implement retry logic with exponential backoff for network errors
  let lastError: Error | null = null;
  const maxRetries = 2; // Fewer retries for images since they're less critical than videos
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[api/img] Fetch attempt ${attempt}/${maxRetries}`, {
        url: target.toString().substring(0, 100) + '...'
      });
      
      const upstream = await fetch(target.toString(), {
        headers: {
          ...(req.headers.get('if-none-match') ? { 'if-none-match': req.headers.get('if-none-match') as string } : {}),
          ...(req.headers.get('if-modified-since') ? { 'if-modified-since': req.headers.get('if-modified-since') as string } : {}),
          accept: req.headers.get('accept') || 'image/avif,image/webp,image/*,*/*;q=0.8',
          // CRITICAL FIX: Force HTTP/1.1 to avoid HTTP/2 protocol errors
          'Connection': 'close',
        },
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(attempt === 1 ? 15000 : 30000), // Shorter timeout for first attempt
      });
      
      console.log(`[api/img] Fetch response (attempt ${attempt})`, {
        status: upstream.status,
        statusText: upstream.statusText,
        contentType: upstream.headers.get('content-type'),
        url: target.toString().substring(0, 100) + '...'
      });
      
      // CRITICAL FIX: Handle specific error status codes
      if (upstream.status >= 500) {
        throw new Error(`Server error ${upstream.status}: ${upstream.statusText}`);
      }
      
      if (upstream.status === 403) {
        console.warn('[api/img] Access forbidden - URL may be expired or invalid', {
          url: target.toString().substring(0, 100) + '...',
          attempt
        });
        throw new Error('Access forbidden - URL may be expired');
      }
      
      return upstream;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // CRITICAL FIX: Check if this is a retryable error
      const isRetryableError = 
        lastError.message.includes('ERR_CONNECTION_CLOSED') ||
        lastError.message.includes('ERR_HTTP_PROTOCOL_ERROR') ||
        lastError.message.includes('fetch failed') ||
        lastError.message.includes('NetworkError') ||
        lastError.message.includes('timeout');
      
      console.error(`[api/img] Fetch failed (attempt ${attempt}/${maxRetries})`, {
        error: lastError.message,
        isRetryable: isRetryableError,
        url: target.toString().substring(0, 100) + '...'
      });
      
      if (attempt === maxRetries || !isRetryableError) {
        throw lastError;
      }
      
      // Exponential backoff: 500ms, 1s
      const delay = Math.min(500 * Math.pow(2, attempt - 1), 1000);
      console.log(`[api/img] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('All fetch attempts failed');
}

async function passthrough(upstream: Response) {
  const status = upstream.status
  const body = upstream.body
  const headers = new Headers()
  headers.set('content-type', upstream.headers.get('content-type') || 'image/*')
  const etag = upstream.headers.get('etag'); if (etag) headers.set('etag', etag)
  const lm = upstream.headers.get('last-modified'); if (lm) headers.set('last-modified', lm)
  headers.set('cache-control', 'public, max-age=604800, s-maxage=604800, immutable')
  headers.set('vary', 'accept')
  headers.set('x-proxy', 'img-pass')
  // Add CORS headers
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, If-None-Match, If-Modified-Since')
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Cache-Control, ETag, Last-Modified')
  return new NextResponse(body, { status, headers })
}

function svgPlaceholder(seed: string) {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hueA = (h % 360);
  const hueB = ((h >> 3) % 360);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA},70%,18%)"/>
      <stop offset="100%" stop-color="hsl(${hueB},70%,10%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;
  return svg;
}

export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  const url = new URL(_req.url)
  const sp = url.searchParams
  const rawUrl = sp.get('url')
  const path = sp.get('path')
  const bucket = sp.get('bucket')
  const generatePoster = sp.get('generatePoster')
  const videoUrl = sp.get('videoUrl')

  // CRITICAL FIX: Reject data URIs immediately - they should never be proxied
  if (rawUrl && rawUrl.startsWith('data:')) {
    console.warn('[Image Proxy] BLOCKED data URI - should be used directly in browser:', rawUrl.substring(0, 100));
    return new NextResponse('Data URIs cannot be proxied - use them directly in the browser', { 
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Proxy-Error': 'data-uri-blocked'
      }
    });
  }

  // Prevent multiple-wrapping: if rawUrl already points to /api/img, try to unwrap multiple times
  if (rawUrl) {
    try {
      let toCheck = rawUrl;
      let decoded = rawUrl;
      
      // First, decode multiple times to handle triple+ encoding
      for (let i = 0; i < 5; i++) {
        const prev = decoded;
        decoded = decodeURIComponent(decoded);
        if (prev === decoded) break; // No more decoding needed
      }
      
      toCheck = decoded;
      
      // Then unwrap /api/img wrappers
      for (let i = 0; i < 5 && toCheck.includes('/api/img'); i++) {
        const inner = new URL(toCheck.startsWith('http') ? toCheck : toCheck, url.origin);
        if (inner.pathname.startsWith('/api/img')) {
          const innerUrl = inner.searchParams.get('url');
          const innerPath = inner.searchParams.get('path');
          const innerBucket = inner.searchParams.get('bucket');
          if (innerBucket && innerPath) {
            sp.set('bucket', innerBucket);
            sp.set('path', innerPath);
          } else if (innerUrl) {
            sp.set('url', innerUrl);
          }
          toCheck = innerUrl || innerPath || '';
        } else {
          break;
        }
      }
    } catch {}
  }

  // Re-read values after potential unwrap
  const rawUrl2 = sp.get('url');
  const path2 = sp.get('path');
  const bucket2 = sp.get('bucket');

  // Build target URL from either url or path
  let target: URL | null = null
  const effBucket = bucket2 || bucket;
  const effPath = path2 || path;
  const effRawUrl = rawUrl2 || rawUrl;

  if (effBucket && effPath) {
    const safe = decodeURIComponent(decodeURIComponent(effPath as string)).replace(/^\/+/, '')

    // Try public thumbnail bucket first for thumbnails
    const publicUrl = tryPublicThumbnail(safe);
    if (publicUrl) {
      try {
        const testResponse = await fetch(publicUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          target = new URL(publicUrl);
        }
      } catch {}
    }

    // Fallback to signed URL
    if (!target) {
      const signed = await getFreshSignedUrl(effBucket as string, safe).catch(() => null);
      if (signed) {
        try { target = new URL(signed); } catch {}
      }
    }

    // If signing failed, construct Firebase REST URL
    if (!target) {
      const constructed = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(effBucket as string)}/o/${encodeURIComponent(safe)}?alt=media`
      try { target = new URL(constructed); } catch {
        return new NextResponse('Bad bucket/path', { status: 400 })
      }
    }
  } else if (effRawUrl) {
    try { 
      target = new URL(effRawUrl as string);
    } catch {
      try { target = new URL(effRawUrl as string, url.origin) } catch {
        return new NextResponse('Bad url', { status: 400 })
      }
    }
    if (!hostAllowed(target)) {
      return new NextResponse('Host not allowed', { status: 400 })
    }
    // Normalize Firebase/GCS forms and enforce alt=media where applicable
    const ext = tryExtractBucketAndPath(target.toString())
    if (ext.bucket && ext.path) {
      if (target.hostname === 'firebasestorage.googleapis.com') {
        const constructed = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(ext.bucket)}/o/${encodeURIComponent(ext.path)}${target.search && !target.search.includes('alt=media') ? (target.search + '&alt=media') : (target.search || '?alt=media')}`
        try { target = new URL(constructed) } catch {}
      }
    } else {
      if (target.hostname === 'firebasestorage.googleapis.com' && target.pathname.includes('/v0/b/') && !target.search.includes('alt=media')) {
        const appended = target.toString() + (target.search ? '&' : '?') + 'alt=media'
        try { target = new URL(appended) } catch {}
      }
    }
  } else if (path) {
    const safe = decodeURIComponent(decodeURIComponent(path)).replace(/^\/+/, '')
    const publicUrl = tryPublicThumbnail(safe);
    if (publicUrl) {
      try { const test = await fetch(publicUrl, { method: 'HEAD' }); if (test.ok) target = new URL(publicUrl); } catch {}
    }
    // Prefer env bucket if available and credentials are present
    if (!target && ENV_BUCKET) {
      // Check if we have Firebase Storage credentials before trying to access
      const hasCredentials = !!(
        (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) ||
        process.env.GCS_SA_JSON || 
        process.env.GOOGLE_APPLICATION_CREDENTIALS
      );
      
      if (hasCredentials) {
        // Try a fresh signed URL first
        const signed = await getFreshSignedUrl(ENV_BUCKET, safe).catch(() => null);
        if (signed) {
          try { target = new URL(signed); } catch {}
        }
        if (!target) {
          const constructed = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(ENV_BUCKET)}/o/${encodeURIComponent(safe)}?alt=media`
          try { target = new URL(constructed) } catch {}
        }
      } else {
        console.warn('[Image Proxy] Firebase Storage credentials missing - skipping Firebase Storage access');
      }
    }
    // Last resort, construct from PUBLIC_BASE template (if BUCKET placeholder present, drop it)
    if (!target) {
      const baseRaw = PUBLIC_BASE.endsWith('/') ? PUBLIC_BASE : PUBLIC_BASE + '/'
      const base = baseRaw.replace('${BUCKET}', ENV_BUCKET || '')
      const constructed = base + encodeURIComponent(safe) + (base.includes('?') ? '&' : '?') + 'alt=media'
      try { target = new URL(constructed) } catch {
        // If we still can't construct a URL, return a placeholder image
        console.warn('[Image Proxy] Unable to construct image URL - returning placeholder');
        const placeholderSvg = svgPlaceholder('image-not-found');
        return new NextResponse(placeholderSvg, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'Access-Control-Allow-Origin': '*',
            'X-Proxy': 'img-construction-fallback'
          },
        });
      }
    }
  } else {
    // Allow poster fallback via videoUrl even if no url/path provided
    if (generatePoster && sp.get('videoUrl')) {
      const seed = sp.get('videoUrl') as string;
      const svg = svgPlaceholder(seed);
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return new NextResponse('Missing url or path', { status: 400 })
  }

  // If asked to generate a poster solely from a videoUrl, return a deterministic SVG placeholder immediately.
  if (generatePoster && (videoUrl || (!rawUrl && !path && !bucket))) {
    const seed = videoUrl || 'carrot-video';
    const svg = svgPlaceholder(seed);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Parse dimensions & options (optional)
  const w = sp.get('w') ? Math.max(1, Math.min(4096, parseInt(sp.get('w') as string, 10) || 0)) : undefined
  const h = sp.get('h') ? Math.max(1, Math.min(4096, parseInt(sp.get('h') as string, 10) || 0)) : undefined
  const q = clampQuality(sp.get('q') ? parseInt(sp.get('q') as string, 10) : undefined)
  const fmt = chooseFormat(_req.headers.get('accept'), sp.get('format'))

  // Fetch upstream
  let upstream: Response
  try {
    upstream = await fetchUpstream(_req as any, target as URL)
  } catch {
    return new NextResponse('Upstream fetch error', { status: 502 })
  }

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    
    // Handle Firebase Storage authentication errors (403 Forbidden)
    if (upstream.status === 403 && (target?.hostname === 'firebasestorage.googleapis.com' || target?.hostname?.endsWith('.firebasestorage.app'))) {
      console.warn('[Image Proxy] Firebase Storage 403 error - credentials may be missing or expired');
      
      // Return a placeholder image instead of 403 error
      const placeholderSvg = svgPlaceholder('firebase-auth-error');
      return new NextResponse(placeholderSvg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
          'Access-Control-Allow-Origin': '*',
          'X-Proxy': 'img-firebase-auth-fallback'
        },
      });
    }
    
    // If token-related or 4xx, last-resort redirect to avoid broken posters
    const looksSigned = errorBody.includes('ExpiredToken') || errorBody.includes('X-Goog-') || (target?.toString().includes('Expires=') || target?.toString().includes('token='));
    if (looksSigned) {
      try {
        const hdrs = new Headers();
        hdrs.set('location', (target as URL).toString());
        hdrs.set('cache-control', 'private, max-age=60');
        hdrs.set('x-proxy', 'img-last-resort-redirect');
        return new NextResponse(null, { status: 302, headers: hdrs });
      } catch {}
    }
    return new NextResponse(errorBody || 'Upstream error', { status: upstream.status, headers: { 'cache-control': 'public, max-age=60', 'x-proxy': 'img-upstream-fail' } })
  }

  // If no transforms requested, passthrough with long cache
  if (!w && !h && (!sp.get('format') || fmt === 'jpeg')) {
    return passthrough(upstream)
  }

  // If sharp is not available, passthrough
  let sharp: any
  try { sharp = (await import('sharp')).default } catch {
    return passthrough(upstream)
  }

  const buf = Buffer.from(await upstream.arrayBuffer())
  let image = sharp(buf, { limitInputPixels: 268435456 }) // 16K*16K safety

  // Get metadata to prevent upscaling
  const meta = await image.metadata().catch(() => ({} as any))
  const srcW = meta.width || undefined
  const srcH = meta.height || undefined

  let targetW = w
  let targetH = h
  if (srcW && targetW && targetW > srcW) targetW = srcW // no upscale
  if (srcH && targetH && targetH > srcH) targetH = srcH // no upscale

  if (targetW || targetH) {
    image = image.resize({
      width: targetW,
      height: targetH,
      fit: 'inside', // preserve aspect ratio inside the box
    })
  }

  switch (fmt) {
    case 'avif': image = image.avif({ quality: q }); break
    case 'webp': image = image.webp({ quality: q }); break
    default: image = image.jpeg({ quality: q }); break
  }

  const out = await image.toBuffer()
  return new NextResponse(out, {
    status: 200,
    headers: {
      'content-type': fmt === 'avif' ? 'image/avif' : (fmt === 'webp' ? 'image/webp' : 'image/jpeg'),
      'cache-control': 'public, max-age=604800, s-maxage=604800, immutable',
      'vary': 'accept',
      'x-proxy': 'img-transform',
      // Add CORS headers
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, If-None-Match, If-Modified-Since',
      'Access-Control-Expose-Headers': 'Content-Length, Cache-Control',
    },
  })
}

export async function OPTIONS(_req: Request, _ctx: { params: Promise<{}> }) {
  // Handle CORS preflight requests
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, If-None-Match, If-Modified-Since',
      'Access-Control-Expose-Headers': 'Content-Length, Cache-Control, ETag, Last-Modified',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}
