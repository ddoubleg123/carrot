import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { sanitizePicks } from '@/lib/interestCatalog'
import { picksFrom, saveInterestPicks } from '@/lib/recordInterest'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true, interests: true } })
  return NextResponse.json({ picks: picksFrom(viewer?.metadata), summary: viewer?.interests || '' })
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const picks = sanitizePicks(body?.picks)
  if (picks.length < 3) return NextResponse.json({ error: 'Choose at least three topics.' }, { status: 400 })
  await saveInterestPicks(userId, picks)
  await prisma.user.update({
    where: { id: userId },
    data: { interests: picks.map((pick) => pick.label).join(', ').slice(0, 255) }
  })
  return NextResponse.json({ picks })
}
