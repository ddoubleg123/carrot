import { NextResponse } from 'next/server';
import authModule, { auth as namedAuth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// Normalize Firebase/Storage signed URLs to durable alt=media path form
function normalizeVideoUrl(u?: string | null): string | null {
  if (!u || typeof u !== 'string') return null;
  try {
    const url = new URL(u);
    const host = url.hostname;
    const sp = url.searchParams;
    const isStorage = host.includes('firebasestorage.googleapis.com') || host.includes('storage.googleapis.com') || host.endsWith('.firebasestorage.app');
    if (!isStorage) return u; // leave non-Google storage URLs as-is

    let bucket: string | undefined;
    let path: string | undefined;

    // firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>
    const m1 = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (host === 'firebasestorage.googleapis.com' && m1) {
      bucket = decodeURIComponent(m1[1]);
      path = decodeURIComponent(m1[2]);
    }
    // storage.googleapis.com/<bucket>/<path>
    if (!bucket || !path) {
      const m2 = url.pathname.match(/^\/([^/]+)\/(.+)$/);
      if (host === 'storage.googleapis.com' && m2) {
        bucket = decodeURIComponent(m2[1]);
        path = decodeURIComponent(m2[2]);
      }
    }
    // <sub>.firebasestorage.app/o/<ENCODED_PATH>
    if (!bucket || !path) {
      const m4 = url.pathname.match(/^\/o\/([^?]+)$/);
      if (host.endsWith('.firebasestorage.app') && m4) {
        path = decodeURIComponent(m4[1]);
        const ga = sp.get('GoogleAccessId') || '';
        const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
        if (projectMatch) bucket = `${projectMatch[1]}.appspot.com`;
      }
    }
    // Generic: any /o/<ENCODED_PATH> segment
    if (!bucket || !path) {
      const m3 = url.pathname.match(/\/o\/([^?]+)$/);
      if (m3) {
        path = decodeURIComponent(m3[1]);
        const ga = sp.get('GoogleAccessId') || '';
        const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
        if (projectMatch) bucket = `${projectMatch[1]}.appspot.com`;
      }
    }
    if (bucket && path) {
      const encPath = encodeURIComponent(path);
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encPath}?alt=media`;
    }
    if (host === 'firebasestorage.googleapis.com' && !sp.has('alt')) {
      url.searchParams.set('alt', 'media');
      return url.toString();
    }
    return u;
  } catch {
    return u || null;
  }
}

async function runBackfill({ hours, limit, all, dryRun, debug }: { hours: number; limit: number; all: boolean; dryRun: boolean; debug: boolean; }) {
  const where: any = { NOT: { videoUrl: null } };
  if (!all) where.updatedAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };

  const posts = await prisma.post.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.max(1, Math.min(limit, 2000)),
    select: { id: true, videoUrl: true },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const changes: Array<{ id: string; from: string; to: string; }> = [];
  const errors: Array<{ id: string; error: string; }> = [];

  for (const p of posts) {
    try {
      const normalized = normalizeVideoUrl(p.videoUrl);
      if (!normalized || normalized === p.videoUrl) {
        skipped += 1;
        continue;
      }
      changes.push({ id: p.id, from: p.videoUrl as string, to: normalized });
      if (!dryRun) {
        await prisma.post.update({ where: { id: p.id }, data: { videoUrl: normalized } });
      }
      updated += 1;
    } catch (e: any) {
      failed += 1;
      const msg = e?.message || String(e);
      errors.push({ id: p?.id as string, error: msg });
      if (debug) {
        try { console.error('[backfill-normalize] per-record failed', p?.id, msg); } catch {}
      }
    }
  }

  return { examined: posts.length, updated, skipped, failed, changes: changes.slice(0, 50), errors: debug ? errors.slice(0, 50) : undefined };
}

export async function POST(request: Request) {
  // Resolve auth() from either named export or default export to avoid bundler differences
  const authFn: any = (typeof namedAuth === 'function')
    ? namedAuth
    : (typeof (authModule as any)?.auth === 'function' ? (authModule as any).auth : null);

  let limit = 200;
  let hours = 168; // 7 days
  let all = false;
  let dryRun = true;
  let debug = false;
  let providedSecret: string | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const l = searchParams.get('limit');
    if (l) limit = Math.max(1, Math.min(5000, parseInt(l, 10)));
    const h = searchParams.get('hours');
    if (h) hours = Math.max(1, Math.min(24 * 365, parseInt(h, 10)));
    const a = searchParams.get('all');
    if (a === '1' || a === 'true') all = true;
    const d = searchParams.get('dryRun');
    if (d === '0' || d === 'false') dryRun = false;
    providedSecret = searchParams.get('secret');
    const dbg = searchParams.get('debug');
    debug = dbg === '1' || dbg === 'true';
  } catch {}

  // AuthZ: allow when
  // - auth() resolves and user is present, OR
  // - a matching secret is provided via ?secret=BACKFILL_SECRET, OR
  // - in dryRun mode during development
  try {
    const envSecret = process.env.BACKFILL_SECRET || process.env.INGEST_WORKER_SECRET || '';
    const secretOk = providedSecret && envSecret && providedSecret === envSecret;
    let userOk = false;
    if (authFn) {
      try {
        const session = await authFn();
        userOk = Boolean(session?.user?.id);
      } catch {}
    }
    const allow = userOk || secretOk || (dryRun && process.env.NODE_ENV !== 'production');
    if (!allow) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {}

  try {
    const res = await runBackfill({ hours, limit, all, dryRun, debug });
    return NextResponse.json({ ok: true, params: { hours, limit, all, dryRun, debug }, ...res });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('[api/video/backfill-normalize] failed', msg);
    const body: any = { error: 'Backfill failed' };
    if (process.env.NODE_ENV !== 'production' || debug) {
      body.details = msg;
    }
    return NextResponse.json(body, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
