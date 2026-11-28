import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { bucketOf, recordInterest } from '@/lib/recordInterest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, bucket: true, userId: true, User: { select: { username: true } } }
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await recordInterest(userId, bucketOf(post), 'share', `share:${id}`).catch((error) => {
    console.error('[interest] share', error)
  })
  return NextResponse.json({ shared: true })
}
