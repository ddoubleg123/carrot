import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { auth } from '../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/media?query=&cursor=&limit=
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('query') || '').trim();
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '24', 10) || 24));
    const cursor = searchParams.get('cursor') || undefined;

    const where: any = { userId: session.user.id, hidden: { in: [false, null] } };
    if (q) where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { source: { contains: q, mode: 'insensitive' } },
    ];

    const rows = await prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        assets: false as any,
        labels: {
          include: { label: true },
        },
      },
    } as any);

    const items = rows.map((r: any) => ({
      id: r.id,
      kind: (r.type || '').toLowerCase().includes('video') ? 'video' : 'image',
      title: r.title || '',
      duration: typeof r.durationSec === 'number' ? r.durationSec : undefined,
      thumbPath: r.thumbPath || r.storagePath || '',
      posterUrl: r.thumbUrl || null,
      url: r.url || null,
      captionVttUrl: r.captionVttUrl || r.transcriptVttUrl || null,
      storagePath: r.storagePath || '',
      tags: (r.labels || []).map((x: any) => x?.label?.name).filter(Boolean),
      hidden: !!r.hidden,
    }));
    const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id : undefined;
    return NextResponse.json({ items, nextCursor });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// POST /api/media
// Body: { url: string, type?: 'video'|'image'|'gif'|'audio', title?: string, thumbUrl?: string, durationSec?: number, width?: number, height?: number, source?: string }
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url : '';
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    const t = String(body?.type || '').toLowerCase();
    const type: string = ['video','image','gif','audio'].includes(t) ? t : (url.match(/\.gif(\?|$)/i) ? 'gif' : (url.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : 'image'));
    const title = typeof body?.title === 'string' ? body.title : null;
    const thumbUrl = typeof body?.thumbUrl === 'string' ? body.thumbUrl : null;
    const durationSec = typeof body?.durationSec === 'number' ? body.durationSec : null;
    const width = typeof body?.width === 'number' ? body.width : null;
    const height = typeof body?.height === 'number' ? body.height : null;
    const source = typeof body?.source === 'string' ? body.source : 'upload';

    const exists = await prisma.mediaAsset.findFirst({ where: { userId: session.user.id, url } });
    if (exists) return NextResponse.json({ id: exists.id }, { status: 200 });

    const created = await prisma.mediaAsset.create({
      data: {
        userId: session.user.id,
        url,
        type,
        title,
        thumbUrl,
        durationSec: durationSec ?? undefined,
        width: width ?? undefined,
        height: height ?? undefined,
        source,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
