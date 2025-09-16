import { NextRequest, NextResponse } from 'next/server'

// Image proxy: fetches bytes server-side and streams to the client.
// Supports either:
//  - url: full remote URL
//  - path: storage path appended to STORAGE_PUBLIC_BASE
// Avoids cross-origin access issues for Firebase/GCS.

const PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE
  || 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/';

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
])

function hostAllowed(u: URL) {
  if (ALLOW_HOSTS.has(u.hostname)) return true
  if (u.hostname.endsWith('.firebasestorage.app')) return true
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
  } catch {}
  return {}
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

export async function GET(req: NextRequest, context: { params: Promise<{}> }) {
  const url = new URL(req.url)
  const sp = url.searchParams
  const rawUrl = sp.get('url')
  const path = sp.get('path')
  const bucket = sp.get('bucket')

  // Build target URL from either url or path
  let target: URL | null = null
  if (bucket && path) {
    // Explicit path-mode (preferred for durability)
    const safe = decodeURIComponent(decodeURIComponent(path)).replace(/^\/+/, '')
    const constructed = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(safe)}?alt=media`
    try { target = new URL(constructed) } catch {
      console.warn('[api/img] bad bucket/path', { bucket, path })
      return new NextResponse('Bad bucket/path', { status: 400 })
    }
  } else if (rawUrl) {
    try { target = new URL(rawUrl) } catch {
      try {
        // Support relative URL inputs by resolving against origin
        target = new URL(rawUrl, url.origin)
      } catch {
        console.warn('[api/img] bad url', rawUrl)
        return new NextResponse('Bad url', { status: 400 })
      }
    }
    if (!hostAllowed(target)) {
      console.warn('[api/img] host not allowed', { host: target.hostname })
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
      if (target.hostname === 'firebasestorage.googleapis.com') {
        // Ensure alt=media on Firebase REST
        const constructed = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(ext.bucket)}/o/${encodeURIComponent(ext.path)}${target.search && !target.search.includes('alt=media') ? (target.search + '&alt=media') : (target.search || '?alt=media')}`
        try { target = new URL(constructed) } catch {}
      } else {
        // storage.googleapis.com signed URLs: do NOT rewrite; leave as-is
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
    const base = PUBLIC_BASE.endsWith('/') ? PUBLIC_BASE : PUBLIC_BASE + '/'
    const constructed = base + encodeURIComponent(safe) + (base.includes('?') ? '&' : '?') + 'alt=media'
    try { target = new URL(constructed) } catch {
      console.warn('[api/img] bad constructed path url', { path })
      return new NextResponse('Bad path', { status: 400 })
    }
  } else {
    console.warn('[api/img] missing url or path')
    return new NextResponse('Missing url or path', { status: 400 })
  }

  // Parse dimensions & options (optional)
  const w = sp.get('w') ? Math.max(1, Math.min(4096, parseInt(sp.get('w') as string, 10) || 0)) : undefined
  const h = sp.get('h') ? Math.max(1, Math.min(4096, parseInt(sp.get('h') as string, 10) || 0)) : undefined
  const q = clampQuality(sp.get('q') ? parseInt(sp.get('q') as string, 10) : undefined)
  const fmt = chooseFormat(req.headers.get('accept'), sp.get('format'))

  // Fetch upstream
  let upstream: Response
  try {
    upstream = await fetchUpstream(req, target)
  } catch (e: any) {
    console.error('[api/img] upstream fetch failed', { host: target.hostname, msg: e?.message || String(e) })
    return new NextResponse('Upstream fetch error', { status: 502 })
  }

  if (!upstream.ok) {
    // Pass through upstream error body with short cache
    let txt = ''
    try { txt = await upstream.text() } catch {}
    console.warn('[api/img] upstream not ok', { host: target.hostname, status: upstream.status, body: txt.slice(0, 256) })
    return new NextResponse(txt || 'Upstream error', { status: upstream.status, headers: { 'cache-control': 'public, max-age=60', 'x-proxy': 'img-upstream-fail' } })
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
  return new NextResponse(view, { status: 200, headers })
}
