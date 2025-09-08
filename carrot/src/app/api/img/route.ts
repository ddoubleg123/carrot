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
    const urlParam = searchParams.get('url');
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
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
          }),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      }
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(objectPath);
      const [buf] = await file.download();
      const [meta] = await file.getMetadata().catch(() => [{ contentType: 'image/jpeg', cacheControl: 'public,max-age=300' }]);
      const resp = new NextResponse(buf, {
        status: 200,
        headers: {
          'content-type': meta?.contentType || 'image/jpeg',
          'cache-control': meta?.cacheControl || 'public, max-age=86400, stale-while-revalidate=604800',
          'x-img-bucket': bucketName,
          'x-img-path': objectPath,
          'x-img-mode': 'admin',
        },
      });
      return resp;
    };

    let target: string | null = null;
    if (urlParam) {
      // If urlParam is a Firebase Storage URL, try to extract the bucket and object path and use Admin SDK
      const m = urlParam.match(/\/b\/([^/]+)\/o\/([^?]+)(?:\?|$)/);
      const pathOnly = urlParam.match(/\/o\/([^?]+)(?:\?|$)/);
      if (m && m[1] && m[2]) {
        const bucketFromUrl = decodeURIComponent(m[1]);
        const safePath = decodeURIComponent(decodeURIComponent(m[2])).replace(/^\/+/, '');
        try {
          return await adminDownload(bucketFromUrl, safePath);
        } catch (e) {
          // Try configured bucket as a fallback
          try {
            const fallbackBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
            if (fallbackBucket) return await adminDownload(fallbackBucket, safePath);
          } catch {}
          // If Admin attempts fail
          if (!allowUrlFallback) {
            return NextResponse.json({ error: 'Admin download failed', bucketTried: bucketFromUrl, path: safePath }, { status: 502 });
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
            return NextResponse.json({ error: 'Admin download failed', bucketTried: process.env.FIREBASE_STORAGE_BUCKET, path: safePath }, { status: 502 });
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

    // Fetch and forward bytes
    const upstream = await fetch(target, { redirect: 'follow' });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return NextResponse.json({ error: 'Upstream error', status: upstream.status, body: text.slice(0, 2048) }, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const cache = upstream.headers.get('cache-control') || 'public, max-age=300';
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': cache,
        'x-img-mode': 'fallback',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
