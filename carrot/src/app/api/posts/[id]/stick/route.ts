import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { auth } from '../../../../../auth'
import { markOn, recordTaste } from '@/lib/tasteRecord'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = (session as { user?: { id?: string } } | null)?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const stuck = (await markOn(userId, id)) === 'stick'
  if (!stuck) {
    await prisma.postLike.deleteMany({ where: { postId: id, userId } })
  }
  await recordTaste(userId, id, stuck ? null : 'stick')
  const likes = await prisma.postLike.count({ where: { postId: id } })
  return NextResponse.json({ stuck: !stuck, likes })
}
