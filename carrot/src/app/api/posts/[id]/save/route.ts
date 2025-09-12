import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { auth } from '../../../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/posts/[id]/save -> toggles save for current user
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;

    const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = await (prisma as any).postSave.findUnique({ where: { post_user_save_unique: { post_id: id, user_id: session.user.id } } });
    if (existing) {
      await (prisma as any).postSave.delete({ where: { id: existing.id } });
    } else {
      await (prisma as any).postSave.create({ data: { post_id: id, user_id: session.user.id } });
    }

    const saved = !existing;
    return NextResponse.json({ saved });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
