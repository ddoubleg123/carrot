import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { auth } from '../../../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/posts/[id]/like -> toggles like for current user
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;

    const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = await (prisma as any).postLike.findUnique({ where: { post_user_like_unique: { post_id: id, user_id: session.user.id } } });
    if (existing) {
      await (prisma as any).postLike.delete({ where: { id: existing.id } });
    } else {
      await (prisma as any).postLike.create({ data: { post_id: id, user_id: session.user.id } });
    }

    const likes = await (prisma as any).postLike.count({ where: { post_id: id } });
    return NextResponse.json({ liked: !existing, likes });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
