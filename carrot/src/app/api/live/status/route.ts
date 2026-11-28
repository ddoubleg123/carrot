import { NextResponse } from 'next/server'
import { pageRail, railPartial, railStatus } from '@/lib/live/now'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (params.get('page') === '1' || params.get('full') === '1') {
    const { items, partial } = pageRail()
    return NextResponse.json({
      items,
      partial,
      streams: items.map((item) => ({
        id: item.id,
        live: item.presence === 'live',
        viewers: item.viewers
      }))
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  }
  const rail = await railStatus(false)
  return NextResponse.json({
    items: rail,
    partial: railPartial(),
    streams: rail.map((item) => ({
      id: item.id,
      live: item.presence === 'live',
      viewers: item.viewers
    }))
  }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
