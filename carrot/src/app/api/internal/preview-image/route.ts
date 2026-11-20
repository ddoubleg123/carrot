import { NextResponse } from 'next/server'
import { pageImage, savePreview } from '@/lib/curator/preview'

export const dynamic = 'force-dynamic'

/** Refill a missing article picture. Localhost, or a curator secret from anywhere else. */
export async function GET(request: Request) {
  const host = request.headers.get('host') || ''
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
  const secret = process.env.CURATOR_SECRET || process.env.INGEST_WORKER_SECRET || ''
  const header = request.headers.get('x-curator-secret') || ''
  if (!local && (!secret || header !== secret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const page = new URL(request.url).searchParams.get('url') || ''
  if (!/^https?:\/\//i.test(page)) return NextResponse.json({ image: '' })
  const remote = await pageImage(page)
  if (!remote) return NextResponse.json({ image: '' })
  const image = await savePreview(remote, page)
  return NextResponse.json({ image: image || '' })
}
