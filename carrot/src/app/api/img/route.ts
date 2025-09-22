import { NextRequest, NextResponse } from 'next/server'
import type { StorageOptions } from '@google-cloud/storage'
let GCS: any = null; // lazy import to avoid bundling when unused

// Image proxy: fetches bytes server-side and streams to the client.
// Supports either:
//  - url: full remote URL
//  - path: storage path appended to STORAGE_PUBLIC_BASE
// Avoids cross-origin access issues for Firebase/GCS.

const PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE
  || 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/';

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
    // Special case: storage.googleapis.com with signed URLs (your specific case)
    if (host === 'storage.googleapis.com' && u.search.includes('GoogleAccessId')) {
      // Try to extract from the path - this is the tricky case
      const pathMatch = u.pathname.match(/^\/(.+)$/);
      if (pathMatch) {
        const fullPath = pathMatch[1];
        // For signed URLs, we need to infer the bucket from the path structure
        // Common patterns: /bucket-name/path/to/file or /ingest/job-xxx/thumb.jpg
        if (fullPath.startsWith('ingest/')) {
          // This looks like a video processing path, try to infer bucket
          const possibleBuckets = ['involuted-river-466315-p0', 'carrot-videos', 'carrot-thumbnails'];
          for (const bucket of possibleBuckets) {
            // Test if this bucket exists by trying to construct a test URL
            const testUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(fullPath)}?alt=media`;
            return { bucket, path: fullPath, kind: 'firebase' };
          }
        }
        // Fallback: try to extract bucket from the first part of the path
        const pathParts = fullPath.split('/');
        if (pathParts.length > 1) {
          const possibleBucket = pathParts[0];
          return { bucket: possibleBucket, path: pathParts.slice(1).join('/'), kind: 'gcs' };
        }
      }
    }
  } catch {}
  return {}
}

// Lazy-init GCS Storage client from either GOOGLE_APPLICATION_CREDENTIALS (file) or GCS_SA_JSON env
let storageClient: any = null;
function ensureStorage(): any | null {
  try {
    if (storageClient) {
      console.log('[api/img] Using existing storage client');
      return storageClient;
    }
    
    console.log('[api/img] Initializing storage client...');
    
    // Prefer explicit inline JSON if provided
    const jsonEnv = process.env.GCS_SA_JSON;
    if (jsonEnv) {
      console.log('[api/img] Using GCS_SA_JSON credentials');
      let creds;
      try {
        creds = JSON.parse(jsonEnv);
        console.log('[api/img] Credentials parsed successfully', {
          projectId: creds.project_id,
          clientEmail: creds.client_email?.substring(0, 20) + '...',
          hasPrivateKey: !!creds.private_key
        });
      } catch (parseError) {
        console.error('[api/img] Failed to parse GCS_SA_JSON env var:', (parseError as any)?.message);
        return null;
      }
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
      console.log('[api/img] Storage client created with credentials');
      return storageClient;
    }
    
    // Else rely on GOOGLE_APPLICATION_CREDENTIALS or default ADC
    console.log('[api/img] Using default ADC or GOOGLE_APPLICATION_CREDENTIALS');
    console.log('[api/img] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not set');
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    GCS = GCS || require('@google-cloud/storage');
    storageClient = new GCS.Storage();
    console.log('[api/img] Storage client created with default credentials');
    return storageClient;
  } catch (e) {
    console.error('[api/img] GCS client init failed; falling back to public URLs', {
      error: (e as any)?.message,
      stack: (e as any)?.stack?.substring(0, 200)
    });
    return null;
  }
}

async function getFreshSignedUrl(bucket: string, path: string, ttlSec = SIGN_TTL_SECONDS): Promise<string | null> {
  const client = ensureStorage();
  if (!client) return null;
  try {
    const b = client.bucket(bucket);
    const f = b.file(path);
    const [url] = await f.getSignedUrl({ action: 'read', expires: Date.now() + ttlSec * 1000 });
    return url;
  } catch (e) {
    console.warn('[api/img] getSignedUrl failed; falling back', { bucket, path, msg: (e as any)?.message });
    return null;
  }
}

// Check if path looks like a thumbnail and try public bucket first
function tryPublicThumbnail(path: string): string | null {
  if (!path.includes('thumb') && !path.includes('poster')) return null;
  
  // Clean path for public bucket
  const cleanPath = path.replace(/^\/+/, '').replace(/\?.*$/, '');
  return `${PUBLIC_THUMBNAIL_BASE}${cleanPath}`;
}

// Generate static poster from video using ffmpeg if thumbnail is missing
async function generateStaticPoster(bucket: string, videoPath: string): Promise<string | null> {
  try {
    // Check if we have ffmpeg available
    const ffmpeg = await import('fluent-ffmpeg').catch(() => null);
    if (!ffmpeg) return null;
    
    const client = ensureStorage();
    if (!client) return null;
    
    // Get signed URL for source video
    const videoUrl = await getFreshSignedUrl(bucket, videoPath);
    if (!videoUrl) return null;
    
    // Generate poster at 1 second mark
    const posterBuffer = await new Promise<Buffer>((resolve, reject) => {
      const stream = ffmpeg.default(videoUrl)
        .seekInput(1) // 1 second
        .frames(1)
        .format('image2')
        .outputOptions(['-vf', 'scale=640:360'])
        .on('error', reject);
      
      const chunks: Buffer[] = [];
      stream.pipe()
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject);
    });
    
    // Upload generated poster back to storage
    const posterPath = videoPath.replace(/\.(mp4|webm|mov)$/i, '_generated_poster.jpg');
    const posterFile = client.bucket(bucket).file(posterPath);
    await posterFile.save(posterBuffer, { metadata: { contentType: 'image/jpeg' } });
    
    // Return signed URL for the generated poster
    return await getFreshSignedUrl(bucket, posterPath);
  } catch (e) {
    console.warn('[api/img] generateStaticPoster failed', { bucket, videoPath, msg: (e as any)?.message });
    return null;
  }
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

async function fetchUpstream(req: NextRequest, target: URL) {
  try { console.log('[api/img] fetch', { host: target.hostname, pathPrefix: target.pathname.slice(0, 80) }) } catch {}
  const upstream = await fetch(target.toString(), {
    headers: {
      ...(req.headers.get('if-none-match') ? { 'if-none-match': req.headers.get('if-none-match') as string } : {}),
      ...(req.headers.get('if-modified-since') ? { 'if-modified-since': req.headers.get('if-modified-since') as string } : {}),
      accept: req.headers.get('accept') || 'image/avif,image/webp,image/*,*/*;q=0.8',
    },
    cache: 'no-store',
    redirect: 'follow',
  })
  return upstream
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
  // Preserve tokens on passthrough
  const token = upstream.headers.get('authorization'); if (token) headers.set('authorization', token)
  return new NextResponse(body, { status, headers })
}

export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  const url = new URL(_req.url)
  const sp = url.searchParams
  const rawUrl = sp.get('url')
  const path = sp.get('path')
  const bucket = sp.get('bucket')
  const generatePoster = sp.get('generatePoster') === 'true'

  // Enhanced logging for debugging
  console.log('[api/img] Request received', {
    rawUrl: rawUrl?.substring(0, 100) + (rawUrl && rawUrl.length > 100 ? '...' : ''),
    path,
    bucket,
    generatePoster,
    userAgent: _req.headers.get('user-agent')?.substring(0, 50),
    referer: _req.headers.get('referer')?.substring(0, 50)
  });

  // Prevent double-wrapping: if rawUrl already points to /api/img, try to unwrap once
  if (rawUrl) {
    try {
      const decoded = decodeURIComponent(rawUrl);
      let toCheck = decoded;
      // Unwrap up to 3 nested /api/img layers defensively
      for (let i = 0; i < 3 && toCheck.includes('/api/img'); i++) {
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
          // Prepare next iteration
          toCheck = innerUrl || innerPath || '';
        } else {
          break;
        }
      }
      if (decoded.startsWith('/api/img')) {
        // Unwrap inner params from the nested /api/img
        const inner = new URL(decoded, url.origin);
        const innerUrl = inner.searchParams.get('url');
        const innerPath = inner.searchParams.get('path');
        const innerBucket = inner.searchParams.get('bucket');
        if (innerBucket && innerPath) {
          sp.set('bucket', innerBucket);
          sp.set('path', innerPath);
        } else if (innerUrl) {
          sp.set('url', innerUrl);
        }
      } else if (decoded.includes('/api/img')) {
        // Defensive: if a fully-qualified nested /api/img URL is present, unwrap similarly
        const match = decoded.match(/(https?:\/\/[^\s]+\/api\/img\?[^\s]+)/) || decoded.match(/(\/api\/img\?[^\s]+)/);
        if (match && match[1]) {
          const inner = new URL(match[1], url.origin);
          const innerUrl = inner.searchParams.get('url');
          const innerPath = inner.searchParams.get('path');
          const innerBucket = inner.searchParams.get('bucket');
          if (innerBucket && innerPath) {
            sp.set('bucket', innerBucket);
            sp.set('path', innerPath);
          } else if (innerUrl) {
            sp.set('url', innerUrl);
          }
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
    console.log('[api/img] Building URL from bucket/path', { bucket: effBucket, path: (effPath as string).substring(0, 50) + '...' });
    
    // Explicit path-mode (preferred): try public thumbnail first
    const safe = decodeURIComponent(decodeURIComponent(effPath as string)).replace(/^\/+/, '')
    console.log('[api/img] Decoded path', { safe: safe.substring(0, 50) + '...' });
    
    // Try public thumbnail bucket first for thumbnails
    const publicUrl = tryPublicThumbnail(safe);
    if (publicUrl) {
      console.log('[api/img] Trying public thumbnail', { publicUrl });
      try {
        const testResponse = await fetch(publicUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          target = new URL(publicUrl);
          console.log('[api/img] Using public thumbnail', { path: safe, publicUrl });
        } else {
          console.log('[api/img] Public thumbnail not available', { status: testResponse.status });
        }
      } catch (e) {
        console.log('[api/img] Public thumbnail test failed', { error: (e as any)?.message });
      }
    }
    
    // Fallback to signed URL
    if (!target) {
      console.log('[api/img] Attempting to get fresh signed URL', { bucket: effBucket, path: safe });
      const signed = await getFreshSignedUrl(effBucket, safe).catch((e) => {
        console.error('[api/img] getFreshSignedUrl failed', { error: (e as any)?.message, bucket: effBucket, path: safe });
        return null;
      });
      if (signed) {
        try { 
          target = new URL(signed);
          console.log('[api/img] Using fresh signed URL', { url: signed.substring(0, 100) + '...' });
        } catch (e) {
          console.error('[api/img] Failed to parse signed URL', { error: (e as any)?.message, signed: signed.substring(0, 100) + '...' });
        }
      } else {
        console.warn('[api/img] No signed URL available', { bucket: effBucket, path: safe });
      }
    }
    
    // If signing failed and this looks like a video thumbnail request, try generating poster
    if (!target && generatePoster && safe.includes('thumb.jpg')) {
      console.log('[api/img] Attempting to generate static poster');
      const videoPath = safe.replace(/thumb\.jpg$/, 'video.mp4');
      const posterUrl = effBucket ? await generateStaticPoster(effBucket as string, videoPath) : null;
      if (posterUrl) {
        try { 
          target = new URL(posterUrl);
          console.log('[api/img] Using generated poster', { url: posterUrl.substring(0, 100) + '...' });
        } catch (e) {
          console.error('[api/img] Failed to parse poster URL', { error: (e as any)?.message });
        }
      }
    }
    
    if (!target) {
      console.log('[api/img] Falling back to constructed Firebase URL');
      const constructed = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(effBucket)}/o/${encodeURIComponent(safe)}?alt=media`
      try { 
        target = new URL(constructed);
        console.log('[api/img] Using constructed URL', { url: constructed.substring(0, 100) + '...' });
      } catch (e) {
        console.error('[api/img] bad bucket/path', { bucket: effBucket, path: effPath, error: (e as any)?.message });
        return new NextResponse('Bad bucket/path', { status: 400 })
      }
    }
  } else if (effRawUrl) {
    console.log('[api/img] Building URL from rawUrl', { rawUrl: (effRawUrl as string).substring(0, 100) + '...' });
    try { 
      target = new URL(effRawUrl as string);
      console.log('[api/img] Parsed rawUrl successfully', { hostname: target.hostname, pathname: target.pathname.substring(0, 50) + '...' });
    } catch (e) {
      console.log('[api/img] Failed to parse rawUrl, trying relative', { error: (e as any)?.message });
      try {
        // Support relative URL inputs by resolving against origin
        target = new URL(effRawUrl as string, url.origin)
        console.log('[api/img] Parsed as relative URL', { hostname: target.hostname, pathname: target.pathname.substring(0, 50) + '...' });
      } catch (e2) {
        console.error('[api/img] bad url', { rawUrl: (effRawUrl as string).substring(0, 100) + '...', error: (e2 as any)?.message });
        return new NextResponse('Bad url', { status: 400 })
      }
    }
    if (!hostAllowed(target)) {
      console.warn('[api/img] host not allowed', { host: target.hostname, rawUrl: (effRawUrl as string)?.substring(0, 100) + '...' });
      return new NextResponse('Host not allowed', { status: 400 })
    }
    // Normalize Firebase/GCS forms and enforce alt=media where applicable
    const ext = tryExtractBucketAndPath(target.toString())
    if (ext.bucket && ext.path) {
      // Detect malformed hybrids: storage.googleapis.com + /o/<path>
      const isHybrid = target.hostname === 'storage.googleapis.com' && /\/o\//.test(target.pathname)
      if (isHybrid) {
        console.warn('[api/img] malformed hybrid url', { url: target.toString() })
        return new NextResponse('Malformed Firebase/GCS URL. Use /api/img?bucket=...&path=...', { status: 400 })
      }
      
      // Handle ExpiredToken by re-signing or using public thumbnail
      if (target.hostname === 'storage.googleapis.com' && target.search.includes('GoogleAccessId')) {
        // This is a signed URL that might be expired
        const publicUrl = tryPublicThumbnail(ext.path);
        if (publicUrl) {
          try {
            const testResponse = await fetch(publicUrl, { method: 'HEAD' });
            if (testResponse.ok) {
              target = new URL(publicUrl);
              console.log('[api/img] Replaced expired signed URL with public thumbnail', { path: ext.path });
            }
          } catch {
            // Fall through to re-signing
          }
        }
        
        // If public didn't work, try re-signing
        if (!publicUrl || target.hostname === 'storage.googleapis.com') {
          const resigned = await getFreshSignedUrl(ext.bucket, ext.path).catch(() => null);
          if (resigned) {
            try { 
              target = new URL(resigned);
              console.log('[api/img] Re-signed expired URL', { path: ext.path });
            } catch {}
          }
        }
      } else if (target.hostname === 'firebasestorage.googleapis.com') {
        // Ensure alt=media on Firebase REST (unsigned)
        const constructed = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(ext.bucket)}/o/${encodeURIComponent(ext.path)}${target.search && !target.search.includes('alt=media') ? (target.search + '&alt=media') : (target.search || '?alt=media')}`
        try { target = new URL(constructed) } catch {}
      }
    } else {
      // If Firebase REST without alt=media, add it
      if (target.hostname === 'firebasestorage.googleapis.com' && target.pathname.includes('/v0/b/') && !target.search.includes('alt=media')) {
        const appended = target.toString() + (target.search ? '&' : '?') + 'alt=media'
        try { target = new URL(appended) } catch {}
      }
    }
  } else if (path) {
    // Fallback: construct public download URL from configured PUBLIC_BASE
    const safe = decodeURIComponent(decodeURIComponent(path)).replace(/^\/+/, '')
    
    // Try public thumbnail first
    const publicUrl = tryPublicThumbnail(safe);
    if (publicUrl) {
      try {
        const testResponse = await fetch(publicUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          target = new URL(publicUrl);
        }
      } catch {
        // Fall through to PUBLIC_BASE
      }
    }
    
    if (!target) {
      const base = PUBLIC_BASE.endsWith('/') ? PUBLIC_BASE : PUBLIC_BASE + '/'
      const constructed = base + encodeURIComponent(safe) + (base.includes('?') ? '&' : '?') + 'alt=media'
      try { target = new URL(constructed) } catch {
        console.warn('[api/img] bad constructed path url', { path })
        return new NextResponse('Bad path', { status: 400 })
      }
    }
  } else {
    console.warn('[api/img] missing url or path')
    return new NextResponse('Missing url or path', { status: 400 })
  }

  // Parse dimensions & options (optional)
  const w = sp.get('w') ? Math.max(1, Math.min(4096, parseInt(sp.get('w') as string, 10) || 0)) : undefined
  const h = sp.get('h') ? Math.max(1, Math.min(4096, parseInt(sp.get('h') as string, 10) || 0)) : undefined
  const q = clampQuality(sp.get('q') ? parseInt(sp.get('q') as string, 10) : undefined)
  const fmt = chooseFormat(_req.headers.get('accept'), sp.get('format'))

  // Fetch upstream
  let upstream: Response
  console.log('[api/img] Fetching upstream', { 
    target: target.toString().substring(0, 100) + '...',
    hostname: target.hostname,
    pathname: target.pathname.substring(0, 50) + '...'
  });
  
  try {
    upstream = await fetchUpstream(_req as any, target)
    console.log('[api/img] Upstream response received', { 
      status: upstream.status, 
      ok: upstream.ok,
      contentType: upstream.headers.get('content-type'),
      contentLength: upstream.headers.get('content-length')
    });
  } catch (e: any) {
    console.error('[api/img] upstream fetch failed', { 
      host: target.hostname, 
      target: target.toString().substring(0, 100) + '...',
      msg: e?.message || String(e),
      stack: e?.stack?.substring(0, 200)
    });
    return new NextResponse('Upstream fetch error', { status: 502 })
  }

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    
    // Check for expired token in any error response - more comprehensive detection
    const isExpiredToken = errorBody.includes('ExpiredToken') || 
                          errorBody.includes('expired') || 
                          errorBody.includes('Invalid argument') ||
                          errorBody.includes('Request signature expired') ||
                          target.toString().includes('Expires=') ||
                          upstream.status === 400 ||
                          upstream.status === 403;
    
    console.warn('[api/img] Upstream error detected', { 
      url: target.toString(), 
      status: upstream.status,
      isExpiredToken,
      errorBody: errorBody.slice(0, 256)
    });
    
    if (isExpiredToken) {
      console.warn('[api/img] ExpiredToken detected, attempting to re-sign URL', { 
        url: target.toString(), 
        status: upstream.status,
        errorBody: errorBody.slice(0, 256)
      });
      
      // Try to extract bucket and path for re-signing
      const ext = tryExtractBucketAndPath(target.toString());
      console.log('[api/img] Extracted bucket/path for re-signing', { 
        bucket: ext.bucket, 
        path: ext.path, 
        kind: ext.kind,
        originalUrl: target.toString()
      });
      
      if (ext.bucket && ext.path) {
        // Try multiple approaches for re-signing
        let resigned: string | null = null;
        
        // First try: direct re-signing
        resigned = await getFreshSignedUrl(ext.bucket, ext.path).catch((e) => {
          console.warn('[api/img] getFreshSignedUrl failed', { error: e, bucket: ext.bucket, path: ext.path });
          return null;
        });
        
        // Second try: try public thumbnail if this is a thumbnail
        if (!resigned && (ext.path.includes('thumb') || ext.path.includes('poster'))) {
          const publicUrl = tryPublicThumbnail(ext.path);
          if (publicUrl) {
            try {
              const testResponse = await fetch(publicUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                resigned = publicUrl;
                console.log('[api/img] Using public thumbnail as fallback', { path: ext.path, publicUrl });
              }
            } catch (e) {
              console.warn('[api/img] Public thumbnail test failed', { error: e, publicUrl });
            }
          }
        }
        
        // Third try: construct Firebase REST URL
        if (!resigned) {
          const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(ext.bucket)}/o/${encodeURIComponent(ext.path)}?alt=media`;
          try {
            const testResponse = await fetch(firebaseUrl, { method: 'HEAD' });
            if (testResponse.ok) {
              resigned = firebaseUrl;
              console.log('[api/img] Using Firebase REST URL as fallback', { path: ext.path, firebaseUrl });
            }
          } catch (e) {
            console.warn('[api/img] Firebase REST URL test failed', { error: e, firebaseUrl });
          }
        }
        
        // Fourth try: try different bucket names for video thumbnails
        if (!resigned && ext.path.includes('thumb') && ext.path.includes('ingest')) {
          const possibleBuckets = ['involuted-river-466315-p0', 'carrot-videos', 'carrot-thumbnails'];
          for (const bucket of possibleBuckets) {
            const testUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(ext.path)}?alt=media`;
            try {
              const testResponse = await fetch(testUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                resigned = testUrl;
                console.log('[api/img] Found working bucket for thumbnail', { bucket, path: ext.path, testUrl });
                break;
              }
            } catch (e) {
              // Continue to next bucket
            }
          }
        }
        
        if (resigned) {
          console.log('[api/img] Generated fresh URL', { newUrl: resigned });
          try {
            const newTarget = new URL(resigned);
            const retryUpstream = await fetchUpstream(_req as any, newTarget);
            if (retryUpstream.ok) {
              console.log('[api/img] Successfully re-signed expired URL', { path: ext.path });
              upstream = retryUpstream;
            } else {
              console.warn('[api/img] Re-signed URL also failed', { status: retryUpstream.status });
            }
          } catch (e) {
            console.warn('[api/img] Failed to re-sign URL', { error: e });
          }
        } else {
          console.warn('[api/img] Could not generate fresh signed URL', { bucket: ext.bucket, path: ext.path });
        }
      } else {
        console.warn('[api/img] Could not extract bucket/path from URL', { url: target.toString() });
      }
      
      // If re-signing failed, return 503
      if (!upstream.ok) {
        return new NextResponse('Image temporarily unavailable', { status: 503 });
      }
    } else {
      console.warn('[api/img] upstream not ok', { host: target.hostname, status: upstream.status, body: errorBody.slice(0, 256) })
      return new NextResponse(errorBody || 'Upstream error', { status: upstream.status, headers: { 'cache-control': 'public, max-age=60', 'x-proxy': 'img-upstream-fail' } })
    }
  }

  // If no transforms requested, passthrough with long cache
  if (!w && !h && (!sp.get('format') || fmt === 'jpeg')) {
    return passthrough(upstream)
  }

  // If sharp is not available, passthrough
  let sharp: any
  try { sharp = (await import('sharp')).default } catch {
    console.warn('[api/img] sharp unavailable; passthrough')
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
      withoutEnlargement: true,
    })
  }

  // Format & quality
  const options: Record<string, any> = { quality: q }
  if (fmt === 'webp') image = image.webp(options)
  else if (fmt === 'avif') image = image.avif({ quality: q })
  else if (fmt === 'jpeg' || fmt === 'jpg') image = image.jpeg(options)
  else if (fmt === 'png') image = image.png() // png ignores q
  else image = image.jpeg(options)

  let out: Buffer
  try { out = await image.toBuffer() }
  catch (e) {
    console.warn('[api/img] transform failed; passthrough', (e as any)?.message)
    return passthrough(upstream)
  }

  const headers = new Headers()
  const contentType = fmt === 'avif' ? 'image/avif' : fmt === 'webp' ? 'image/webp' : fmt === 'png' ? 'image/png' : 'image/jpeg'
  headers.set('content-type', contentType)
  headers.set('cache-control', 'public, max-age=604800, s-maxage=604800, immutable')
  const etag = upstream.headers.get('etag'); if (etag) headers.set('etag', etag)
  const lm = upstream.headers.get('last-modified'); if (lm) headers.set('last-modified', lm)
  headers.set('vary', 'accept')
  headers.set('x-proxy', 'img-sharp')

  // Next.js 15: return a Uint8Array (ArrayBufferView) to avoid SharedArrayBuffer unions
  const view = new Uint8Array(out.byteLength)
  view.set(out)
  
  console.log('[api/img] Successfully processed image', {
    originalSize: buf.length,
    processedSize: out.length,
    format: fmt,
    quality: q,
    dimensions: { w: targetW, h: targetH },
    sourceDimensions: { w: srcW, h: srcH }
  });
  
  return new NextResponse(view, { status: 200, headers })
}
