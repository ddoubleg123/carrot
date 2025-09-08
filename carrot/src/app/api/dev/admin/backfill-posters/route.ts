import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Dev-only endpoint to backfill durable thumbnails (posters) for VIDEO assets.
// Strategy v1 (no ffmpeg):
// - For MediaAsset where type='video' and thumbUrl is null
// - Try to find a related IngestJob by matching media_url or video_url or source_url_normalized substrings in asset.url
// - If IngestJob.thumbnail_url exists, copy it into MediaAsset.thumbUrl
// This is a safe, idempotent backfill and avoids schema changes.

export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) { return POST(req, _ctx); }

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dryRun = (searchParams.get('dryRun') ?? 'true').toLowerCase() !== 'false';
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));

    // Find candidate assets
    const assets = await (prisma as any).mediaAsset.findMany({
      where: { type: 'video', thumbUrl: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, userId: true, url: true, storagePath: true, createdAt: true },
    });

    const plan: Array<{ id: string; url: string; from?: string | null; to?: string | null; reason: string }>= [];

    let updated = 0;
    for (const a of assets) {
      const url = a.url || '';
      // Attempt to find a related ingest job by URL heuristics
      const jobs = await prisma.ingestJob.findMany({
        where: {
          OR: [
            { mediaUrl: url },
            { videoUrl: url },
            { sourceUrl: url },
            // Loose contains as a last resort (SQLite LIKE)
            { mediaUrl: { contains: url.slice(0, 24) } },
            { videoUrl: { contains: url.slice(0, 24) } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, thumbnailUrl: true, mediaUrl: true, videoUrl: true },
      });

      const job = jobs[0];
      const thumb = job?.thumbnailUrl || null;
      if (thumb) {
        plan.push({ id: a.id, url, from: null, to: thumb, reason: 'Copy thumbnailUrl from IngestJob' });
        if (!dryRun) {
          await (prisma as any).mediaAsset.update({ where: { id: a.id }, data: { thumbUrl: thumb } });
          updated += 1;
        }
      } else {
        plan.push({ id: a.id, url, reason: 'No matching IngestJob thumbnail found' });
      }
    }

    return NextResponse.json({ ok: true, dryRun, scanned: assets.length, updated, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
