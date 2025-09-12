import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/media/[id]/caption
// Body: { captionVttUrl: string }
// Intended for carrot-worker callback. Auth via x-worker-secret matches INGEST_WORKER_SECRET.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const secretHeader = req.headers.get('x-worker-secret') || '';
    const secret = process.env.INGEST_WORKER_SECRET || '';
    if (!secret || secretHeader !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const captionVttUrl = typeof body?.captionVttUrl === 'string' ? body.captionVttUrl : '';
    if (!id || !captionVttUrl) {
      return NextResponse.json({ error: 'Missing id or captionVttUrl' }, { status: 400 });
    }
    await (prisma as any).mediaAsset.update({
      where: { id },
      data: { captionVttUrl },
    });
    return NextResponse.json({ id, captionVttUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
