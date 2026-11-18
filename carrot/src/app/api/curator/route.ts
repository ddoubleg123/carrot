import { NextResponse } from 'next/server'
import { curatorAllowed } from '@/lib/curator/access'
import { readJournal, runCurator } from '@/lib/curator/hunt'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  if (!(await curatorAllowed())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const journal = await readJournal()
  return NextResponse.json(journal || { updatedAt: null, hunts: [] })
}

export async function POST() {
  if (!(await curatorAllowed())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const hunt = await runCurator({ rotate: true, maxKeep: 1, channels: 2, videosPerChannel: 1, articles: 1 })
  return NextResponse.json(hunt)
}
