import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // Prefer raw to fetch latest columns
    let row: any = null;
    try {
      const r: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT profile_photo_path as profilePhotoPath, profilePhoto, image FROM "User" WHERE email = ? LIMIT 1`,
        email
      );
      row = r?.[0] || null;
    } catch {}

    const path = row?.profilePhotoPath as string | undefined;
    const legacy = (row?.profilePhoto as string | undefined) || (row?.image as string | undefined);
    let url: string | undefined;
    // Prefer durable storage path first for consistent proxying
    if (path) {
      url = `/api/img?path=${encodeURIComponent(path)}`;
    } else if (legacy) {
      try { new URL(legacy); url = `/api/img?url=${encodeURIComponent(legacy)}`; }
      catch { url = legacy; }
    }
    return NextResponse.json({ ok: true, avatar: url || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
