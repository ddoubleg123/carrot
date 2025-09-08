import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    const userId = (session?.user as any)?.id;
    if (!email || !userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { path, url } = await req.json().catch(() => ({}));
    if (!path || typeof path !== 'string') return NextResponse.json({ ok: false, error: 'path required' }, { status: 400 });

    // Normalize path: strip query and enforce no leading public base
    const q = path.indexOf('?');
    const normalized = q >= 0 ? path.slice(0, q) : path;

    // Update durable path using raw SQL (avoids Prisma drift)
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "User" SET profile_photo_path = ? WHERE id = ?`,
      normalized,
      userId
    );
    if (url && typeof url === 'string') {
      // Also store a usable URL for immediate rendering
      await prisma.user.update({ where: { id: userId }, data: { profilePhoto: url } });
    }
    const final = url ? `/api/img?url=${encodeURIComponent(url)}` : `/api/img?path=${encodeURIComponent(normalized)}`;
    return NextResponse.json({ ok: true, avatar: final });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
