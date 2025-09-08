import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Dev-only: delete all posts for a user except the most recent N
export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  return POST(req, _ctx);
}

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const keepParam = searchParams.get('keep') || '5';
    const keep = Math.max(0, parseInt(keepParam, 10) || 0);
    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });

    // Find IDs of posts to keep (most recent by createdAt)
    const latest = await prisma.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: keep,
      select: { id: true },
    });
    const keepIds = new Set(latest.map(p => p.id));

    // Find IDs to delete
    const toDelete = await prisma.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: keep,
      select: { id: true },
    });

    if (toDelete.length === 0) {
      return NextResponse.json({ ok: true, kept: latest.length, deleted: 0, keepIds: Array.from(keepIds) });
    }

    const del = await prisma.post.deleteMany({ where: { id: { in: toDelete.map(p => p.id) } } });
    return NextResponse.json({ ok: true, kept: latest.length, deleted: del.count, keepIds: Array.from(keepIds) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
