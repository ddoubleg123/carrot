import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const id = searchParams.get('id');

    if (!url && !id) {
      return NextResponse.json({ error: 'Provide either url or id' }, { status: 400 });
    }

    let asset = null as any;
    if (url) {
      asset = await prisma.mediaAsset.findFirst({ where: { url } });
    } else if (id) {
      asset = await prisma.mediaAsset.findUnique({ where: { id } });
    }

    if (!asset) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      id: asset.id,
      type: asset.type,
      url: asset.url,
      thumbUrl: asset.thumbUrl ?? null,
      thumbPath: asset.thumbPath ?? null,
      source: asset.source ?? null,
      createdAt: asset.createdAt ?? null,
    });
  } catch (e) {
    console.error('lookup error', e);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
}
