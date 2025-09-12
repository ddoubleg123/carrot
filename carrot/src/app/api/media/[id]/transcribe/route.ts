import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { auth } from '../../../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/media/[id]/transcribe
// Validates ownership and returns 202 Accepted. The worker handles orchestration.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;

    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // NOTE: The app does not orchestrate transcription; carrot-worker does.
    // Optionally, insert a job row here in the future for worker pickup.
    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
