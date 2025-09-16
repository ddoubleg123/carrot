import { NextRequest, NextResponse } from 'next/server';

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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOW_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'images.unsplash.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
]);

function chooseFormat(acceptHeader?: string | null, explicit?: string | null) {
  if (explicit) return explicit.toLowerCase();
  const a = (acceptHeader || '').toLowerCase();
  if (a.includes('image/avif')) return 'avif';
  if (a.includes('image/webp')) return 'webp';
  return 'jpeg';
}

function clampQuality(q?: number) {
  if (!q || isNaN(q)) return 75;
  return Math.min(95, Math.max(30, Math.round(q)));
}

async function fetchUpstream(req: NextRequest, target: URL) {
  const upstream = await fetch(target.toString(), {
    headers: {
      ...(req.headers.get('if-none-match') ? { 'if-none-match': req.headers.get('if-none-match') as string } : {}),
      ...(req.headers.get('if-modified-since') ? { 'if-modified-since': req.headers.get('if-modified-since') as string } : {}),
      accept: req.headers.get('accept') || 'image/avif,image/webp,image/*,*/*;q=0.8',
    },
    cache: 'no-store',
  });
  return upstream;
}

async function passthrough(upstream: Response) {
  const status = upstream.status;
  const body = upstream.body;
  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'image/*');
  const etag = upstream.headers.get('etag'); if (etag) headers.set('etag', etag);
  const lm = upstream.headers.get('last-modified'); if (lm) headers.set('last-modified', lm);
  headers.set('cache-control', 'public, max-age=604800, s-maxage=604800, immutable');
  headers.set('vary', 'accept');
  headers.set('x-proxy', 'img-pass');
  return new NextResponse(body, { status, headers });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const rawUrl = sp.get('url');
  if (!rawUrl) return new NextResponse('Missing url', { status: 400 });

  let target: URL;
  try { target = new URL(rawUrl); } catch { return new NextResponse('Bad url', { status: 400 }); }
  if (!ALLOW_HOSTS.has(target.hostname)) return new NextResponse('Host not allowed', { status: 400 });

  // Dimensions & options
  const w = sp.get('w') ? Math.max(1, Math.min(4096, parseInt(sp.get('w') as string, 10) || 0)) : undefined;
  const h = sp.get('h') ? Math.max(1, Math.min(4096, parseInt(sp.get('h') as string, 10) || 0)) : undefined;
  const q = clampQuality(sp.get('q') ? parseInt(sp.get('q') as string, 10) : undefined);
  const fmt = chooseFormat(req.headers.get('accept'), sp.get('format'));

  // Fetch upstream
  const upstream = await fetchUpstream(req, target);
  if (!upstream.ok) {
    // Pass through errors with short cache
    const txt = await upstream.text().catch(() => '');
    return new NextResponse(txt, { status: upstream.status, headers: { 'cache-control': 'public, max-age=60' } });
  }

  // If no transforms requested, passthrough with long cache
  if (!w && !h && (!sp.get('format') || fmt === 'jpeg')) {
    return passthrough(upstream);
  }

  // If sharp is not available, passthrough
  let sharp: any;
  try { sharp = (await import('sharp')).default; } catch {
    return passthrough(upstream);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  let image = sharp(buf, { limitInputPixels: 268435456 }); // 16K*16K safety

  // Get metadata to prevent upscaling
  const meta = await image.metadata().catch(() => ({} as any));
  const srcW = meta.width || undefined;
  const srcH = meta.height || undefined;

  let targetW = w;
  let targetH = h;
  if (srcW && targetW && targetW > srcW) targetW = srcW; // no upscale
  if (srcH && targetH && targetH > srcH) targetH = srcH; // no upscale

  if (targetW || targetH) {
    image = image.resize({
      width: targetW,
      height: targetH,
      fit: 'inside', // preserve aspect ratio inside the box
      withoutEnlargement: true,
    });
  }

  // Format & quality
  const options: Record<string, any> = { quality: q }; // shared
  if (fmt === 'webp') image = image.webp(options);
  else if (fmt === 'avif') image = image.avif({ quality: q });
  else if (fmt === 'jpeg' || fmt === 'jpg') image = image.jpeg(options);
  else if (fmt === 'png') image = image.png(); // png ignores q
  else image = image.jpeg(options);

  let out: Buffer;
  try { out = await image.toBuffer(); }
  catch { return passthrough(upstream); }

  const headers = new Headers();
  const contentType = fmt === 'avif' ? 'image/avif' : fmt === 'webp' ? 'image/webp' : fmt === 'png' ? 'image/png' : 'image/jpeg';
  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=604800, s-maxage=604800, immutable');
  const etag = upstream.headers.get('etag'); if (etag) headers.set('etag', etag);
  const lm = upstream.headers.get('last-modified'); if (lm) headers.set('last-modified', lm);
  headers.set('vary', 'accept');
  headers.set('x-proxy', 'img-sharp');

  // Next.js 15: return a Uint8Array (ArrayBufferView) to avoid SharedArrayBuffer unions
  const view = new Uint8Array(out.byteLength);
  view.set(out);
  return new NextResponse(view, { status: 200, headers });
}
