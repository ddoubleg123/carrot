import { NextResponse } from 'next/server'
import { resolveShows } from '@/lib/live/now'
import { channelFromUrl } from '@/lib/live/search'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { shows?: unknown } = {}
  try { body = await request.json() } catch { return NextResponse.json({ items: [] }) }
  const rows = Array.isArray(body.shows) ? body.shows : []
  const shows = rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const record = row as { name?: unknown; url?: unknown }
    const parsed = channelFromUrl(String(record.url || ''), typeof record.name === 'string' ? record.name : undefined)
    return parsed ? [parsed] : []
  }).slice(0, 8)
  const items = await resolveShows(shows)
  return NextResponse.json({ items })
}
