import { NextResponse } from 'next/server'
import { isXUrl, searchChannels } from '@/lib/live/search'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') || ''
  if (isXUrl(query)) {
    return NextResponse.json({ hits: [], note: 'x' })
  }
  const hits = await searchChannels(query)
  if (hits.length === 0 && /^https?:/i.test(query.trim())) {
    return NextResponse.json({ hits: [], note: 'link' })
  }
  return NextResponse.json({ hits, note: null })
}
