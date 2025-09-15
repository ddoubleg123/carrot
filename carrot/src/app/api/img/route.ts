import { NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');

// Image proxy: fetches bytes server-side and streams to the client.
// Supports either:
//  - url: full remote URL
//  - path: storage path appended to STORAGE_PUBLIC_BASE
// Avoids cross-origin access issues for Firebase/GCS.

const PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE
  || 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/';

export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(req.url);
    const urlRaw = searchParams.get('url');
    // Safely decode up to 2 times to normalize %252F, %2540, etc.
    const urlParam = (() => {
      if (!urlRaw) return urlRaw;
      try {
        let d = urlRaw;
        for (let i = 0; i < 2; i++) {
          const n = decodeURIComponent(d);
          if (n === d) break;
          d = n;
        }
        return d;
      } catch {
        return urlRaw;
      }
    })();
    const pathParam = searchParams.get('path');
    const allowUrlFallback = (process.env.IMG_ALLOW_URL_FALLBACK ?? 'true').toLowerCase() === 'true';

    const adminDownload = async (bucketName: string, objectPath: string) => {
      // Ensure admin app exists
      if (!admin.apps || !admin.apps.length) {
        const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Normalize private key where \n are stored as literal backslash+n in env
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      }
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(objectPath);
      const [meta] = await file.getMetadata().catch(() => [{ contentType: 'image/jpeg', cacheControl: 'public,max-age=300' }]);

      // Support HTTP Range for streaming (videos)
      const range = req.headers.get('range');
      const size = Number(meta?.size || 0);
      const contentType = meta?.contentType || 'application/octet-stream';
      const cacheControl = meta?.cacheControl || 'public, max-age=86400, stale-while-revalidate=604800';

      if (range && size > 0) {
        // Example: bytes=start-end
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        const start = m ? parseInt(m[1], 10) : 0;
        const end = m && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : Math.min(start + 1024 * 1024 - 1, size - 1); // 1MB default chunk
        if (isNaN(start) || isNaN(end) || start > end) {
          return new NextResponse('Malformed Range', { status: 416 });
        }
        const stream = file.createReadStream({ start, end });
        return new NextResponse(stream as any, {
          status: 206,
          headers: {
            'content-type': contentType,
            'cache-control': cacheControl,
            'content-length': String(end - start + 1),
            'content-range': `bytes ${start}-${end}/${size}`,
            'accept-ranges': 'bytes',
            'x-img-bucket': bucketName,
            'x-img-path': objectPath,
            'x-img-mode': 'admin-range',
          },
        });
      }

      // No Range: stream entire object without buffering in memory
      const stream = file.createReadStream();
      return new NextResponse(stream as any, {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': cacheControl,
          'accept-ranges': 'bytes',
          'x-img-bucket': bucketName,
          'x-img-path': objectPath,
          'x-img-mode': 'admin-stream',
        },
      });
    };

    let target: string | null = null;
    if (urlParam) {
      // If urlParam is a Firebase Storage URL, try to extract the bucket and object path and use Admin SDK
      // Case 1: Standard Firebase URL: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<object>
      const m = urlParam.match(/\/b\/([^/]+)\/o\/([^?]+)(?:\?|$)/);
      // Case 2: Google Storage proxy form: https://storage.googleapis.com/<bucket>.firebasestorage.app/<object>
      const gcsAlt = (() => {
        try {
          const u = new URL(urlParam);
          if (u.hostname === 'storage.googleapis.com') {
            // pathname like: /<bucket>.firebasestorage.app/<object>
            const parts = u.pathname.replace(/^\/+/, '').split('/');
            if (parts.length >= 2 && parts[0].endsWith('.firebasestorage.app')) {
              const bucketFromHost = parts[0].replace(/\.firebasestorage\.app$/i, '');
              const objectPath = parts.slice(1).join('/');
              return { bucket: bucketFromHost, object: objectPath } as const;
            }
            if (parts.length >= 2 && parts[0].endsWith('.appspot.com')) {
              const objectPath = parts.slice(1).join('/');
              return { object: objectPath } as const;
            }
          }
          // Case 3: Host ends with firebasestorage.googleapis.com with v0 path already handled by regex above
        } catch {}
        return null;
      })();
      const pathOnly = urlParam.match(/\/o\/([^?]+)(?:\?|$)/);
      if (m && m[1] && m[2]) {
        const urlBucket = decodeURIComponent(m[1]);
        const safePath = decodeURIComponent(decodeURIComponent(m[2])).replace(/^\/+/, '');
        try {
          const bucketName = urlBucket; // trust bucket from URL
          return await adminDownload(bucketName, safePath);
        } catch (e) {
          if (!allowUrlFallback) {
            return NextResponse.json({ error: 'Admin download failed', bucketTried: urlBucket, path: safePath }, { status: 502 });
          }
          target = urlParam; // fallback during cutover
        }
      } else if (gcsAlt && gcsAlt.object) {
        // storage.googleapis.com/<bucket>.firebasestorage.app/<object>
        const safePath = decodeURIComponent(decodeURIComponent(gcsAlt.object)).replace(/^\/+/, '');
        try {
          const project = (gcsAlt as any).bucket as string | undefined;
          const bucketName = project ? `${project}.appspot.com` : (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
          if (!bucketName) throw new Error('Missing FIREBASE_STORAGE_BUCKET');
          return await adminDownload(bucketName, safePath);
        } catch (e) {
          if (!allowUrlFallback) {
            return NextResponse.json({ error: 'Admin download failed', path: safePath }, { status: 502 });
          }
          target = urlParam; // temporary fallback during cutover
        }
      } else if (pathOnly && pathOnly[1]) {
        // If bucket is not present in URL (non-standard form), attempt with configured bucket
        const safePath = decodeURIComponent(decodeURIComponent(pathOnly[1])).replace(/^\/+/, '');
        try {
          const fallbackBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
          if (!fallbackBucket) throw new Error('Missing FIREBASE_STORAGE_BUCKET');
          return await adminDownload(fallbackBucket, safePath);
        } catch (e) {
          if (!allowUrlFallback) {
            return NextResponse.json({ error: 'Admin download failed', path: safePath }, { status: 502 });
          }
          target = urlParam; // temporary fallback during cutover
        }
      } else {
        target = urlParam;
      }
    } else if (pathParam) {
      const safePath = decodeURIComponent(decodeURIComponent(pathParam)).replace(/^\/+/, '');
      // First try Firebase Admin SDK (works for private objects)
      try {
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!bucketName) throw new Error('Missing FIREBASE_STORAGE_BUCKET');
        return await adminDownload(bucketName, safePath);
      } catch (e) {
        // Fall back to HTTPS fetch using a public base + alt=media (only if allowed)
        if (!allowUrlFallback) {
          return NextResponse.json({ error: 'Admin download failed', bucketTried: process.env.FIREBASE_STORAGE_BUCKET, path: safePath }, { status: 502 });
        }
        target = PUBLIC_BASE.endsWith('/') ? `${PUBLIC_BASE}${encodeURIComponent(safePath)}?alt=media` : `${PUBLIC_BASE}/${encodeURIComponent(safePath)}?alt=media`;
      }
    }

    if (!target) {
      return NextResponse.json({ error: 'Missing url or path' }, { status: 400 });
    }

    // Validate
    try { new URL(target); } catch { return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 }); }

    // Fetch and forward bytes. Forward Range for streaming.
    try { console.log('[api/img] fetch', { host: new URL(target).hostname, pathPrefix: new URL(target).pathname.slice(0, 64) }); } catch {}
    const upstream = await fetch(target, {
      redirect: 'follow',
      headers: {
        ...(req.headers.get('range') ? { range: req.headers.get('range') as string } : {}),
      },
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return NextResponse.json({ error: 'Upstream error', status: upstream.status, body: text.slice(0, 2048) }, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const cache = upstream.headers.get('cache-control') || 'public, max-age=300';
    const status = upstream.status; // could be 200 or 206
    const headers: Record<string, string> = {
      'content-type': contentType,
      'cache-control': cache,
      'x-img-mode': 'fallback-stream',
    };
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
    if (contentRange) headers['content-range'] = contentRange;
    if (acceptRanges) headers['accept-ranges'] = acceptRanges;
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers['content-length'] = contentLength;
    return new NextResponse(upstream.body as any, {
      status,
      headers,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
