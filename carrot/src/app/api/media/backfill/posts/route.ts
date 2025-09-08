import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { createMedia } from '@/lib/mediaServer';

export const runtime = 'nodejs';

// POST /api/media/backfill/posts
// Creates MediaAsset rows from existing Posts that have media URLs for the current user.
export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let limit = 50;
  let hours = 720; // 30 days by default
  try {
    const { searchParams } = new URL(request.url);
    const l = searchParams.get('limit');
    if (l) limit = Math.max(1, Math.min(500, parseInt(l, 10)));
    const h = searchParams.get('hours');
    if (h) hours = Math.max(1, Math.min(24 * 180, parseInt(h, 10))); // up to ~6 months
  } catch {}

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    // Fetch posts from ANY user to harvest media URLs, then attach assets to CURRENT user.
    const posts = await prisma.post.findMany({
      where: { OR: [ { videoUrl: { not: null } }, { gifUrl: { not: null } }, { imageUrls: { not: null } } ], updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    let created = 0;
    for (const p of posts) {
      // Prefer videoUrl, else gif, else first image
      const url = p.videoUrl || p.gifUrl || (p.imageUrls ? p.imageUrls.split(',')[0]?.trim() : null);
      if (!url) continue;
      const type: 'video' | 'image' | 'gif' | 'audio' = p.videoUrl ? 'video' : (p.gifUrl ? 'gif' : 'image');
      const exists = await (prisma as any).mediaAsset.findFirst({ where: { userId, url } });
      if (exists) continue;
      await createMedia({
        userId,
        type,
        url,
        thumbUrl: p.thumbnailUrl ?? null,
        title: p.content?.slice(0, 80) ?? null,
        durationSec: p.cfDurationSec ?? null,
        width: p.cfWidth ?? null,
        height: p.cfHeight ?? null,
        source: 'post',
        cfUid: p.cfUid ?? null,
        cfStatus: p.cfStatus ?? null,
      });
      created += 1;
    }

    return NextResponse.json({ created, examined: posts.length, hours });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('[api/media/backfill/posts] failed:', msg);
    return NextResponse.json({ error: 'Backfill from posts failed', message: msg }, { status: 500 });
  }
}

// Allow triggering via GET (browser-friendly) with same auth and logic
export async function GET(request: Request, _ctx: { params: Promise<{}> }) {
  return POST(request, _ctx);
}
