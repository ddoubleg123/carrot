import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { interestGroups } from '@/lib/interestCatalog'
import { loadFeedRank } from '@/lib/feedRankStore'
import { readInterest } from '@/lib/readInterest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 280) : ''
  if (text.length < 3) return NextResponse.json({ error: 'Tell us a little more.' }, { status: 400 })
  const rank = await loadFeedRank().catch(() => null)
  const reading = await readInterest(text, interestGroups(rank?.extraTerms || {}))
  return NextResponse.json(reading)
}
