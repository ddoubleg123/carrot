import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/media/backfill/from-assets
// Creates Post rows from existing MediaAsset rows for the signed-in user.
// - video assets -> Post.videoUrl + thumbnailUrl
// - image assets -> Post.imageUrls (single URL) + thumbnailUrl fallback
// - gif assets   -> Post.gifUrl
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let limit = 200;
  let all = true;
  try {
    const { searchParams } = new URL(req.url);
    const l = searchParams.get('limit');
    if (l) limit = Math.max(1, Math.min(1000, parseInt(l, 10)));
    const a = searchParams.get('all');
    if (a === '0' || a === 'false') all = false;
  } catch {}

  try {
    // Fetch recent assets first; allow scanning all if requested.
    const where: any = { userId };
    const orderBy: any = { createdAt: 'desc' };
    const take = limit;

    const assets = await (prisma as any).mediaAsset.findMany({ where, orderBy, take });

    let created = 0;
    let skipped = 0;

    for (const a of assets) {
      const type = String(a.type || '').toLowerCase();
      if (type === 'video') {
        const exists = await prisma.post.findFirst({ where: { userId, OR: [{ videoUrl: a.url }, { cfUid: a.cfUid || undefined }] } });
        if (exists) { skipped++; continue; }
        await prisma.post.create({
          data: {
            userId,
            content: a.title || 'Imported media',
            thumbnailUrl: a.thumbUrl || null,
            videoUrl: a.url,
            cfUid: a.cfUid || null,
            cfStatus: a.cfStatus || null,
            gradientDirection: 'to-br',
            gradientFromColor: '#0f172a',
            gradientViaColor: '#1f2937',
            gradientToColor: '#0f172a',
          }
        });
        created++;
      } else if (type === 'image') {
        const exists = await prisma.post.findFirst({ where: { userId, imageUrls: { equals: a.url } } });
        if (exists) { skipped++; continue; }
        await prisma.post.create({
          data: {
            userId,
            content: a.title || 'Imported image',
            imageUrls: a.url, // single URL; renderer handles string/JSON array
            thumbnailUrl: a.thumbUrl || a.url || null,
            gradientDirection: 'to-br',
            gradientFromColor: '#0f172a',
            gradientViaColor: '#1f2937',
            gradientToColor: '#0f172a',
          }
        });
        created++;
      } else if (type === 'gif') {
        const exists = await prisma.post.findFirst({ where: { userId, gifUrl: a.url } });
        if (exists) { skipped++; continue; }
        await prisma.post.create({
          data: {
            userId,
            content: a.title || 'Imported gif',
            gifUrl: a.url,
            thumbnailUrl: a.thumbUrl || null,
            gradientDirection: 'to-br',
            gradientFromColor: '#0f172a',
            gradientViaColor: '#1f2937',
            gradientToColor: '#0f172a',
          }
        });
        created++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({ ok: true, created, examined: assets.length, limit, all });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// GET: browser-friendly trigger
export async function GET(req: Request) {
  return POST(req);
}
