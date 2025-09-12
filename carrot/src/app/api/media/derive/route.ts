import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { auth } from '../../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/media/derive { id, inMs?, outMs?, aspect? }
// Stub: validates ownership and returns 202 Accepted. Hook to carrot-worker next.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '');
    const inMs = typeof body?.inMs === 'number' ? body.inMs : undefined;
    const outMs = typeof body?.outMs === 'number' ? body.outMs : undefined;
    const aspect = typeof body?.aspect === 'string' ? body.aspect : undefined;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { id: true, userId: true, storagePath: true } });
    if (!asset || asset.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // NOTE: Worker orchestration happens in the carrot-worker service.
    // The app does not call the worker directly or require worker env configuration.
    // Return 202 to indicate that the derive request was accepted.
    // TODO: If/when a job table is introduced, insert a job row here and let the worker pick it up.
    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
