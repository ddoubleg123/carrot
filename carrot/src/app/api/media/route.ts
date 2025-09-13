import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { auth } from '../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/media
// Supports both legacy and new clients.
// Query params (new client): q, includeHidden=1, type, sort=newest|oldest|az|duration, limit, t
// Legacy client: query, cursor, limit, format=wrapped to receive { items, nextCursor }
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { searchParams } = url;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      // Be forgiving for gallery: return empty list so UI doesn't hard-fail
      return NextResponse.json([]);
    }

    // Param normalization
    const q = (searchParams.get('q') || searchParams.get('query') || '').trim();
    const type = (searchParams.get('type') || 'any').toLowerCase();
    const includeHidden = searchParams.get('includeHidden') === '1';
    const sort = (searchParams.get('sort') || 'newest').toLowerCase();
    const limit = Math.max(1, Math.min(60, parseInt(searchParams.get('limit') || '24', 10) || 24));
    const cursor = searchParams.get('cursor') || undefined;
    const wantWrapped = searchParams.get('format') === 'wrapped';

    const where: any = { userId: session.user.id };
    if (!includeHidden) where.hidden = { in: [false, null] };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { source: { contains: q, mode: 'insensitive' } },
        { url: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (type && type !== 'any') {
      where.type = { contains: type, mode: 'insensitive' } as any;
    }

    const orderBy: any =
      sort === 'oldest' ? { createdAt: 'asc' } :
      sort === 'az' ? { title: 'asc' } :
      sort === 'duration' ? { durationSec: 'desc' } :
      { createdAt: 'desc' };

    const rows = await prisma.mediaAsset.findMany({
      where,
      orderBy,
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        userId: true,
        type: true,
        url: true,
        storagePath: true,
        thumbUrl: true,
        thumbPath: true,
        title: true,
        hidden: true,
        source: true,
        durationSec: true,
        width: true,
        height: true,
        createdAt: true,
        updatedAt: true,
        labels: { select: { label: { select: { name: true } } } },
      },
    } as any);

    const items = rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      type: (r.type || '').toLowerCase(),
      url: r.url || null,
      storagePath: r.storagePath || null,
      thumbUrl: r.thumbUrl || null,
      thumbPath: r.thumbPath || null,
      title: r.title || null,
      hidden: !!r.hidden,
      source: r.source || null,
      durationSec: typeof r.durationSec === 'number' ? r.durationSec : null,
      width: typeof r.width === 'number' ? r.width : null,
      height: typeof r.height === 'number' ? r.height : null,
      inUseCount: 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      labels: Array.isArray(r.labels) ? r.labels.map((x: any) => x?.label?.name).filter(Boolean) : [],
    }));

    if (wantWrapped) {
      const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id : undefined;
      return NextResponse.json({ items, nextCursor });
    }
    // Default shape for new client: plain array
    return NextResponse.json(items);
  } catch (e: any) {
    try { console.error('[api/media] GET failed:', e); } catch {}
    // Be defensive: do not break UI with 500s
    return NextResponse.json([]);
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
