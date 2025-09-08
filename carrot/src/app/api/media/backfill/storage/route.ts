import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { app as adminApp } from '@/lib/firebase-admin';
import prisma from '@/lib/prisma';
import { createMedia } from '@/lib/mediaServer';

// firebase-admin is CJS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');

export const runtime = 'nodejs';

// POST /api/media/backfill/storage?prefix=ingest/&limit=500
// Scans Firebase Storage under the given prefix and creates MediaAsset rows for the signed-in user.
export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let prefix = 'ingest/';
  let limit = 500;
  try {
    const { searchParams } = new URL(request.url);
    const p = searchParams.get('prefix');
    if (p) prefix = p;
    const l = searchParams.get('limit');
    if (l) limit = Math.max(1, Math.min(2000, parseInt(l, 10)));
  } catch {}

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    return NextResponse.json({ error: 'Missing FIREBASE_STORAGE_BUCKET' }, { status: 500 });
  }

  try {
    const storage = admin.storage(adminApp);
    const bucket = storage.bucket(bucketName);

    // List files
    const [files] = await bucket.getFiles({ prefix, maxResults: limit });

    // Group by job folder: e.g., ingest/<jobId>/video.mp4 and ingest/<jobId>/thumb.jpg
    type Item = { videoUrl?: string; thumbUrl?: string };
    const map = new Map<string, Item>();
    for (const f of files) {
      const name: string = f.name || '';
      if (!name) continue;
      // Expect paths like ingest/<jobId>/video.mp4 or thumb.jpg
      const parts = name.split('/');
      if (parts.length < 3) continue;
      const jobId = parts[1];
      const item = map.get(jobId) || {};
      if (/video\.mp4$/i.test(name)) {
        item.videoUrl = (await f.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 }))[0];
      } else if (/thumb\.(jpg|jpeg|png)$/i.test(name)) {
        item.thumbUrl = (await f.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 }))[0];
      }
      map.set(jobId, item);
    }

    let created = 0;
    let examined = 0;
    for (const item of map.values()) {
      examined += 1;
      const url = item.videoUrl; // Only import videos here
      if (!url) continue;
      const existing = await (prisma as any).mediaAsset.findFirst({ where: { userId, url } });
      if (existing) continue;
      await createMedia({
        userId,
        type: 'video',
        url,
        thumbUrl: item.thumbUrl || null,
        title: null,
        durationSec: null,
        width: null,
        height: null,
        source: 'storage',
        cfUid: null,
        cfStatus: null,
      });
      created += 1;
    }

    return NextResponse.json({ ok: true, created, examined, prefix, bucket: bucketName });
  } catch (e: any) {
    console.error('[api/media/backfill/storage] failed:', e?.message || e);
    return NextResponse.json({ error: 'Storage backfill failed', message: e?.message || String(e) }, { status: 500 });
  }
}

export async function GET(request: Request, _ctx: { params: Promise<{}> }) {
  return POST(request, _ctx);
}
