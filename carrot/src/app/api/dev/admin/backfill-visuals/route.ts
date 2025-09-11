import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Dev-only endpoint to backfill Post.visualSeed and Post.visualStyle
// Safe and idempotent: only sets values when null.
// Disabled in production to avoid accidental mass writes.

export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) { return POST(req, _ctx); }

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dryRun = (searchParams.get('dryRun') ?? 'true').toLowerCase() !== 'false';
    const limit = Math.max(1, Math.min(500, parseInt(searchParams.get('limit') || '100', 10) || 100));

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { visualSeed: null },
          { visualStyle: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, visualSeed: true, visualStyle: true },
    });

    let updated = 0;
    const plan: Array<{ id: string; setSeed?: string; setStyle?: string }>= [];

    for (const p of posts) {
      const setSeed = p.visualSeed ?? p.id;
      const setStyle = p.visualStyle ?? 'liquid';
      plan.push({ id: p.id, setSeed, setStyle });
      if (!dryRun) {
        await prisma.post.update({ where: { id: p.id }, data: { visualSeed: setSeed, visualStyle: setStyle as any } });
        updated += 1;
      }
    }

    return NextResponse.json({ ok: true, dryRun, scanned: posts.length, updated, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
