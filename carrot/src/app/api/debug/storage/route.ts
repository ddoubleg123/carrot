import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

// Use the shared admin app initialization
import { app as adminApp } from '../../../../lib/firebase-admin';

// firebase-admin is CommonJS; import with require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefix = searchParams.get('prefix') || undefined;
    const max = Math.min(parseInt(searchParams.get('max') || '50', 10) || 50, 200);

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const storage = admin.storage(adminApp);
    const bucket = storage.bucket(bucketName);

    const [files] = await bucket.getFiles({ prefix, maxResults: max });

    const items = files.map((f: any) => ({
      name: f.name,
      size: f.metadata?.size,
      contentType: f.metadata?.contentType,
      updated: f.metadata?.updated,
      md5Hash: f.metadata?.md5Hash,
      generation: f.metadata?.generation,
    }));

    return NextResponse.json({ ok: true, bucket: bucketName, count: items.length, prefix: prefix || null, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
