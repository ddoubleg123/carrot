import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// Returns the current user's profile header image URL (proxied through /api/img)
export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // Prefer raw to fetch latest schema columns without Prisma drift
    let row: any = null;
    try {
      const r: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT profile_header_path as profileHeaderPath, profileHeader, coverPhoto FROM "User" WHERE email = ? LIMIT 1`,
        email
      );
      row = r?.[0] || null;
    } catch {}

    const path = row?.profileHeaderPath as string | undefined;
    const legacy = (row?.profileHeader as string | undefined) || (row?.coverPhoto as string | undefined);
    let url: string | undefined;
    // Prefer durable path for consistent proxying
    if (path) {
      url = `/api/img?path=${encodeURIComponent(path)}`;
    } else if (legacy) {
      try { new URL(legacy); url = `/api/img?url=${encodeURIComponent(legacy)}`; }
      catch { url = legacy; }
    }
    return NextResponse.json({ ok: true, header: url || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
