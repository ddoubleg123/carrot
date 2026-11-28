import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { interestGroups } from '@/lib/interestCatalog'
import { loadFeedRank } from '@/lib/feedRankStore'
import { picksFrom } from '@/lib/recordInterest'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rank = await loadFeedRank().catch(() => null)
  const groups = interestGroups(rank?.extraTerms || {})
  const session = await auth()
  const userId = session?.user?.id
  let picks: ReturnType<typeof picksFrom> = []
  if (userId) {
    const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } })
    picks = picksFrom(viewer?.metadata)
  }
  return NextResponse.json({ groups, picks })
}
