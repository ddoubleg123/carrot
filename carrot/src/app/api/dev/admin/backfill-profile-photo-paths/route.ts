import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function tryDerivePathFromUrl(url: string): string | null {
  try {
    // Firebase REST URLs commonly look like:
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?alt=media&token=...
    // Extract the portion after '/o/' and decode it
    const oIdx = url.indexOf('/o/');
    if (oIdx !== -1) {
      const qIdx = url.indexOf('?', oIdx);
      const encoded = qIdx !== -1 ? url.slice(oIdx + 3, qIdx) : url.slice(oIdx + 3);
      try {
        const decoded = decodeURIComponent(encoded);
        return decoded.replace(/^\/+/, '');
      } catch {
        return encoded.replace(/^\/+/, '');
      }
    }
    // GCS XML API or alt base
    // https://storage.googleapis.com/<bucket>/<path>
    const gcs = new URL(url);
    const host = gcs.hostname;
    if (/googleapis\.com$/i.test(host)) {
      const parts = gcs.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        // [bucket, ...path]
        const path = parts.slice(1).join('/');
        return path || null;
      }
    }
  } catch {}
  return null;
}

export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  return POST(req, _ctx); // allow GET for convenience
}

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const dryRun = (searchParams.get('dryRun') ?? 'true').toLowerCase() !== 'false';
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));

    // Find users missing profilePhotoPath but with a legacy profilePhoto URL
    // Do NOT filter on profilePhotoPath here because older Prisma clients may not include it.
    // Instead, fetch candidates with a legacy profilePhoto URL, then check path via raw SQL.
    const users = await prisma.user.findMany({
      where: { NOT: [{ profilePhoto: null }] },
      select: { id: true, email: true, profilePhoto: true },
      take: limit,
      orderBy: { id: 'asc' },
    });

    const plan: Array<{ id: string; email: string | null; fromUrl?: string | null; toPath?: string | null; reason?: string }>
      = [];

    for (const u of users) {
      // Check current path using raw SQL to avoid Prisma client version drift
      let hasPath: boolean = false;
      try {
        const r: Array<{ profile_photo_path: string | null }> = await (prisma as any).$queryRawUnsafe(
          `SELECT profile_photo_path FROM "User" WHERE id = ? LIMIT 1`,
          u.id
        );
        const row = r?.[0];
        if (row && row.profile_photo_path) hasPath = true;
      } catch {}
      if (hasPath) {
        plan.push({ id: u.id, email: u.email, fromUrl: (u as any).profilePhoto as any, toPath: null, reason: 'Already has profile_photo_path' });
        continue;
      }
      const url = (u as any).profilePhoto as string | null | undefined;
      if (!url) {
        plan.push({ id: u.id, email: u.email, fromUrl: null, toPath: null, reason: 'No profilePhoto URL' });
        continue;
      }
      const derived = tryDerivePathFromUrl(url);
      if (!derived) {
        plan.push({ id: u.id, email: u.email, fromUrl: url, toPath: null, reason: 'Could not derive storage path from URL' });
        continue;
      }
      plan.push({ id: u.id, email: u.email, fromUrl: url, toPath: derived });
    }

    if (!dryRun) {
      let updated = 0;
      for (const p of plan) {
        if (p.toPath) {
          // Use raw SQL to write the mapped column to avoid Prisma client drift
          await (prisma as any).$executeRawUnsafe(
            `UPDATE "User" SET profile_photo_path = ? WHERE id = ?`,
            p.toPath,
            p.id
          );
          updated += 1;
        }
      }
      return NextResponse.json({ ok: true, dryRun: false, scanned: users.length, updated, plan });
    }

    return NextResponse.json({ ok: true, dryRun: true, scanned: users.length, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
