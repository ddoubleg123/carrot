import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const type = (searchParams.get('type') || 'image').toLowerCase(); // image | video | any
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20', 10) || 20));
    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });

    const where: any = { userId: user.id };
    if (type !== 'any') where.type = type;

    const assets = await (prisma as any).mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        url: true,
        storagePath: true,
        thumbUrl: true,
        thumbPath: true,
        title: true,
        width: true,
        height: true,
        createdAt: true,
      }
    });

    return NextResponse.json({ ok: true, count: assets.length, assets });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
