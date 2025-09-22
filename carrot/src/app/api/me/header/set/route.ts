import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// Sets the user's profile header image, preferring durable storage path
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    const userId = (session?.user as any)?.id;
    if (!email || !userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { path, url } = await req.json().catch(() => ({}));
    if (!path || typeof path !== 'string') return NextResponse.json({ ok: false, error: 'path required' }, { status: 400 });

    // Normalize path: strip query and host prefixes
    const q = path.indexOf('?');
    const normalized = q >= 0 ? path.slice(0, q) : path;

    // Raw SQL to avoid schema drift issues
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "User" SET profile_header_path = ? WHERE id = ?`,
      normalized,
      userId
    );
    if (url && typeof url === 'string') {
      // Keep a usable URL for immediate rendering if needed
      await prisma.user.update({ where: { id: userId }, data: { profileHeader: url } as any });
    }
    const final = url ? `/api/img?url=${encodeURIComponent(url)}` : `/api/img?path=${encodeURIComponent(normalized)}`;
    return NextResponse.json({ ok: true, header: final });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
