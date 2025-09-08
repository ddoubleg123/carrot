import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { createMedia } from '@/lib/mediaServer';

export const runtime = 'nodejs';

// POST /api/media/backfill
// Ensures recent completed ingest jobs produce MediaAsset rows for the signed-in user.
export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let limit = 10;
  let hours = 24;
  try {
    const { searchParams } = new URL(request.url);
    const l = searchParams.get('limit');
    if (l) limit = Math.max(1, Math.min(100, parseInt(l, 10)));
    const h = searchParams.get('hours');
    if (h) hours = Math.max(1, Math.min(168, parseInt(h, 10))); // up to 7 days
  } catch {}

  try {
    // Find recent completed ingest jobs (any user), then attach results to the current user's Media Library
    // This covers cases where ingests were started while not signed-in or under a different userId.
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const jobs = await (prisma as any).ingestJob.findMany({
      where: { status: { in: ['completed', 'success', 'done', 'finished'] }, updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    let created = 0;
    for (const job of jobs) {
      const url: string | null = job.videoUrl || job.mediaUrl;
      if (!url) continue;
      const existing = await (prisma as any).mediaAsset.findFirst({ where: { userId, url } });
      if (existing) continue;
      const type: 'video' | 'image' | 'gif' | 'audio' = job.videoUrl ? 'video' : (job.mediaUrl?.match(/\.gif($|\?)/i) ? 'gif' : 'image');
      await createMedia({
        userId,
        type,
        url,
        thumbUrl: job.thumbnailUrl,
        title: job.title ?? null,
        durationSec: job.durationSec ?? null,
        width: job.width ?? null,
        height: job.height ?? null,
        source: 'external',
        cfUid: job.cfUid ?? null,
        cfStatus: job.cfStatus ?? null,
      });
      created += 1;
    }

    return NextResponse.json({ created, examined: jobs.length, hours });
  } catch (e: any) {
    console.error('[api/media/backfill] failed:', e?.message || e);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}

// Allow GET to trigger the same logic (browser-friendly)
export async function GET(request: Request, _ctx: { params: Promise<{}> }) {
  return POST(request, _ctx);
}
