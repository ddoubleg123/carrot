import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const provided = (req.headers.get('x-worker-secret') || '').trim();
    const expected = process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret';
    if (!expected || provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const {
      userId,
      content = '',
      videoUrl,
      audioUrl,
      thumbnailUrl,
    } = body || {};

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Ensure the user exists to avoid FK violations
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: `User not found for id: ${userId}` }, { status: 400 });
    }

    const hasMedia = Boolean(audioUrl || videoUrl);
    const transcriptionStatus = hasMedia ? 'pending' : null;

    const post = await prisma.post.create({
      data: {
        userId,
        content,
        videoUrl: videoUrl || null,
        audioUrl: audioUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        transcriptionStatus,
      },
      include: {
        User: { select: { id: true, name: true, email: true, image: true, username: true } },
      },
    });

    return NextResponse.json({ ok: true, postId: post.id });
  } catch (err: any) {
    console.error('[INGEST-CREATE-POST] Error:', err?.stack || err?.message || err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
