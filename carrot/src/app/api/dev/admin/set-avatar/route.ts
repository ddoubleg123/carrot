import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    const path = searchParams.get('path');
    const assetId = searchParams.get('assetId');
    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });

    let chosenPath: string | undefined = undefined;
    if (path) {
      // Allow full public URL; if it's our storage public base, strip to path
      const PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE || 'https://storage.googleapis.com/involuted-river-466315-p0.firebasestorage.app/';
      if (/^https?:\/\//i.test(path) && path.startsWith(PUBLIC_BASE)) {
        const sliced = path.slice(PUBLIC_BASE.length);
        const q = sliced.indexOf('?');
        chosenPath = q >= 0 ? sliced.slice(0, q) : sliced;
      } else {
        // Assume it's already a storage path
        const q = path.indexOf('?');
        chosenPath = q >= 0 ? path.slice(0, q) : path;
      }
    } else if (assetId) {
      const a = await (prisma as any).mediaAsset.findUnique({ where: { id: assetId }, select: { thumbPath: true, storagePath: true, thumbUrl: true, url: true } });
      if (!a) return NextResponse.json({ ok: false, error: 'asset not found' }, { status: 404 });
      chosenPath = a.thumbPath || a.storagePath || undefined;
    }

    if (!chosenPath) return NextResponse.json({ ok: false, error: 'provide ?path=... or ?assetId=...' }, { status: 400 });

    // Update durable path using raw SQL to avoid Prisma-client drift
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "User" SET profile_photo_path = ? WHERE id = ?`,
      chosenPath,
      user.id
    );

    return NextResponse.json({ ok: true, user: { id: user.id, email, profilePhotoPath: chosenPath }, avatar: `/api/img?path=${encodeURIComponent(chosenPath)}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
