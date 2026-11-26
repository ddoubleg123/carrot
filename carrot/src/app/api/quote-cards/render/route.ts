import { NextResponse } from 'next/server'
import { curatorAllowed } from '@/lib/curator/access'
import { renderQuoteCard } from '@/lib/curator/quoteImage'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Ask the server kit for variants of one quote. A person still approves what posts. */
export async function POST(request: Request) {
  const secret = process.env.CURATOR_SECRET || process.env.INGEST_WORKER_SECRET || ''
  const header = request.headers.get('x-curator-secret') || ''
  const bySecret = Boolean(secret) && header === secret
  if (!bySecret && !(await curatorAllowed())) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  }
  const body = await request.json().catch(() => null) as {
    sentence?: string
    speaker?: string
    context?: string
    date?: string
    imageUrl?: string
  } | null
  if (!body?.sentence || !body.speaker) {
    return NextResponse.json({ error: 'A quote and a source are required.' }, { status: 400 })
  }
  const urls = await renderQuoteCard({
    sentence: body.sentence,
    speaker: body.speaker,
    context: body.context,
    date: body.date,
    imageUrl: body.imageUrl
  })
  return NextResponse.json({ urls })
}
