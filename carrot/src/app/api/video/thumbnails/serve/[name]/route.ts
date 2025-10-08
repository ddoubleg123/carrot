import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { readFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serve extracted thumbnails saved by /api/video/thumbnails
// URL shape: /api/video/thumbnails/serve/[name]
// where [name] matches the pattern `${timestamp}_${indexPadded}` and maps to a file
// on disk at `${process.cwd()}/temp/thumb_${name}.jpg`.

const TEMP_DIR = join(process.cwd(), 'temp');
const TTL_MS = 60 * 60 * 1000; // 1 hour best-effort cleanup

async function tryCleanupOldThumbs() {
  try {
    const entries = await readdir(TEMP_DIR, { withFileTypes: true }).catch(() => [] as any);
    const now = Date.now();
    const tasks: Promise<any>[] = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!e.name.startsWith('thumb_') || !e.name.endsWith('.jpg')) continue;
      // Extract timestamp from name: thumb_<ts>_###.jpg
      const m = e.name.match(/^thumb_(\d+)_\d{3}\.jpg$/);
      if (!m) continue;
      const ts = parseInt(m[1], 10);
      if (Number.isFinite(ts) && now - ts > TTL_MS) {
        tasks.push(unlink(join(TEMP_DIR, e.name)).catch(() => {}));
      }
    }
    await Promise.allSettled(tasks);
  } catch {}
}

export async function GET(_req: Request) {
  try {
    // Extract dynamic [name] from URL path: /api/video/thumbnails/serve/<name>
    const { pathname } = new URL(_req.url);
    const match = pathname.match(/\/api\/video\/thumbnails\/serve\/([^/?#]+)/);
    const raw = match ? match[1] : '';
    const name = decodeURIComponent(raw).toString().replace(/[^0-9_]/g, '');
    if (!name) {
      return NextResponse.json({ error: 'missing name' }, { status: 400 });
    }

    const filePath = join(TEMP_DIR, `thumb_${name}.jpg`);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
    }

    const buf = await readFile(filePath);

    // Opportunistic cleanup (fire-and-forget)
    void tryCleanupOldThumbs();

    const headers = new Headers();
    headers.set('content-type', 'image/jpeg');
    headers.set('cache-control', 'public, max-age=86400, immutable');
    headers.set('access-control-allow-origin', '*');

    const body = new Uint8Array(buf);
    return new NextResponse(body, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: 'serve failed', details: e?.message || String(e) }, { status: 500 });
  }
}

export async function HEAD(req: Request) {
  const res = await GET(req);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
