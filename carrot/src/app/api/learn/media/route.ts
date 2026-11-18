import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function videoUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'video.twimg.com') return null
    return url
  } catch {
    return null
  }
}

async function openVideo(target: URL, range: string | null, hops = 0): Promise<Response | null> {
  if (hops > 3) return null
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0', Accept: 'video/mp4,*/*' }
  if (range) headers.Range = range
  const response = await fetch(target, { headers, redirect: 'manual' }).catch(() => null)
  if (!response) return null
  if (response.status >= 300 && response.status < 400) {
    const next = response.headers.get('location')
    await response.body?.cancel().catch(() => undefined)
    if (!next) return null
    const followed = videoUrl(new URL(next, target).toString())
    if (!followed) return null
    return openVideo(followed, range, hops + 1)
  }
  return response
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 })
  const target = videoUrl(new URL(request.url).searchParams.get('url') || '')
  if (!target) return new NextResponse('That video is not available.', { status: 400 })
  const upstream = await openVideo(target, request.headers.get('range'))
  if (!upstream) return new NextResponse('That video could not be opened.', { status: 502 })
  const headers = new Headers()
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes')
  if (!headers.has('content-type')) headers.set('content-type', 'video/mp4')
  headers.set('cache-control', 'private, max-age=300')
  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
